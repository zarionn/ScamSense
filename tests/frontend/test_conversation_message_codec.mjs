import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import {
  conversationMessageCodecConstants,
  deserializeConversationMessage,
  serializeConversationMessage,
} from '../../frontend/src/services/conversation-message-codec.js'


const advisories = [
  {
    advisory_id: 'investment-scams-2025',
    title: 'Police Advisory On Investment Scams',
    authorities: ['Singapore Police Force'],
    publication_date: '2025-02-11',
    summary: 'Stored investment advisory summary.',
    source_url: 'https://www.police.gov.sg/media-hub/news/2025/investment-advisory',
    relevance: 'Mentions investment scams.',
  },
  {
    advisory_id: 'technical-support-remote-access-2025',
    title: 'Advisory On Technical Support Scams',
    authorities: ['Singapore Police Force', 'Cyber Security Agency of Singapore'],
    publication_date: '2025-01-21',
    summary: 'Stored technical-support advisory summary.',
    source_url: 'https://www.police.gov.sg/media-hub/news/2025/support-advisory',
    relevance: 'Mentions remote-access or technical-support scams.',
  },
]

const matchedSearch = {
  status: 'matches',
  message: 'I found 2 related official advisories in the reviewed collection.',
  advisories,
}

const readableReply = [
  matchedSearch.message,
  advisories[0].title,
  `Authority: ${advisories[0].authorities[0]}`,
  `Publication date: ${advisories[0].publication_date}`,
  `Official source: ${advisories[0].source_url}`,
].join('\n')


function createSerializedMessage(search = matchedSearch) {
  return serializeConversationMessage({
    role: 'assistant',
    text: readableReply,
    advisorySearch: search,
  })
}


function rewriteEnvelope(serialized, apply) {
  const prefix = conversationMessageCodecConstants.prefix
  const envelope = JSON.parse(serialized.slice(prefix.length))
  apply(envelope)
  return `${prefix}${JSON.stringify(envelope)}`
}


test('live matched advisory data round-trips into reloadable cards', () => {
  const stored = createSerializedMessage()
  const restored = deserializeConversationMessage(stored, 'assistant')

  assert.ok(stored.startsWith(conversationMessageCodecConstants.prefix))
  assert.equal(restored.text, matchedSearch.message)
  assert.deepEqual(restored.advisorySearch, matchedSearch)
  assert.deepEqual(restored.advisories, advisories)
})

test('multiple advisory cards preserve their order and every approved field', () => {
  const restored = deserializeConversationMessage(createSerializedMessage(), 'assistant')

  assert.deepEqual(
    restored.advisories.map((advisory) => advisory.advisory_id),
    advisories.map((advisory) => advisory.advisory_id)
  )
  for (const [index, advisory] of advisories.entries()) {
    assert.deepEqual(restored.advisories[index], advisory)
  }
})

test('legacy plain-text assistant and user messages remain unchanged', () => {
  assert.deepEqual(deserializeConversationMessage('Legacy assistant reply', 'assistant'), {
    text: 'Legacy assistant reply',
  })
  const prefixLikeUserText = `${conversationMessageCodecConstants.prefix}{"version":1}`
  assert.deepEqual(deserializeConversationMessage(prefixLikeUserText, 'user'), {
    text: prefixLikeUserText,
  })
})

test('invalid JSON falls back without exposing the serialized representation', () => {
  const stored = `${conversationMessageCodecConstants.prefix}{not-json`
  const restored = deserializeConversationMessage(stored, 'assistant')

  assert.deepEqual(restored, { text: conversationMessageCodecConstants.fallbackText })
  assert.equal(restored.text.includes(conversationMessageCodecConstants.prefix), false)
})

test('unsupported versions fall back to the readable text', () => {
  const stored = rewriteEnvelope(createSerializedMessage(), (envelope) => {
    envelope.version = 2
  })

  assert.deepEqual(deserializeConversationMessage(stored, 'assistant'), {
    text: readableReply,
  })
})

test('disallowed and non-HTTPS advisory URLs never restore cards or links', () => {
  for (const unsafeUrl of [
    'http://www.police.gov.sg/media-hub/news/advisory',
    'https://example.com/advisory',
  ]) {
    const stored = rewriteEnvelope(createSerializedMessage(), (envelope) => {
      envelope.advisory_search.advisories[0].source_url = unsafeUrl
    })
    const restored = deserializeConversationMessage(stored, 'assistant')

    assert.deepEqual(restored, { text: readableReply })
    assert.equal('advisories' in restored, false)
  }
})

test('extra fields and more than three advisories fail closed to text', () => {
  const extraField = rewriteEnvelope(createSerializedMessage(), (envelope) => {
    envelope.advisory_search.advisories[0].score = 99
  })
  assert.deepEqual(deserializeConversationMessage(extraField, 'assistant'), {
    text: readableReply,
  })

  const tooMany = {
    ...matchedSearch,
    advisories: [advisories[0], advisories[1], advisories[0], advisories[1]],
  }
  assert.equal(createSerializedMessage(tooMany), readableReply)
})

test('no-match responses remain ordinary text', () => {
  // Only matches and pending clarifications are structured. A no-match (and
  // an unavailable) response has nothing to restore, so it stays plain text.
  for (const status of ['no_match', 'unavailable']) {
    const text = `${status} readable message`
    const stored = serializeConversationMessage({
      role: 'assistant',
      text,
      advisorySearch: { status, message: text, advisories: [] },
    })
    assert.equal(stored, text)
    assert.deepEqual(deserializeConversationMessage(stored, 'assistant'), { text })
  }
})

test('stored envelope contains only approved display fields', () => {
  const stored = createSerializedMessage()
  const serializedBody = stored.slice(conversationMessageCodecConstants.prefix.length)

  for (const forbidden of [
    'score',
    'threshold',
    'signal_tags',
    'credential_request',
    'analysis_token',
    'prompt',
  ]) {
    assert.equal(serializedBody.includes(forbidden), false)
  }
})

test('rendering, persistence, preview and search paths use safe structured data', async () => {
  const repositoryRoot = new URL('../../', import.meta.url)
  const [assistantPage, chatMessage, advisoryCard, historyHook, conversationService, historyRow] =
    await Promise.all(
      [
        'frontend/src/pages/assistant/AssistantPage.jsx',
        'frontend/src/pages/assistant/components/ChatMessage.jsx',
        'frontend/src/pages/assistant/components/AdvisoryCard.jsx',
        'frontend/src/hooks/use-conversation-history.js',
        'frontend/src/services/conversation-service.js',
        'frontend/src/pages/history/components/ChatHistoryRow.jsx',
      ].map((path) => readFile(new URL(path, repositoryRoot), 'utf8'))
    )

  assert.match(assistantPage, /persistAdvisorySearch: structuredSearch/)
  assert.match(chatMessage, /message\.advisories\?\.length > 0/)
  assert.match(advisoryCard, /target="_blank"/)
  assert.match(advisoryCard, /rel="noopener noreferrer"/)
  assert.match(historyHook, /serializeConversationMessage/)
  assert.match(historyHook, /deserializeConversationMessage/)
  assert.match(conversationService, /\.ilike\('title'/)
  assert.match(historyRow, /conversation\.title/)
  assert.equal(conversationService.includes(".ilike('content'"), false)
})

const clarificationSearch = {
  status: 'needs_clarification',
  message:
    'Which scam type, organisation, or suspicious behaviour would you like me to check for official advisories?',
  advisories: [],
}


test('a pending clarification round-trips so it survives refresh and reopen', () => {
  const stored = serializeConversationMessage({
    role: 'assistant',
    text: clarificationSearch.message,
    advisorySearch: clarificationSearch,
  })
  const restored = deserializeConversationMessage(stored, 'assistant')

  assert.ok(stored.startsWith(conversationMessageCodecConstants.prefix))
  assert.equal(restored.text, clarificationSearch.message)
  assert.equal(restored.advisorySearch.status, 'needs_clarification')
  // No cards for a clarification — only a matched response renders advisories.
  assert.equal('advisories' in restored, false)
})

test('a clarification envelope carrying advisories is rejected', () => {
  const stored = rewriteEnvelope(
    serializeConversationMessage({
      role: 'assistant',
      text: clarificationSearch.message,
      advisorySearch: clarificationSearch,
    }),
    (envelope) => {
      envelope.advisory_search.advisories = [advisories[0]]
    }
  )
  const restored = deserializeConversationMessage(stored, 'assistant')

  assert.deepEqual(restored, { text: clarificationSearch.message })
})

test('clarification continuity is derived from the transcript, not React state', async () => {
  const assistantPage = await readFile(
    new URL('frontend/src/pages/assistant/AssistantPage.jsx', new URL('../../', import.meta.url)),
    'utf8'
  )

  // Read from the persisted/rehydrated transcript...
  assert.match(assistantPage, /previousMessage\.advisorySearch\?\.status === 'needs_clarification'/)
  // ...and sent to the backend, which owns the routing decision.
  assert.match(assistantPage, /awaiting_advisory_topic: awaitingAdvisoryTopic/)
  // A clarification is persisted alongside a match, otherwise reload loses it.
  assert.match(assistantPage, /persistAdvisorySearch: structuredSearch/)
  // No transient flag may back this state.
  assert.equal(/useState\([^)]*awaitingAdvisory/i.test(assistantPage), false)
})

test('an attachment short-circuits before any advisory request is made', async () => {
  const assistantPage = await readFile(
    new URL('frontend/src/pages/assistant/AssistantPage.jsx', new URL('../../', import.meta.url)),
    'utf8'
  )

  const attachmentBranch = assistantPage.slice(
    assistantPage.indexOf('if (attachment) {'),
    assistantPage.indexOf('if (!text) return')
  )
  // Attachment routing stays type-driven and never reaches the advisory call,
  // so a pending clarification is simply left behind.
  assert.equal(attachmentBranch.includes('requestAssistantReply'), false)
  assert.match(attachmentBranch, /attachment\.type === 'image'/)
  assert.match(attachmentBranch, /attachment\.type === 'excel'/)
  assert.match(attachmentBranch, /isTransaction \? 'transaction' : 'screenshot'/)
})
