# pristine

## Account integration

The desktop app now integrates with the sibling `pristine-auth` service through the MenuBar avatar.

By default, the desktop app targets the hosted production auth service.

Set these environment variables to override the defaults, for example when developing against a local auth stack:
- `PRISTINE_AUTH_SERVICE_URL`
- `PRISTINE_SUPABASE_URL`
- `PRISTINE_SUPABASE_PUBLISHABLE_KEY`

The desktop app opens the system browser for sign-in and receives the callback on `pristine://auth/callback`.

For the full Supabase and Cloudflare setup flow, use the documentation in the sibling `pristine-auth` repo.

## Pristine Agent

The Explorer right sidebar uses a standalone Mastra agent server from `agent-server/`. Start it separately from the Electron renderer:

```powershell
Copy-Item agent-server/.env.example agent-server/.env.local
pnpm agent:dev
```

Set provider keys in `agent-server/.env.local`; the renderer only calls the local HTTP API. The default test model is `openrouter/openrouter/free`. To use another provider/model, set `PRISTINE_AGENT_MODEL` to a Mastra model id such as `openai/gpt-4.1-mini`, `anthropic/claude-3-5-haiku-latest`, or `google/gemini-2.0-flash`.

Useful scripts:
- `pnpm agent:dev` runs the Mastra dev server and Studio.
- `pnpm agent:typecheck` typechecks the agent server package.
- `pnpm agent:test` runs agent server tests.

The renderer defaults to `http://localhost:4111`. Override it with `VITE_PRISTINE_AGENT_URL` when needed. File changes and shell commands proposed by the agent stay pending until approved from the sidebar.