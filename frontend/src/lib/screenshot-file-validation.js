export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
export const ACCEPTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp']
export const MAX_SIZE_BYTES = 10 * 1024 * 1024

export function isAcceptedFile(file) {
  if (!file) return false
  if (ACCEPTED_TYPES.includes(file.type)) return true
  const lowerName = file.name.toLowerCase()
  return ACCEPTED_EXTENSIONS.some((ext) => lowerName.endsWith(ext))
}

// Returns a user-facing error message, or null if the file is acceptable.
export function validateFile(file) {
  if (!file) return null
  if (!isAcceptedFile(file)) return 'Please choose a JPG or PNG image.'
  if (file.size > MAX_SIZE_BYTES) return 'That image is too large. Maximum size is 10MB.'
  return null
}
