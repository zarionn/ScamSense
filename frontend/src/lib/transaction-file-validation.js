export const ACCEPTED_TRANSACTION_TYPES = [
  'text/csv',
]
export const ACCEPTED_TRANSACTION_EXTENSIONS = ['.csv']
export const MAX_SIZE_BYTES = 10 * 1024 * 1024

export function isAcceptedTransactionFile(file) {
  if (!file) return false
  if (ACCEPTED_TRANSACTION_TYPES.includes(file.type)) return true
  const lowerName = file.name.toLowerCase()
  return ACCEPTED_TRANSACTION_EXTENSIONS.some((ext) => lowerName.endsWith(ext))
}

export function validateTransactionFile(file) {
  if (!file) return null
  if (!isAcceptedTransactionFile(file)) return 'Please choose a CSV or Excel file.'
  if (file.size > MAX_SIZE_BYTES) return 'That file is too large. Maximum size is 10MB.'
  return null
}