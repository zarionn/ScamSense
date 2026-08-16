export async function checkURL(url) {
  let response

  try {
    response = await fetch('/api/url/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    })
  } catch {
    throw new Error('Could not reach the server. Check your connection and try again.')
  }

  let data
  try {
    data = await response.json()
  } catch {
    throw new Error('The server sent back an unexpected response. Please try again.')
  }

  if (!response.ok) {
    throw new Error(data?.error || 'Something went wrong while checking this link.')
  }

  return data
}
