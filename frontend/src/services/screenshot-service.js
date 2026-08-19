// Screenshot Scan requests, shared by the Screenshot page and the Assistant
// orchestrator so both stages use one implementation.

async function parseJsonResponse(response) {
  let data = null
  try {
    data = await response.json()
  } catch {
    throw new Error('The server sent back an unexpected response. Please try again.')
  }
  if (!response.ok) {
    throw new Error(data?.error || 'Something went wrong. Please try again.')
  }
  return data
}

// Stage 1. Returns the authoritative classifier result, the caution decision and
// any exposure questions, plus the signed analysis_token stage 2 needs.
export async function analyseScreenshot(file) {
  const formData = new FormData()
  formData.append('file', file)

  let response
  try {
    response = await fetch('/api/analyse', {
      method: 'POST',
      body: formData,
    })
  } catch {
    throw new Error(
      'Could not reach the server. Check your internet connection and try again.'
    )
  }
  return parseJsonResponse(response)
}

// Stage 2. `answers` must be the user's real answers — the backend rejects a
// set that does not match the questions it issued.
export async function respondToAnalysis(analysisToken, answers) {
  let response
  try {
    response = await fetch('/api/respond', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ analysis_token: analysisToken, answers }),
    })
  } catch {
    throw new Error(
      'Could not reach the server. Check your internet connection and try again.'
    )
  }
  return parseJsonResponse(response)
}
