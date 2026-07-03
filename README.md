# claude-conare

[Conare](https://conare.ai) as a native Claude Code plugin: your entire work
history — past sessions, decisions, file paths, preferences — loaded into every
session automatically.

One install delivers three things:

1. **Instant project brief at session start.** A `SessionStart` hook injects a
   precomputed, freshness-stamped brief for the repo you're in — what the
   project is, what changed recently, working rules, known pitfalls — in about
   a second, before the model's first token. No tool call, no waiting on
   retrieval.
2. **The Conare MCP server** (`recall` / `search` / `save` / `forget`),
   bundled via a local bridge — authenticates with your existing Conare API
   key, no OAuth prompts, no manual MCP configuration.
3. **The memory-first skill**, teaching the agent when to reach for memory
   instead of re-exploring your codebase.

## Install

```
/plugin marketplace add conareai/claude-conare
/plugin install conare@conare
```

Already ran `bunx conare@latest`? You're done — the plugin picks up your
existing API key from `~/.conare/config.json` and everything works
immediately. Not signed in yet? The memory tools are replaced by a single
`setup` tool that walks the agent (and you) through `bunx conare@latest`; the
real tools appear the moment you sign in, no restart needed.

**Teams:** install with `--scope project` and the plugin lands in
`.claude/settings.json` `enabledPlugins` — everyone who clones the repo gets
the whole integration.

## How the MCP bridge works

`scripts/mcp-bridge.mjs` (zero dependencies — read it): a stdio ↔ HTTP bridge
that reads your API key from `~/.conare/config.json` and forwards JSON-RPC to
`https://api.conare.ai/mcp` with the Bearer header — exactly what the Conare
CLI configures, so both paths share one credential. The key is re-checked on
every message: sign in mid-session and the tools start working without a
reconnect. With no key present, the bridge answers locally with the `setup`
tool instead of failing.

## How the hook works

`scripts/session-start.mjs` (zero dependencies, ~120 lines — read it):

1. Reads the hook payload from stdin and resolves the repo's identity: sha256
   of the normalized `origin` remote URL (falls back to the directory path for
   remoteless repos).
2. Reads your API key from `~/.conare/config.json` (written by the Conare CLI;
   no shell-profile env vars).
3. Fetches `GET /api/hook/brief` with a 2-second budget.
4. Prints the brief as `additionalContext` — or, on any failure (offline, no
   key, no brief yet), prints nothing and exits 0. **The hook can never block
   or degrade session start.**

The brief itself is precomputed by Conare's background agents (refreshed every
24h from your ingested history) and served as a materialized artifact — that's
why it's fast. It ends with a directive telling the agent to skip the startup
`recall` and use `search` for anything deeper, so context is never loaded
twice.

## Configuration

| What | Where |
| --- | --- |
| API key | `~/.conare/config.json` (`apiKey`) — written by `bunx conare@latest` |
| API base override | `CONARE_API_URL` env var (default `https://api.conare.ai`) |

## Privacy & security

- The hook sends only a repo-identity hash and your API key over HTTPS. No
  code, no file contents, no prompts.
- No secrets are baked into the plugin — your API key stays in
  `~/.conare/config.json` and is read locally by the hook and the bridge.
- Everything this plugin executes is in this repo, in plain JavaScript.

## Uninstall

```
/plugin uninstall conare@conare
```

## Development

```bash
# Run Claude Code against your working copy:
claude --plugin-dir .

# Validate the manifest:
claude plugin validate .

# Hook smoke test (no credentials ⇒ must print nothing, exit 0):
echo '{}' | HOME=$(mktemp -d) node scripts/session-start.mjs
```

## License

[MIT](LICENSE)
