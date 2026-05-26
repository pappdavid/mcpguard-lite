# McpGuard Lite

Lean MCP tools/list risk reporting for AI agents.

**Production URL:** https://mcpguard-lite.vercel.app

## MVP flow

1. Sign in with Clerk.
2. Paste a raw MCP `tools/list` JSON response in `/dashboard/scans`.
3. McpGuard Lite detects risky capability categories such as command execution, filesystem access, network access, secret access, database access, and approval bypass.
4. The report highlights missing controls such as human approval, audit logging, filesystem sandboxing, and network egress allowlists.
5. The scan is persisted to Neon Postgres through Prisma and scoped to the signed-in Clerk user.

## One-command local setup

```bash
cp .env.example .env.local
# Edit .env.local with your credentials (see comments in the file)
npm install
npm run db:generate   # generate Prisma client
npm run db:push       # push schema to your Postgres database
npm run dev           # start dev server on http://localhost:3000
```

## Modules

| Module | Status | Description |
|--------|--------|-------------|
| `auth.clerk` | ✅ | Clerk-based auth, sessions, and identity flows |
| `db.postgres.prisma` | ✅ | PostgreSQL via Prisma ORM with Neon connection pooling |
| `tools-list-report` | ✅ | Deterministic MCP tools/list capability and control-gap analysis |
| `security.analytics` | ✅ | Security event persistence and aggregation |
| `mcp.rest` | ✅ | REST MCP endpoint — `analyze_tools_list`, `get_stats` |

## MCP API

The MCP endpoint is at `POST /api/mcp`. Authenticate with `Authorization: Bearer <MCP_API_SECRET>`.

**List available tools**
```bash
curl http://localhost:3000/api/mcp
```

**Analyze MCP tools/list JSON**
```bash
curl -X POST http://localhost:3000/api/mcp \
  -H "Authorization: Bearer $MCP_API_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"tool":"analyze_tools_list","userId":"user_xxx","params":{"input":"{\"tools\":[{\"name\":\"shell.exec\",\"description\":\"Run shell commands\"}]}"}}'
```

**Get aggregate security stats**
```bash
curl -X POST http://localhost:3000/api/mcp \
  -H "Authorization: Bearer $MCP_API_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"tool":"get_stats","userId":"user_xxx"}'
```

## Project structure

```
src/
  app/
    dashboard/          # Protected product pages (overview, scans, events)
    (auth)/             # Clerk auth flows (sign-in, sign-up)
    api/
      mcp/              # MCP REST endpoint (agent integrations)
      scan/             # Internal tools/list analysis API
      scans/            # Scan history API
  lib/
    analytics.ts        # Security event tracking (persists to DB)
    db.ts               # Prisma client singleton
    mcp-scan-report.ts  # API/persistence adapter for tools/list reports
    tools-list-report.ts # Deterministic tools/list analyzer
    config.ts           # Service config
    utils.ts            # Tailwind class utilities
prisma/
  schema.prisma         # User, McpScan, SecurityEvent models
```

## Environment variables

See `.env.example` — every variable has an inline comment explaining its purpose.

Required for local development and deploys:

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `DATABASE_URL`
- `DIRECT_URL`
- `MCP_API_SECRET`

## Development

```bash
npm run dev        # start dev server
npm test           # run vitest unit tests
npm run typecheck  # TypeScript type check
npm run lint       # ESLint
npm run build      # production build
```

## Deploy

1. Create a Neon Postgres project.
2. Set `DATABASE_URL` to the pooled Neon connection string and `DIRECT_URL` to the direct connection string.
3. Create a Clerk app and set the Clerk publishable/secret keys plus the redirect URLs from `.env.example`.
4. Generate `MCP_API_SECRET` with `openssl rand -hex 32`.
5. Install dependencies, generate Prisma, and apply the schema:

```bash
npm install
npm run db:generate
npm run db:push
```

6. Deploy with your Next.js host and set the same env vars in the hosting dashboard.

## Known limitations

- The analyzer is deterministic and pattern-based; it does not prove a tool is safe.
- It inspects declared tool names, descriptions, and input schemas only.
- Missing-control detection depends on controls being described in the pasted tools/list payload.
- The service MCP endpoint requires a Clerk `userId` so persisted reports stay scoped to one user.
