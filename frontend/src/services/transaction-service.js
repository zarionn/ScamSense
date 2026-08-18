export async function checkTransaction(payload) {
  let response

  try {
    response = await fetch('/api/transaction/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch {
    throw new Error('Could not reach the server. Please try again.')
  }

  let data
  try {
    data = await response.json()
  } catch {
    throw new Error('The server returned an invalid response.')
  }

  if (!response.ok) {
    throw new Error(data?.error || 'Something went wrong while checking the transaction.')
  }

  return data
}