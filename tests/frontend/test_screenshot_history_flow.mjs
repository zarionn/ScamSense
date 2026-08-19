/**
 * Screenshot history: page-level save / load / reopen behaviour.
 *
 * Drives the REAL handlers from ScreenshotScanPage.jsx through the shared
 * DOM-free harness. Assertions are on observable calls and state transitions,
 * never on source text. No Supabase, no network, no model.
 */

import assert from 'node:assert/strict'
import { register } from 'node:module'
import test from 'node:test'

register('./support/alias-hooks.mjs', import.meta.url)

const { loadComponent, createHookRuntime } = await import('./support/component-harness.mjs')
const { adaptScreenshotHistoryRow, toScreenshotHistoryEntry } = await import(
  new URL(
    '../../frontend/src/pages/screenshot/utils/history-result-adapter.js',
    import.meta.url
  )
)

const USER = { id: 'user-a-uuid' }

const STAGE1 = {
  classifier: { label: 'scam', scam_probability: 0.9971, confidence_pct: 99.71 },
  audit_status: 'available',
  effective_caution_level: 'high',
  exposure_questions: [
    {
      dimension: 'entered_credentials',
      question: 'Did you enter your login details?',
      severity: 'high',
      triggered_by: ['credential_request'],
      answer_options: ['yes', 'no', 'unsure'],
    },
  ],
  analysis_token: 'v1.signed.token',
}

const STAGE2 = {
  classifier: { label: 'scam', scam_probability: 0.9971, confidence_pct: 99.71 },
  audit: {
    content_type: 'login_page',
    observations: [],
    domain_analysis: { domain_visible: false },
    unclear_elements: [],
  },
  audit_status: 'available',
  audit_signals: ['credential_request'],
  display_observations: [],
  caution: { caution_level: 'high', caution_raised: true, triggered_rules: [] },
  effective_caution_level: 'high',
  risky: true,
  exposure_questions: STAGE1.exposure_questions,
  exposure_answers: { entered_credentials: 'yes' },
  confirmed_exposures: ['entered_credentials'],
  uncertain_exposures: [],
  defaulted_exposures: [],
  selected_exposures: ['entered_credentials'],
  required_actions: [{ text: 'Change your password.', urgency: 'now', theme: null }],
  response_source: 'gemini',
  response_message: 'This looks like a credential phishing page.',
  response_guard: 'verified',
  fallback_guard: null,
  related_official_advisories: [],
}

function storedRow(overrides = {}) {
  return {
    id: 'row-1',
    source_filename: 'saved.png',
    classifier_label: 'scam',
    scam_probability: 0.9971,
    effective_caution_level: 'high',
    analysis_result: STAGE2,
    created_at: '2026-08-19T10:00:00.000Z',
    ...overrides,
  }
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

async function createHarness({ user = USER, historyRows = [], historyError = null } = {}) {
  const calls = { fetch: [], saves: [], historyLoads: [], deletes: [], clears: [] }
  let saveShouldFail = null
  let deleteShouldFail = null

  globalThis.fetch = async (url, init) => {
    calls.fetch.push({ url, init })
    const body = url.includes('/api/analyse') ? STAGE1 : STAGE2
    return { ok: true, json: async () => body }
  }
  globalThis.URL.createObjectURL = () => 'blob:preview'
  globalThis.URL.revokeObjectURL = () => {}

  const runtime = createHookRuntime()
  const AssistantPage = await loadComponent({
    relativePath: 'frontend/src/pages/screenshot/ScreenshotScanPage.jsx',
    componentName: 'ScreenshotScanPage',
    exposedNames: [
      'handleFileSelected',
      'handleAnalyse',
      'handleAnswersSubmit',
      'handleOpenHistoryEntry',
      'handleReset',
      'phase',
      'file',
      'previewUrl',
      'finalResult',
      'historyEntries',
      'historyStatus',
      'hasResult',
      'resetLabel',
      'isHistoricalResult',
      'ResetIcon',
      'pendingDeleteEntry',
      'setPendingDeleteEntry',
      'isClearHistoryPending',
      'setIsClearHistoryPending',
      'handleConfirmDeleteEntry',
      'handleConfirmClearHistory',
      'historyActionError',
    ],
    injected: {
      ...runtime.hooks,
      // Icon components are chosen outside JSX, so the harness needs them.
      // Named sentinels let the icon choice itself be asserted.
      ArrowLeft: 'ArrowLeft',
      RefreshCw: 'RefreshCw',
      useAuth: () => ({ user }),
      getScreenshotScanHistory: async (userId, limit) => {
        calls.historyLoads.push({ userId, limit })
        if (historyError) throw historyError
        return historyRows
      },
      saveScreenshotScan: async (payload) => {
        calls.saves.push(payload)
        if (saveShouldFail) throw saveShouldFail
        return { id: 'inserted' }
      },
      deleteScreenshotScan: async (payload) => {
        calls.deletes.push(payload)
        if (deleteShouldFail) throw deleteShouldFail
      },
      clearScreenshotScanHistory: async (payload) => {
        calls.clears.push(payload)
        if (deleteShouldFail) throw deleteShouldFail
      },
      adaptScreenshotHistoryRow,
      toScreenshotHistoryEntry,
    },
  })

  runtime.mount(AssistantPage, {})
  await flush()
  runtime.render()

  return {
    calls,
    runtime,
    get state() {
      return runtime.current
    },
    failNextSave(error) {
      saveShouldFail = error
    },
    failNextDelete(error) {
      deleteShouldFail = error
    },
    async act(fn) {
      await fn(runtime.current)
      await flush()
      return runtime.render()
    },
  }
}

async function runLiveScan(harness) {
  await harness.act((s) => s.handleFileSelected({ name: 'suspicious.png' }))
  await harness.act((s) => s.handleAnalyse())
  await harness.act((s) => s.handleAnswersSubmit({ entered_credentials: 'yes' }))
}

// ---- Saving --------------------------------------------------------------

test('a signed-in Stage-2 completion makes exactly one save attempt', async () => {
  const harness = await createHarness()
  await runLiveScan(harness)

  assert.equal(harness.state.phase, 'result')
  assert.deepEqual(harness.state.finalResult, STAGE2)
  assert.equal(harness.calls.saves.length, 1)

  const [payload] = harness.calls.saves
  assert.equal(payload.userId, USER.id)
  assert.equal(payload.filename, 'suspicious.png')
  assert.deepEqual(payload.result, STAGE2)

  // Re-rendering the finished result must not save again.
  harness.runtime.render()
  harness.runtime.render()
  assert.equal(harness.calls.saves.length, 1)
})

test('Stage 1 alone never saves', async () => {
  const harness = await createHarness()
  await harness.act((s) => s.handleFileSelected({ name: 'suspicious.png' }))
  await harness.act((s) => s.handleAnalyse())

  assert.equal(harness.state.phase, 'questions')
  assert.equal(harness.calls.saves.length, 0)
})

test('a guest completes a scan and nothing is persisted or loaded', async () => {
  const harness = await createHarness({ user: null })
  await runLiveScan(harness)

  assert.equal(harness.state.phase, 'result')
  assert.deepEqual(harness.state.finalResult, STAGE2)
  assert.equal(harness.calls.saves.length, 0)
  assert.equal(harness.calls.historyLoads.length, 0)
  assert.equal(harness.state.historyStatus, 'idle')
})

test('a save failure leaves the successful result untouched', async () => {
  const harness = await createHarness()
  harness.failNextSave(new Error('supabase insert failed'))
  await runLiveScan(harness)

  assert.equal(harness.calls.saves.length, 1)
  // The scan is still successful and still on screen.
  assert.equal(harness.state.phase, 'result')
  assert.ok(harness.state.hasResult)
  assert.deepEqual(harness.state.finalResult, STAGE2)
})

test('a scan with no filename still saves, with filename undefined', async () => {
  const harness = await createHarness()
  await harness.act((s) => s.handleFileSelected({}))
  await harness.act((s) => s.handleAnalyse())
  await harness.act((s) => s.handleAnswersSubmit({ entered_credentials: 'no' }))

  assert.equal(harness.calls.saves.length, 1)
  assert.equal(harness.calls.saves[0].filename, undefined)
})

// ---- Loading -------------------------------------------------------------

test('history is loaded once for the signed-in user, newest-first and capped', async () => {
  const harness = await createHarness({ historyRows: [storedRow()] })

  assert.equal(harness.calls.historyLoads.length, 1)
  assert.equal(harness.calls.historyLoads[0].userId, USER.id)
  // The service owns ordering and the limit default; the page must not override.
  assert.equal(harness.calls.historyLoads[0].limit, undefined)
  assert.equal(harness.state.historyStatus, 'success')
  assert.equal(harness.state.historyEntries.length, 1)
  assert.equal(harness.state.historyEntries[0].displayName, 'saved.png')
})

test('a history fetch failure does not block scanning', async () => {
  const harness = await createHarness({ historyError: new Error('network down') })
  assert.equal(harness.state.historyStatus, 'error')

  await runLiveScan(harness)
  assert.equal(harness.state.phase, 'result')
  assert.deepEqual(harness.state.finalResult, STAGE2)
})

test('a malformed row stays listed but is marked unopenable', async () => {
  const harness = await createHarness({
    historyRows: [storedRow({ id: 'good' }), storedRow({ id: 'bad', analysis_result: {} })],
  })

  assert.equal(harness.state.historyEntries.length, 2)
  assert.deepEqual(
    harness.state.historyEntries.map((entry) => entry.isRestorable),
    [true, false]
  )

  // Attempting to open it must not change phase or call anything.
  await harness.act((s) => s.handleOpenHistoryEntry({ id: 'bad' }))
  assert.equal(harness.state.phase, 'upload')
  assert.equal(harness.calls.fetch.length, 0)
})

// ---- Reopening -----------------------------------------------------------

test('reopening restores the stored result with no analysis request', async () => {
  const harness = await createHarness({ historyRows: [storedRow()] })
  const fetchesBefore = harness.calls.fetch.length

  await harness.act((s) => s.handleOpenHistoryEntry({ id: 'row-1' }))

  assert.equal(harness.state.phase, 'result')
  assert.ok(harness.state.hasResult)
  assert.deepEqual(harness.state.finalResult, STAGE2)
  assert.equal(harness.state.file.name, 'saved.png')
  assert.equal(harness.state.previewUrl, null)

  // No /api/analyse, no /api/respond — reopening is pure state.
  assert.equal(harness.calls.fetch.length, fetchesBefore)
  assert.equal(harness.calls.fetch.length, 0)
  // And it must never write history back.
  assert.equal(harness.calls.saves.length, 0)
})

test('a reopened row with no filename shows the generic label', async () => {
  const harness = await createHarness({
    historyRows: [storedRow({ source_filename: null })],
  })
  await harness.act((s) => s.handleOpenHistoryEntry({ id: 'row-1' }))

  assert.equal(harness.state.file.name, 'Saved screenshot')
})

test('starting a new scan clears the reopened historical state', async () => {
  const harness = await createHarness({ historyRows: [storedRow()] })
  await harness.act((s) => s.handleOpenHistoryEntry({ id: 'row-1' }))
  assert.equal(harness.state.phase, 'result')

  await harness.act((s) => s.handleReset())

  assert.equal(harness.state.phase, 'upload')
  assert.equal(harness.state.finalResult, null)
  assert.equal(harness.state.file, null)
  assert.equal(harness.state.previewUrl, null)

  // The normal live flow still works afterwards.
  await runLiveScan(harness)
  assert.equal(harness.state.phase, 'result')
  assert.equal(harness.state.previewUrl, 'blob:preview')
  assert.equal(harness.calls.saves.length, 1)
})

// ---- Live flow regression ------------------------------------------------

test('the live upload -> questions -> result flow is unchanged', async () => {
  const harness = await createHarness()

  await harness.act((s) => s.handleFileSelected({ name: 'suspicious.png' }))
  assert.equal(harness.state.phase, 'upload')
  assert.equal(harness.state.previewUrl, 'blob:preview')

  await harness.act((s) => s.handleAnalyse())
  assert.equal(harness.state.phase, 'questions')
  assert.equal(harness.calls.fetch[0].url, '/api/analyse')

  await harness.act((s) => s.handleAnswersSubmit({ entered_credentials: 'yes' }))
  assert.equal(harness.state.phase, 'result')
  assert.equal(harness.calls.fetch[1].url, '/api/respond')
  assert.deepEqual(JSON.parse(harness.calls.fetch[1].init.body), {
    analysis_token: STAGE1.analysis_token,
    answers: { entered_credentials: 'yes' },
  })
})

// ---- Header button origin ------------------------------------------------

test('a live result keeps the New Scan label', async () => {
  const harness = await createHarness()
  await runLiveScan(harness)

  assert.equal(harness.state.isHistoricalResult, false)
  assert.equal(harness.state.resetLabel, 'New Scan')
  assert.equal(harness.state.ResetIcon, 'RefreshCw')
})

test('a reopened result switches the same button to Back to scans', async () => {
  const harness = await createHarness({ historyRows: [storedRow()] })
  assert.equal(harness.state.resetLabel, 'New Scan')

  await harness.act((s) => s.handleOpenHistoryEntry({ id: 'row-1' }))

  assert.equal(harness.state.isHistoricalResult, true)
  assert.equal(harness.state.resetLabel, 'Back to scans')
  // A refresh icon would misdescribe a back action.
  assert.equal(harness.state.ResetIcon, 'ArrowLeft')
})

test('returning from a reopened result restores live-scan wording and state', async () => {
  const harness = await createHarness({ historyRows: [storedRow()] })
  await harness.act((s) => s.handleOpenHistoryEntry({ id: 'row-1' }))
  assert.equal(harness.state.resetLabel, 'Back to scans')

  await harness.act((s) => s.handleReset())

  // No historical state survives the reset.
  assert.equal(harness.state.isHistoricalResult, false)
  assert.equal(harness.state.resetLabel, 'New Scan')
  assert.equal(harness.state.finalResult, null)
  assert.equal(harness.state.file, null)
  assert.equal(harness.state.previewUrl, null)

  // And the next live scan is a normal live scan.
  await runLiveScan(harness)
  assert.equal(harness.state.isHistoricalResult, false)
  assert.equal(harness.state.resetLabel, 'New Scan')
  assert.equal(harness.state.previewUrl, 'blob:preview')
  assert.deepEqual(harness.state.finalResult, STAGE2)
})

test('selecting a new file clears historical origin without a full reset', async () => {
  const harness = await createHarness({ historyRows: [storedRow()] })
  await harness.act((s) => s.handleOpenHistoryEntry({ id: 'row-1' }))
  assert.equal(harness.state.isHistoricalResult, true)

  await harness.act((s) => s.handleFileSelected({ name: 'next.png' }))

  assert.equal(harness.state.isHistoricalResult, false)
  assert.equal(harness.state.resetLabel, 'New Scan')
  assert.equal(harness.state.finalResult, null)
})

// ---- Deleting ------------------------------------------------------------

test('a confirmed row delete issues exactly one scoped delete', async () => {
  const harness = await createHarness({
    historyRows: [storedRow({ id: 'row-1' }), storedRow({ id: 'row-2' })],
  })

  await harness.act((s) => s.setPendingDeleteEntry(harness.state.historyEntries[0]))
  assert.equal(harness.calls.deletes.length, 0, 'nothing before confirmation')

  await harness.act((s) => s.handleConfirmDeleteEntry())

  assert.equal(harness.calls.deletes.length, 1)
  // userId comes from auth state, never from the entry.
  assert.deepEqual(harness.calls.deletes[0], { userId: USER.id, id: 'row-1' })
  // Optimistic: the row is gone immediately, with no refetch.
  assert.deepEqual(
    harness.state.historyEntries.map((entry) => entry.id),
    ['row-2']
  )
  assert.equal(harness.calls.historyLoads.length, 1, 'no refetch after delete')
})

test('cancelling the confirmation issues no request', async () => {
  const harness = await createHarness({ historyRows: [storedRow()] })

  await harness.act((s) => s.setPendingDeleteEntry(harness.state.historyEntries[0]))
  // Closing the dialog is what cancel does.
  await harness.act((s) => s.setPendingDeleteEntry(null))

  assert.equal(harness.calls.deletes.length, 0)
  assert.equal(harness.calls.clears.length, 0)
  assert.equal(harness.state.historyEntries.length, 1)
})

test('a confirmed clear-all issues exactly one request scoped to the user', async () => {
  const harness = await createHarness({
    historyRows: [storedRow({ id: 'a' }), storedRow({ id: 'b' })],
  })

  await harness.act((s) => s.setIsClearHistoryPending(true))
  assert.equal(harness.calls.clears.length, 0)

  await harness.act((s) => s.handleConfirmClearHistory())

  assert.equal(harness.calls.clears.length, 1)
  assert.deepEqual(harness.calls.clears[0], { userId: USER.id })
  // Last rows gone: the section collapses via the existing empty state.
  assert.equal(harness.state.historyEntries.length, 0)
  assert.equal(harness.calls.historyLoads.length, 1, 'no refetch after clear')
})

test('a guest performs no delete and no clear', async () => {
  const harness = await createHarness({ user: null, historyRows: [storedRow()] })

  await harness.act((s) => s.setPendingDeleteEntry({ id: 'row-1', displayName: 'x' }))
  await harness.act((s) => s.handleConfirmDeleteEntry())
  await harness.act((s) => s.handleConfirmClearHistory())

  assert.equal(harness.calls.deletes.length, 0)
  assert.equal(harness.calls.clears.length, 0)
})

test('a delete failure restores the row and shows a plain-language message', async () => {
  const harness = await createHarness({
    historyRows: [storedRow({ id: 'row-1' }), storedRow({ id: 'row-2' })],
  })
  harness.failNextDelete(new Error('permission denied for table'))

  await harness.act((s) => s.setPendingDeleteEntry(harness.state.historyEntries[0]))
  await harness.act((s) => s.handleConfirmDeleteEntry())

  // Row is back.
  assert.deepEqual(
    harness.state.historyEntries.map((entry) => entry.id),
    ['row-1', 'row-2']
  )
  // No raw Supabase text reaches the user.
  assert.equal(harness.state.historyActionError, "We couldn't delete that scan. Please try again.")
  assert.equal(harness.state.historyActionError.includes('permission denied'), false)
  // Restored from the snapshot, not by refetching.
  assert.equal(harness.calls.historyLoads.length, 1)
})

test('a delete failure leaves the live scan flow working', async () => {
  const harness = await createHarness({ historyRows: [storedRow({ id: 'row-1' })] })
  harness.failNextDelete(new Error('permission denied'))

  await harness.act((s) => s.setPendingDeleteEntry(harness.state.historyEntries[0]))
  await harness.act((s) => s.handleConfirmDeleteEntry())

  await runLiveScan(harness)
  assert.equal(harness.state.phase, 'result')
  assert.deepEqual(harness.state.finalResult, STAGE2)
})

test('deleting the currently-open result leaves it on screen without crashing', async () => {
  const harness = await createHarness({ historyRows: [storedRow({ id: 'row-1' })] })
  await harness.act((s) => s.handleOpenHistoryEntry({ id: 'row-1' }))
  assert.equal(harness.state.phase, 'result')

  await harness.act((s) => s.setPendingDeleteEntry({ id: 'row-1', displayName: 'saved.png' }))
  await harness.act((s) => s.handleConfirmDeleteEntry())

  // Deliberate: the open result stays until the user navigates away.
  assert.equal(harness.state.phase, 'result')
  assert.deepEqual(harness.state.finalResult, STAGE2)
  assert.equal(harness.state.historyEntries.length, 0)

  // And going back lands on an empty history without error.
  await harness.act((s) => s.handleReset())
  assert.equal(harness.state.phase, 'upload')
  assert.equal(harness.state.historyEntries.length, 0)
})
