/**
 * Sequential behaviour test for advisory clarification continuity.
 *
 * This drives the REAL `handleSend` from AssistantPage.jsx across a multi-turn
 * sequence, rather than asserting on source text. The component's JSX return is
 * swapped for `{ handleSend }` at load time (the render output is irrelevant
 * here); every line of the routing and transcript logic under test is the
 * actual shipped code.
 *
 * The question it answers: after a clarification is answered by an ATTACHMENT
 * rather than a topic, can the next typed turn resume the stale clarification?
 */

import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import test from 'node:test'

const require = createRequire(import.meta.url)
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../')
const FRONTEND = path.join(REPO_ROOT, 'frontend')

const babel = require(path.join(FRONTEND, 'node_modules/@babel/core'))
const syntaxJsx = require(path.join(FRONTEND, 'node_modules/@babel/plugin-syntax-jsx'))

const { IMAGE_ATTACHED_REPLY, TRANSACTION_ATTACHED_REPLY, STEPS, WELCOME_STEP_ID } =
  await import(
    new URL('../../frontend/src/pages/assistant/assistant-flow.js', import.meta.url)
  )

const CLARIFICATION_MESSAGE =
  'Which scam type, organisation, or suspicious behaviour would you like me to check for official advisories?'

const CLARIFICATION_RESPONSE = {
  reply: CLARIFICATION_MESSAGE,
  source: 'trusted_advisory',
  advisory_search: {
    status: 'needs_clarification',
    message: CLARIFICATION_MESSAGE,
    advisories: [],
  },
}

const MATCH_RESPONSE = {
  reply: 'I found 1 related official advisory in the reviewed collection.\n\n...',
  source: 'trusted_advisory',
  advisory_search: {
    status: 'matches',
    message: 'I found 1 related official advisory in the reviewed collection.',
    advisories: [
      {
        advisory_id: 'investment-scams-2025',
        title: 'Police Advisory On Investment Scams',
        authorities: ['Singapore Police Force'],
        publication_date: '2025-02-11',
        summary: 'Stored investment advisory summary.',
        source_url: 'https://www.police.gov.sg/media-hub/news/2025/investment-advisory',
        relevance: 'Mentions investment scams.',
      },
    ],
  },
}

// ---- Load the real component with its JSX return replaced. ----------------

function stripJsxReturn({ types: t }) {
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
        if (arg && (arg.type === 'JSXElement' || arg.type === 'JSXFragment')) {
          p.node.argument = t.objectExpression([
            t.objectProperty(t.identifier('handleSend'), t.identifier('handleSend')),
          ])
        }
      },
    },
  }
}

const { readFile } = await import('node:fs/promises')
const source = await readFile(
  path.join(FRONTEND, 'src/pages/assistant/AssistantPage.jsx'),
  'utf8'
)
const { code } = babel.transformSync(source, {
  plugins: [stripJsxReturn],
  configFile: false,
  babelrc: false,
})

// React hooks reduced to their synchronous identity behaviour: the component is
// invoked directly once per "render", exactly as the controlled-props contract
// implies, so handleSend always closes over the current `messages`.
const useCallback = (fn) => fn
const useState = (initial) => [initial, () => {}]
const AssistantPage = new Function(
  'useCallback',
  'useState',
  'IMAGE_ATTACHED_REPLY',
  'TRANSACTION_ATTACHED_REPLY',
  'STEPS',
  'WELCOME_STEP_ID',
  `${code}\nreturn AssistantPage;`
)(
  useCallback,
  useState,
  IMAGE_ATTACHED_REPLY,
  TRANSACTION_ATTACHED_REPLY,
  STEPS,
  WELCOME_STEP_ID
)

function createHarness() {
  let messages = []
  const sentRequests = []
  const persisted = []
  let nextResponse = CLARIFICATION_RESPONSE

  globalThis.fetch = async (_url, init) => {
    sentRequests.push(JSON.parse(init.body))
    const body = nextResponse
    return { ok: true, json: async () => body }
  }
  globalThis.window = { setTimeout: (fn) => fn() }

  const render = () =>
    AssistantPage({
      messages,
      onMessagesChange: (updater) => {
        messages = typeof updater === 'function' ? updater(messages) : updater
      },
      onPersistMessage: (role, text, advisorySearch) =>
        persisted.push({ role, text, advisorySearch }),
      onOpenDetector: () => {},
      onConversationReset: () => {},
      // Off, so the deterministic attachment reply is appended synchronously
      // instead of behind a 450ms timer.
      typingAnimation: false,
      guidedSuggestions: true,
    })

  return {
    async send(payload, response) {
      if (response) nextResponse = response
      await render().handleSend(payload)
    },
    get messages() {
      return messages
    },
    get last() {
      return messages[messages.length - 1]
    },
    sentRequests,
    persisted,
    // Simulates refresh/reopen: the transcript is rebuilt from what was
    // persisted, which is what the codec restores.
    reloadFromPersisted(restored) {
      messages = restored
    },
  }
}

// ---- Control: the clarification DOES carry over to an immediate topic. ----

test('clarification followed by a typed topic sends the pending flag', async () => {
  const harness = createHarness()

  await harness.send({ text: 'Are there any recent scam advisories?' }, CLARIFICATION_RESPONSE)
  assert.equal(harness.last.role, 'assistant')
  assert.equal(harness.last.advisorySearch.status, 'needs_clarification')

  await harness.send({ text: 'investment' }, MATCH_RESPONSE)

  assert.equal(harness.sentRequests.length, 2)
  assert.equal(harness.sentRequests[0].context.awaiting_advisory_topic, false)
  assert.equal(harness.sentRequests[1].context.awaiting_advisory_topic, true)
})

// ---- The edge case under review. -----------------------------------------

test('an image attachment consumes the pending clarification for the next turn', async () => {
  const harness = createHarness()

  await harness.send({ text: 'Are there any recent scam advisories?' }, CLARIFICATION_RESPONSE)
  assert.equal(harness.last.advisorySearch.status, 'needs_clarification')

  // Attachment turn: no advisory request is issued...
  await harness.send({ attachment: { type: 'image', file: { name: 'shot.png' } } })
  assert.equal(harness.sentRequests.length, 1)

  // ...and the transcript now ends with the deterministic attachment reply,
  // which carries no advisorySearch at all.
  assert.equal(harness.last.role, 'assistant')
  assert.equal(harness.last.text, IMAGE_ATTACHED_REPLY)
  assert.equal(harness.last.advisorySearch, undefined)

  // The following typed turn must therefore NOT resume the stale clarification.
  await harness.send({ text: 'investment' }, MATCH_RESPONSE)

  assert.equal(harness.sentRequests.length, 2)
  assert.equal(harness.sentRequests[1].context.awaiting_advisory_topic, false)
})

test('a non-image attachment also consumes it and keeps its own routing', async () => {
  const harness = createHarness()

  await harness.send({ text: 'Are there any recent scam advisories?' }, CLARIFICATION_RESPONSE)
  await harness.send({ attachment: { type: 'excel', file: { name: 'rows.xlsx' } } })

  // Routed by its own type — batch, not screenshot.
  assert.deepEqual(harness.last.suggestions, ['message'])
  assert.equal(harness.last.handoffMode, 'batch')
  assert.equal(harness.last.advisorySearch, undefined)

  await harness.send({ text: 'investment' }, MATCH_RESPONSE)
  assert.equal(harness.sentRequests[1].context.awaiting_advisory_topic, false)
})

test('a transaction image still routes to the transaction flow, not screenshot', async () => {
  const harness = createHarness()

  await harness.send({ text: 'Are there any recent scam advisories?' }, CLARIFICATION_RESPONSE)
  await harness.send({
    attachment: { type: 'image', kind: 'transaction', file: { name: 'txn.png' } },
  })

  assert.equal(harness.last.text, TRANSACTION_ATTACHED_REPLY)
  assert.deepEqual(harness.last.suggestions, ['transaction', 'message'])
})

// ---- Refresh / reopen still resumes a genuinely pending clarification. ----

test('a clarification restored from history still resumes on the next turn', async () => {
  const harness = createHarness()

  // Exactly what the codec returns for a restored clarification row.
  harness.reloadFromPersisted([
    { id: 'u1', role: 'user', text: 'Are there any recent scam advisories?' },
    {
      id: 'a1',
      role: 'assistant',
      text: CLARIFICATION_MESSAGE,
      advisorySearch: CLARIFICATION_RESPONSE.advisory_search,
    },
  ])

  await harness.send({ text: 'investment' }, MATCH_RESPONSE)

  assert.equal(harness.sentRequests[0].context.awaiting_advisory_topic, true)
})
