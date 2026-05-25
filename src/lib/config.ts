export const SERVICE_CONFIG = {
  name: process.env.NEXT_PUBLIC_SERVICE_NAME ?? "McpGuard Lite",
  tagline: process.env.NEXT_PUBLIC_SERVICE_TAGLINE ?? "Lean MCP tools/list risk reporting",
  slug: "mcpguard-lite",
} as const;
