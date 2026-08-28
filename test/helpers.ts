/**
 * Shared test harness: an isolated GALVANIZE_HOME + a stub core server that
 * speaks the real contract (GET /version, POST /manage/<op> bearer token).
 */
import { createServer, type Server } from 'node:http'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeEach } from 'vitest'

export interface StubCall {
  op: string
  body: Record<string, unknown>
  auth: string
}

export interface StubCore {
  home: string
  port: number
  calls: StubCall[]
  url: string
  /** Override the /version reply (compat testing). */
  version: { core_version: string; api_version: number }
  /** Per-op canned responses; default echoes {ok:true, echoed:body}. */
  responses: Record<string, unknown>
  /** Simulate serve down (kill server, leave serve.json behind). */
  stopServing(): Promise<void>
  close(): Promise<void>
}

export async function startStubCore(opts: { token?: string } = {}): Promise<StubCore> {
  const home = mkdtempSync(join(tmpdir(), 'gz-dsh-test-'))
  const token = opts.token ?? 'test-token'
  const stub: StubCore = {
    home,
    port: 0,
    calls: [],
    url: '',
    version: { core_version: '0.1.0', api_version: 1 },
    responses: {},
    stopServing: async () => server.close(),
    close: async () => {
      server.close()
      rmSync(home, { recursive: true, force: true })
    },
  }

  const server = createServer((req, res) => {
    const send = (code: number, obj: unknown) => {
      res.writeHead(code, { 'content-type': 'application/json' })
      res.end(JSON.stringify(obj))
    }
    if (req.method === 'GET' && req.url === '/version') {
      return send(200, stub.version)
    }
    if (req.method === 'POST' && req.url?.startsWith('/manage/')) {
      if (req.headers.authorization !== `Bearer ${token}`) return send(401, { ok: false, error: 'unauthorized' })
      let raw = ''
      req.on('data', (c) => (raw += c))
      req.on('end', () => {
        const op = req.url!.slice('/manage/'.length)
        let body: Record<string, unknown> = {}
        try {
          body = JSON.parse(raw || '{}')
        } catch {
          return send(400, { ok: false, error: 'bad JSON' })
        }
        stub.calls.push({ op, body, auth: String(req.headers.authorization ?? '') })
        const canned = stub.responses[op] ?? { ok: true, echoed: body }
        send(200, canned)
      })
      return
    }
    send(404, { error: 'not found' })
  })

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('stub server failed to bind')
  stub.port = address.port
  stub.url = `http://127.0.0.1:${stub.port}`

  // Discovery + auth files exactly where the plugin expects them.
  writeFileSync(join(home, 'serve.json'), JSON.stringify({ port: stub.port, pid: process.pid, ts: Date.now(), api_version: 1 }))
  writeFileSync(join(home, 'serve.token'), token)
  process.env.GALVANIZE_HOME = home
  return stub
}

/** Fake Cordis context: records tool registrations + effect bodies. */
export function fakeCtx() {
  const registered: any[] = []
  const effectBodies: Array<() => unknown> = []
  const disposers: Array<() => unknown> = []
  const ctx: any = {
    tools: { register: (t: unknown) => registered.push(t) },
    effect: (fn: () => unknown) => {
      effectBodies.push(fn)
      const result = fn()
      // Cordis runs effect bodies at registration; collect the disposer.
      if (typeof result === 'function') disposers.push(result as () => unknown)
      else if (result && typeof (result as Promise<unknown>).then === 'function') {
        // async effect: caller awaits via settleEffects()
        pending.push(
          (result as Promise<unknown>).then((d) => {
            if (typeof d === 'function') disposers.push(d as () => unknown)
          }),
        )
      }
    },
  }
  const pending: Promise<void>[] = []
  return {
    ctx,
    registered,
    effectBodies,
    disposers,
    settle: () => Promise.all(pending.splice(0)),
    disposeAll: () => disposers.splice(0).map((d) => d()),
  }
}

export const cleanups: Array<() => Promise<void>> = []
beforeEach(() => {
  cleanups.length = 0
})
afterAll(async () => {
  for (const fn of cleanups) await fn().catch(() => {})
})
