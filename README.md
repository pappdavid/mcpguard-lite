<div align="center">

# MCPGuard Lite

**Deterministic risk analysis for MCP `tools/list` manifests**

(hosted demo retired)

</div>

## Scope

MCPGuard Lite accepts raw JSON from an MCP server's `tools/list` response and produces a structured report containing:

- detected capability risks
- overall severity
- missing security-control declarations
- a persistence-ready summary

The analyzer is deterministic and explainable. It evaluates names, descriptions, and input schemas using transparent rules; it does not execute or dynamically probe the listed tools.

## Detected capability categories

| Category | Severity | Examples |
|---|---:|---|
| `command_execution` | critical | shell, exec, terminal, script |
| `filesystem_write` | high | write, delete, move, chmod |
| `filesystem_read` | medium | file reads, downloads, path enumeration |
| `network_access` | medium | HTTP, webhooks, sockets, URLs |
| `secret_access` | critical | secrets, credentials, tokens, environment variables |
| `database_access` | high | SQL, tables, PostgreSQL, database queries |
| `approval_bypass` | high | bypass, override, auto-approval behavior |

For risky manifests, the report also checks for explicit positive declarations of:

- human approval for high-risk tools
- audit logging
- filesystem allowlisting or sandboxing
- network egress restrictions

Negative phrases such as "without approval" or "no audit logging" are not treated as implemented controls.

## Verified behavior

GitHub Actions verifies the project on Node.js 20 with:

- dependency installation and Prisma client generation
- Vitest unit tests
- TypeScript type-checking
- ESLint
- a production Next.js build

The tests cover risky and read-only manifests, invalid JSON, persistence-report shaping, missing controls, negative-control wording, and explicit positive-control declarations.

## Architecture

- `src/lib/tools-list-report.ts`: manifest parser and capability/control analysis
- `src/lib/mcp-scan-report.ts`: API and persistence report adapter
- `src/app/dashboard/scans`: interactive manifest analysis
- `src/app/api/mcp/route.ts`: bearer-authenticated tool-style HTTP endpoint
- `prisma/schema.prisma`: PostgreSQL scan and security-event persistence

The `/api/mcp` route uses tool-shaped JSON over HTTP. It is not a full Model Context Protocol transport implementation.

## Tool-style HTTP API

Set `MCP_API_SECRET`, then call:

```bash
curl -X POST http://localhost:3000/api/mcp \
  -H "Authorization: Bearer $MCP_API_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "analyze_tools_list",
    "userId": "user_example",
    "params": {
      "input": "{\"tools\":[{\"name\":\"shell.exec\",\"description\":\"Run shell commands\"}]}"
    }
  }'
```

Supported tools:

- `analyze_tools_list`: analyzes and persists a manifest report
- `get_stats`: returns aggregate scan counts for a user

Both operations require a `userId`; analysis through this route is persisted in PostgreSQL.

## Local development

Requirements:

- Node.js 20
- PostgreSQL, including Neon-compatible connection strings
- Clerk application credentials

```bash
git clone https://github.com/pappdavid/mcpguard-lite.git
cd mcpguard-lite
cp .env.example .env.local
npm ci
npm run db:generate:ci
npm run db:push
npm run dev
```

Environment variables:

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk browser key |
| `CLERK_SECRET_KEY` | Clerk server key |
| `DATABASE_URL` | PostgreSQL pooled connection string |
| `DIRECT_URL` | PostgreSQL direct connection string |
| `MCP_API_SECRET` | Bearer secret for the tool-style HTTP endpoint |

## Development commands

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

## Current limitations

- static manifest analysis cannot prove runtime enforcement
- capability detection is rule-based and may require tuning for unusual tool names
- control checks rely on explicit positive declarations in the supplied JSON
- the HTTP endpoint is tool-shaped, not full MCP transport
- results should support, not replace, sandboxing, least privilege, and runtime monitoring
