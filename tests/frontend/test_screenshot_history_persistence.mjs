/**
 * Screenshot history: persisted payload and stored-result restoration.
 *
 * These exercise the real service/adapter modules directly — no Supabase, no
 * network, no model. The page-level flow is covered separately in
 * test_screenshot_history_flow.mjs.
 */

import assert from 'node:assert/strict'
import { register } from 'node:module'
import test from 'node:test'

// Resolves the "@/" alias and swaps in the recording Supabase stub, so the real
// service and adapter modules load with their real import graph.
register('./support/alias-hooks.mjs', import.meta.url)

const service = await import(
  new URL('../../frontend/src/services/screenshot-scan-service.js', import.meta.url)
)
const adapter = await import(
  new URL(
    '../../frontend/src/pages/screenshot/utils/history-result-adapter.js',
    import.meta.url
  )
)

const { buildScreenshotScanRow, normaliseSourceFilename } = service
const {
  adaptScreenshotHistoryRow,
  toScreenshotHistoryEntry,
  isRestorableScreenshotResult,
  HISTORY_FALLBACK_FILENAME,
} = adapter

const USER_ID = '11111111-2222-3333-4444-555555555555'

// Shaped exactly like a real Stage-2 response (see contracts.py / pipeline.py).
function stage2Response(overrides = {}) {
  return {
    classifier: { label: 'scam', scam_probability: 0.9971, confidence_pct: 99.71 },
    audit: {
      content_type: 'login_page',
      observations: [
        {
          signal_type: 'credential_request',
          evidence: "A form labelled 'Singpass ID' is visible.",
          evidence_quality: 'clear',
        },
      ],
      domain_analysis: {
        domain_visible: true,
        visible_domain: 'singpass-verify.example',
        claimed_entity: 'Singpass',
        domain_readability: 'clear',
        domain_relationship: 'mismatch',
        evidence: 'Address bar reads singpass-verify.example.',
      },
      unclear_elements: [],
    },
    audit_status: 'available',
    audit_signals: ['credential_request'],
    display_observations: [
      {
        signal_type: 'credential_request',
        evidence: "A form labelled 'Singpass ID' is visible.",
        evidence_quality: 'clear',
      },
    ],
    caution: {
      caution_level: 'high',
      caution_raised: true,
      triggered_rules: ['DOMAIN_MISMATCH_CREDENTIALS'],
    },
    effective_caution_level: 'high',
    risky: true,
    exposure_questions: [
      {
        dimension: 'entered_credentials',
        question: 'Did you enter your login details?',
        severity: 'high',
        triggered_by: ['credential_request'],
        answer_options: ['yes', 'no', 'unsure'],
      },
    ],
    exposure_answers: { entered_credentials: 'yes' },
    confirmed_exposures: ['entered_credentials'],
    uncertain_exposures: [],
    defaulted_exposures: [],
    selected_exposures: ['entered_credentials'],
    required_actions: [
      { text: 'Change your Singpass password.', urgency: 'now', theme: 'credentials' },
    ],
    response_source: 'gemini',
    response_message: 'This screenshot shows a login page requesting credentials.',
    response_guard: 'verified',
    fallback_guard: null,
    related_official_advisories: [],
    ...overrides,
  }
}

// ---- Persisted payload ----------------------------------------------------

test('insert payload contains exactly the approved columns', () => {
  const row = buildScreenshotScanRow({
    userId: USER_ID,
    filename: 'suspicious.png',
    result: stage2Response(),
  })

  assert.deepEqual(Object.keys(row).sort(), [
    'analysis_result',
    'classifier_label',
    'effective_caution_level',
    'scam_probability',
    'source_filename',
    'user_id',
  ])
  assert.equal(row.user_id, USER_ID)
  assert.equal(row.classifier_label, 'scam')
  assert.equal(row.scam_probability, 0.9971)
  assert.equal(row.effective_caution_level, 'high')
  // id and created_at are left to the database defaults.
  assert.equal('id' in row, false)
  assert.equal('created_at' in row, false)
})

test('analysis_result is the complete Stage-2 response, not a subset', () => {
  const result = stage2Response()
  const row = buildScreenshotScanRow({ userId: USER_ID, filename: 'a.png', result })

  assert.deepEqual(row.analysis_result, result)
  // Spot-check fields ResultView never reads, proving nothing was hand-picked.
  assert.deepEqual(row.analysis_result.audit_signals, ['credential_request'])
  assert.equal(row.analysis_result.response_source, 'gemini')
  assert.deepEqual(row.analysis_result.selected_exposures, ['entered_credentials'])
})

test('no image data of any kind reaches the persisted payload', () => {
  const row = buildScreenshotScanRow({
    userId: USER_ID,
    filename: 'shot.png',
    result: stage2Response(),
  })
  const serialised = JSON.stringify(row)

  for (const forbidden of [
    'data:',
    'base64',
    'blob:',
    'previewUrl',
    'preview_url',
    'analysis_token',
    'objectUrl',
  ]) {
    assert.equal(serialised.includes(forbidden), false, `payload leaked ${forbidden}`)
  }
})

test('filename is cleaned, capped, and null when unusable', () => {
  assert.equal(normaliseSourceFilename('  shot.png  '), 'shot.png')
  assert.equal(normaliseSourceFilename(''), null)
  assert.equal(normaliseSourceFilename('   '), null)
  assert.equal(normaliseSourceFilename(undefined), null)
  assert.equal(normaliseSourceFilename(null), null)
  assert.equal(normaliseSourceFilename('a'.repeat(500)).length, 200)

  const row = buildScreenshotScanRow({
    userId: USER_ID,
    filename: undefined,
    result: stage2Response(),
  })
  assert.equal(row.source_filename, null)
})

test('a result that could not satisfy the table constraints yields no row', () => {
  const cases = {
    'missing classifier': stage2Response({ classifier: undefined }),
    'bad label': stage2Response({
      classifier: { label: 'phishy', scam_probability: 0.5, confidence_pct: 50 },
    }),
    'probability > 1': stage2Response({
      classifier: { label: 'scam', scam_probability: 1.5, confidence_pct: 50 },
    }),
    NaN: stage2Response({
      classifier: { label: 'scam', scam_probability: Number.NaN, confidence_pct: 50 },
    }),
    'bad caution': stage2Response({ effective_caution_level: 'extreme' }),
  }

  for (const [name, result] of Object.entries(cases)) {
    assert.equal(
      buildScreenshotScanRow({ userId: USER_ID, filename: 'a.png', result }),
      null,
      name
    )
  }
  assert.equal(
    buildScreenshotScanRow({ userId: null, filename: 'a.png', result: stage2Response() }),
    null
  )
})

// ---- Restoring a stored row ----------------------------------------------

function storedRow(overrides = {}) {
  const result = stage2Response()
  return {
    id: 'row-1',
    source_filename: 'suspicious.png',
    classifier_label: result.classifier.label,
    scam_probability: result.classifier.scam_probability,
    effective_caution_level: result.effective_caution_level,
    analysis_result: result,
    created_at: '2026-08-19T10:00:00.000Z',
    ...overrides,
  }
}

test('a stored row restores the state a live scan produces', () => {
  const row = storedRow()
  const restored = adaptScreenshotHistoryRow(row)

  assert.equal(restored.file.name, 'suspicious.png')
  assert.equal(restored.previewUrl, null)
  // Full fidelity: every field ResultView reads survives the round trip.
  assert.deepEqual(restored.result, row.analysis_result)
  assert.equal(restored.result.classifier.label, 'scam')
  assert.equal(restored.result.effective_caution_level, 'high')
  assert.deepEqual(restored.result.display_observations, row.analysis_result.display_observations)
  assert.deepEqual(restored.result.audit.domain_analysis, row.analysis_result.audit.domain_analysis)
  assert.deepEqual(restored.result.confirmed_exposures, ['entered_credentials'])
  assert.deepEqual(restored.result.required_actions, row.analysis_result.required_actions)
  assert.equal(restored.result.response_message, row.analysis_result.response_message)
  assert.equal(restored.result.response_guard, 'verified')
  assert.equal(restored.result.fallback_guard, null)
})

test('a missing filename falls back to the generic label', () => {
  assert.equal(
    adaptScreenshotHistoryRow(storedRow({ source_filename: null })).file.name,
    HISTORY_FALLBACK_FILENAME
  )
  assert.equal(
    toScreenshotHistoryEntry(storedRow({ source_filename: null })).displayName,
    HISTORY_FALLBACK_FILENAME
  )
})

test('malformed stored results fail safely instead of reaching ResultView', () => {
  const malformed = [
    null,
    'not-an-object',
    {},
    { classifier: null },
    { classifier: { label: 'scam' } },
    stage2Response({ classifier: { label: 'nope', scam_probability: 0.5, confidence_pct: 50 } }),
    stage2Response({
      classifier: { label: 'scam', scam_probability: Number.NaN, confidence_pct: 50 },
    }),
    stage2Response({ effective_caution_level: 'extreme' }),
    stage2Response({ response_message: '' }),
    stage2Response({ response_message: undefined }),
  ]

  for (const analysis_result of malformed) {
    assert.equal(isRestorableScreenshotResult(analysis_result), false)
    assert.equal(adaptScreenshotHistoryRow(storedRow({ analysis_result })), null)
  }
})

test('one malformed row does not remove the other rows from the list', () => {
  const rows = [storedRow({ id: 'ok-1' }), storedRow({ id: 'bad', analysis_result: {} }), storedRow({ id: 'ok-2' })]
  const entries = rows.map(toScreenshotHistoryEntry).filter(Boolean)

  assert.equal(entries.length, 3)
  assert.deepEqual(
    entries.map((entry) => entry.isRestorable),
    [true, false, true]
  )
})

test('list entries reuse the backend confidence definition', () => {
  // max(p, 1-p) * 100, exactly as classify() computes confidence_pct.
  assert.equal(toScreenshotHistoryEntry(storedRow()).confidencePct, 99.71)
  const legitimate = storedRow({ scam_probability: 0.02 })
  assert.equal(Math.round(toScreenshotHistoryEntry(legitimate).confidencePct), 98)
})

// ---- Supabase query shape -------------------------------------------------

const { supabase: _supabase, supabaseCalls, supabaseData, supabaseFailure } = await import(
  './support/supabase-stub.mjs'
)

test('the history query filters by user, orders newest-first and caps at 20', async () => {
  supabaseCalls.reset()
  supabaseData.rows = [storedRow()]

  const rows = await service.getScreenshotScanHistory(USER_ID)

  assert.equal(supabaseCalls.selects.length, 1)
  const [query] = supabaseCalls.selects
  assert.equal(query.table, 'screenshot_scan_history')
  assert.deepEqual(query.filters, { user_id: USER_ID })
  assert.deepEqual(query.order, { column: 'created_at', ascending: false })
  assert.equal(query.limit, 20)
  // analysis_result is needed to reopen; nothing beyond the approved columns.
  assert.match(query.columns, /analysis_result/)
  assert.equal(rows.length, 1)
})

test('a guest user id never reaches Supabase', async () => {
  supabaseCalls.reset()
  assert.deepEqual(await service.getScreenshotScanHistory(null), [])
  assert.equal(supabaseCalls.selects.length, 0)
})

test('saving inserts one approved row into the history table', async () => {
  supabaseCalls.reset()

  await service.saveScreenshotScan({
    userId: USER_ID,
    filename: 'shot.png',
    result: stage2Response(),
  })

  assert.equal(supabaseCalls.inserts.length, 1)
  assert.equal(supabaseCalls.inserts[0].table, 'screenshot_scan_history')
  assert.deepEqual(Object.keys(supabaseCalls.inserts[0].row).sort(), [
    'analysis_result',
    'classifier_label',
    'effective_caution_level',
    'scam_probability',
    'source_filename',
    'user_id',
  ])
})

test('an unpersistable result never reaches Supabase', async () => {
  supabaseCalls.reset()

  await assert.rejects(
    service.saveScreenshotScan({
      userId: USER_ID,
      filename: 'shot.png',
      result: stage2Response({ effective_caution_level: 'extreme' }),
    }),
    /not persistable/
  )
  assert.equal(supabaseCalls.inserts.length, 0)
})

test('a Supabase insert error surfaces so the caller can log it', async () => {
  supabaseCalls.reset()
  supabaseFailure.insert = new Error('row-level security violation')

  await assert.rejects(
    service.saveScreenshotScan({
      userId: USER_ID,
      filename: 'shot.png',
      result: stage2Response(),
    }),
    /row-level security violation/
  )
  supabaseFailure.insert = null
})

// ---- Delete queries -------------------------------------------------------

test('deleting one scan scopes the query to both the row id and the user', async () => {
  supabaseCalls.reset()

  await service.deleteScreenshotScan({ userId: USER_ID, id: 'row-1' })

  assert.equal(supabaseCalls.deletes.length, 1)
  assert.equal(supabaseCalls.deletes[0].table, 'screenshot_scan_history')
  // Scoped on user_id as well as id, so an unscoped delete is impossible here.
  assert.deepEqual(supabaseCalls.deletes[0].filters, {
    user_id: USER_ID,
    id: 'row-1',
  })
})

test('clearing history scopes the query to the user', async () => {
  supabaseCalls.reset()

  await service.clearScreenshotScanHistory({ userId: USER_ID })

  assert.equal(supabaseCalls.deletes.length, 1)
  assert.deepEqual(supabaseCalls.deletes[0].filters, { user_id: USER_ID })
})

test('a guest never reaches Supabase for either delete', async () => {
  supabaseCalls.reset()

  await service.deleteScreenshotScan({ userId: null, id: 'row-1' })
  await service.clearScreenshotScanHistory({ userId: null })
  await service.deleteScreenshotScan({ userId: USER_ID, id: null })

  assert.equal(supabaseCalls.deletes.length, 0)
})

test('a Supabase delete error surfaces so the caller can restore the row', async () => {
  supabaseCalls.reset()
  supabaseFailure.delete = new Error('row-level security violation')

  await assert.rejects(
    service.deleteScreenshotScan({ userId: USER_ID, id: 'row-1' }),
    /row-level security violation/
  )
  supabaseFailure.delete = null
})

test('the service exposes no update or edit path', () => {
  const exported = Object.keys(service)

  for (const name of exported) {
    assert.equal(
      /update|edit|patch|archive|restore/i.test(name),
      false,
      `unexpected mutating export: ${name}`
    )
  }
  assert.equal(supabaseCalls.updates.length, 0)
})
