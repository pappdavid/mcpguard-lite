const REGEX_PATTERNS: RegExp[] = [
  /ignore (previous|all|above) instructions/i,
  /you are now/i,
  /forget (everything|your instructions|your system prompt)/i,
  /jailbreak/i,
  /act as (an? )?(DAN|unrestricted|evil|malicious)/i,
  // Safe negated-character-class pattern — no backtracking against `|>`
  /<\|[^|>]*\|>/,
];

// String-based check for [[...system...]] — avoids ReDoS from two unbounded
// quantifiers around the "system" literal (polynomial on adversarial input).
function hasBracketSystemInjection(input: string): boolean {
  const lower = input.toLowerCase();
  let i = 0;
  while ((i = lower.indexOf("[[", i)) !== -1) {
    const end = lower.indexOf("]]", i + 2);
    if (end !== -1) {
      const systemIdx = lower.indexOf("system", i + 2);
      if (systemIdx !== -1 && systemIdx < end) return true;
    }
    i += 2;
  }
  return false;
}

const BRACKET_SYSTEM_PATTERN_LABEL = "/[[...system...]]/i (string check)";

export interface GuardResult {
  safe: boolean;
  detectedPatterns: string[];
}

export function scanPromptForInjection(input: string): GuardResult {
  const detectedPatterns: string[] = [];

  for (const pattern of REGEX_PATTERNS) {
    if (pattern.test(input)) {
      detectedPatterns.push(pattern.toString());
    }
  }

  if (hasBracketSystemInjection(input)) {
    detectedPatterns.push(BRACKET_SYSTEM_PATTERN_LABEL);
  }

  return { safe: detectedPatterns.length === 0, detectedPatterns };
}

export function assertSafePrompt(input: string): void {
  const result = scanPromptForInjection(input);
  if (!result.safe) {
    throw new Error(`Prompt injection detected: ${result.detectedPatterns.join(", ")}`);
  }
}
