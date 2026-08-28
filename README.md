# galvanize-dsh

Native [DSH](https://github.com/deepseek-ai/deepseek-harness) (DeepSeek Harness) bundle for
[galvanize](https://github.com/jarvis959/galvanize) event triggers: puts
`trigger_add / trigger_list / trigger_remove / trigger_test / trigger_status`
into a DSH agent's tool schema, so "wake me when X happens" becomes a real
push trigger instead of a poll job.

- **Thin client by design:** all wake + trigger logic lives in the
  [`galvanize` core](https://github.com/jarvis959/galvanize); this bundle
  proxies to the core's versioned local API (`galvanize serve`, loopback-only,
  token-authenticated). One behavior across every harness it supports.
- **Wake path:** the core spawns a headless DSH one-shot per event
  (`dsh --profile <profile> "<prompt>"`) — DSH has no inbound webhook lane,
  so the spawner *is* the adapter.
- **The installer proves the plugin loaded.** A broken DSH plugin fails as a
  *silent PENDING fiber*: no crash, no notice channel. `galvanize-dsh install`
  therefore ends with a headless boot-probe plus three green checks
  (patch row ∧ fresh heartbeat ∧ version handshake). Nothing ever says
  "should be fine."

## Requirements

| | |
|---|---|
| OS | Windows, Linux, macOS (anything DSH runs on) |
| Node | `^22.19 \|\| >=24` (DSH's own range) |
| galvanize core | ≥ 0.1.0 with the `serve` API (same author; publishing alongside this package) |
| DSH | `dsh` on PATH (`npm install -g @deepseek-ai/dsh`) or `$DSH_BIN` pointed at a checkout |

## Quick start

```bash
# 1. the galvanize core must be installed and its daemon running:
uvx galvanize init          # one-command core install + daemon autostart

# 2. install this bundle into your DSH profile (default: web) —
#    bootstraps the wake profile too, runs a headless boot-probe, and ends
#    with three green LOADED checks:
npx galvanize-dsh install
#    (from a git clone instead of npm: `npm ci && node lib/cli.js install`)

# 3. drop a file — a fresh DSH session wakes and acts on your prompt:
galvanize add folder ~/inbox --name triage \
  --wake dsh --prompt 'Read {file} and write a triage summary to ~/inbox-out/{file}.md'
echo hello > ~/inbox/demo.txt   # ~a minute later: ~/inbox-out/demo.txt.md exists
```

Inside a booted DSH session the five `trigger_*` tools are simply there:

> *"wake me when a resume lands in ~/resumes"* → the agent calls
> `trigger_add` itself, then `trigger_test` so you watch it fire once.

## What install/verify actually check

```
galvanize-dsh verify --profile web
  ✔ core /version handshake        core 0.1.2, api 1
  ✔ patch row 'galvanize/tools'    row present, package resolvable
  ✔ plugin heartbeat               plugin 0.1.2, core_api_ok=true, 3s ago
LOADED: all three checks green.
```

`install` refuses to claim success without them, and `uninstall` reverses
both profile mounts plus the surface-registry entry.

## Exactly-one-surface

Per harness, either the native plugin **or** `galvanize mcp` — never both.
An active plugin writes `~/.galvanize/surfaces.json` (`{"dsh":"plugin"}`);
the core's `doctor` flags double-mounts and the MCP server stands its tools
down when the plugin owns the slot.

## Development

```bash
npm ci && npm run build && npx vitest run && npx publint
```

- `src/index.ts` — the five tools (`defineTool`) + heartbeat/surface effects
- `src/core-client.ts` — serve discovery, token, version-compat gate
- `src/cli.ts` — installer / verifier / uninstaller
- `test/` — vitest suite against a stub core server (no DSH needed)

## License

MIT
