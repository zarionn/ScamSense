/**
 * Node resolve hook mapping Vite's "@/" alias onto frontend/src, so tests can
 * import the real modules with their real import graph intact.
 *
 * "@/lib/supabase" is redirected to a recording stub: the real client reads
 * import.meta.env and throws outside Vite, and no test may reach a database.
 */

import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const SUPPORT_DIR = path.dirname(fileURLToPath(import.meta.url))
const FRONTEND_SRC = path.resolve(SUPPORT_DIR, '../../../frontend/src')
const SUPABASE_STUB = path.join(SUPPORT_DIR, 'supabase-stub.mjs')

export async function resolve(specifier, context, nextResolve) {
  if (specifier === '@/lib/supabase') {
    return { url: pathToFileURL(SUPABASE_STUB).href, shortCircuit: true }
  }
  if (specifier.startsWith('@/')) {
    // Vite resolves extensionless imports; Node does not, so try the same
    // candidates Vite would.
    const base = path.join(FRONTEND_SRC, specifier.slice(2))
    const candidates = [base, `${base}.js`, `${base}.jsx`, path.join(base, 'index.js')]
    const resolved = candidates.find((candidate) => existsSync(candidate))
    if (resolved) {
      return { url: pathToFileURL(resolved).href, shortCircuit: true }
    }
  }
  return nextResolve(specifier, context)
}
