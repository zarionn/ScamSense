/**
 * DOM-free harness for testing React page logic without a component test
 * framework (the repository intentionally has no Vitest/Jest/jsdom).
 *
 * It loads the REAL component source through Babel, replaces only the JSX
 * `return` with an object exposing named in-scope bindings, and drives it with
 * a minimal hook runtime that provides genuine `useState`/`useEffect`/`useRef`
 * semantics. Everything under test — routing, ordering, state transitions — is
 * the actual shipped code; only rendering is stubbed out.
 *
 * Deliberately NOT a source-text assertion helper: callers observe state and
 * captured calls, not file contents.
 */

import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)

export const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../'
)
const FRONTEND = path.join(REPO_ROOT, 'frontend')

const babel = require(path.join(FRONTEND, 'node_modules/@babel/core'))
const syntaxJsx = require(path.join(FRONTEND, 'node_modules/@babel/plugin-syntax-jsx'))

function stripJsxReturn(exposedNames) {
  return function plugin({ types: t }) {
    return {
      inherits: syntaxJsx.default ?? syntaxJsx,
      visitor: {
        ImportDeclaration(p) {
          p.remove()
        },
        ExportDefaultDeclaration(p) {
          p.replaceWith(p.node.declaration)
        },
        ReturnStatement(p) {
          const arg = p.node.argument
          if (!arg || (arg.type !== 'JSXElement' && arg.type !== 'JSXFragment')) return
          p.node.argument = t.objectExpression(
            exposedNames.map((name) =>
              t.objectProperty(t.identifier(name), t.identifier(name))
            )
          )
        },
      },
    }
  }
}

/**
 * Load a component module and return its component function.
 * @param relativePath  path from the repository root
 * @param componentName the function to return
 * @param exposedNames  identifiers in scope at the JSX return to expose
 * @param injected      object of identifiers the component body references
 */
export async function loadComponent({
  relativePath,
  componentName,
  exposedNames,
  injected,
}) {
  const source = await readFile(path.join(REPO_ROOT, relativePath), 'utf8')
  const { code } = babel.transformSync(source, {
    plugins: [stripJsxReturn(exposedNames)],
    configFile: false,
    babelrc: false,
  })

  const names = Object.keys(injected)
  const factory = new Function(...names, `${code}\nreturn ${componentName};`)
  return factory(...names.map((name) => injected[name]))
}

function sameDeps(a, b) {
  if (!a || !b || a.length !== b.length) return false
  return a.every((value, index) => Object.is(value, b[index]))
}

/**
 * Minimal hook runtime with real state. `render()` invokes the component,
 * then flushes effects whose dependencies changed — mirroring the parts of
 * React's contract this page actually relies on.
 */
export function createHookRuntime() {
  const slots = []
  let cursor = 0
  let pendingEffects = []
  let component = null
  let latest = null

  const useState = (initial) => {
    const index = cursor++
    if (slots.length <= index) {
      slots[index] = { value: typeof initial === 'function' ? initial() : initial }
    }
    const slot = slots[index]
    const setter = (next) => {
      slot.value = typeof next === 'function' ? next(slot.value) : next
    }
    return [slot.value, setter]
  }

  const useRef = (initial) => {
    const index = cursor++
    if (slots.length <= index) slots[index] = { value: { current: initial } }
    return slots[index].value
  }

  // Memoised by deps like the real hook — without this, every callback would be
  // a new identity each render and dependent effects would re-fire endlessly,
  // which would be a harness artefact rather than real behaviour.
  const useCallback = (fn, deps) => {
    const index = cursor++
    const previous = slots[index]
    if (!previous || !sameDeps(previous.deps, deps)) {
      slots[index] = { deps, value: fn }
    }
    return slots[index].value
  }

  const useEffect = (fn, deps) => {
    const index = cursor++
    const previous = slots[index]
    if (!previous || !sameDeps(previous.deps, deps)) {
      slots[index] = { deps }
      pendingEffects.push(fn)
    }
  }

  const useMemo = (fn, deps) => {
    const index = cursor++
    const previous = slots[index]
    if (!previous || !sameDeps(previous.deps, deps)) {
      slots[index] = { deps, value: fn() }
    }
    return slots[index].value
  }

  const runtime = {
    hooks: { useState, useRef, useCallback, useEffect, useMemo },
    mount(componentFn, props) {
      component = () => componentFn(props)
      return runtime.render()
    },
    render() {
      cursor = 0
      pendingEffects = []
      latest = component()
      const effects = pendingEffects
      pendingEffects = []
      for (const effect of effects) effect()
      return latest
    },
    get current() {
      return latest
    },
  }
  return runtime
}
