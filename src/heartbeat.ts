/**
 * Heartbeat: the LOADED proof (PLAN §3). A PENDING Cordis fiber fails
 * silently — typo'd module path or unsatisfied `inject` means `apply` never
 * runs, with no crash and no notice channel. Writing this file from inside
 * `apply` under `ctx.effect` makes "did the plugin actually load?" a
 * filesystem question the installer can verify.
 *
 * @module galvanize-dsh/heartbeat
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { heartbeatPath } from './core-client.js'

export const PLUGIN_VERSION = '0.1.3'

export interface Heartbeat {
  plugin_version: string
  core_api_ok: boolean
  core_version?: string
  ts: number
  pid: number
}

/** Write the heartbeat; returns false when the file could not be written. */
export function writeHeartbeat(coreApiOk: boolean, coreVersion?: string): boolean {
  const beat: Heartbeat = {
    plugin_version: PLUGIN_VERSION,
    core_api_ok: coreApiOk,
    ...(coreVersion ? { core_version: coreVersion } : {}),
    ts: Date.now(),
    pid: process.pid,
  }
  try {
    writeFileSync(heartbeatPath(), JSON.stringify(beat), { mode: 0o600 })
    return true
  } catch {
    return false
  }
}

/** Read a heartbeat written by any process; null when absent/stale/unparsable. */
export function readHeartbeat(maxAgeMs = 120_000): Heartbeat | null {
  try {
    const raw = JSON.parse(readFileSync(heartbeatPath(), 'utf8')) as Heartbeat
    if (typeof raw?.ts !== 'number') return null
    if (Date.now() - raw.ts > maxAgeMs) return null
    return raw
  } catch {
    return null
  }
}
