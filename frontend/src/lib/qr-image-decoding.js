// Decodes a QR image in the browser. The image is never uploaded — only the address the
// user confirms is sent on. The decoder is imported on demand to keep it out of the URL
// page's initial bundle.

import { parseWebAddress } from './web-address'

export const MAX_QR_IMAGE_MB = 10
export const MAX_QR_IMAGE_BYTES = MAX_QR_IMAGE_MB * 1024 * 1024

// Matches the length guard on /api/url/predict, so a QR code cannot submit a
// link the pasted-input path would have refused.
export const MAX_QR_URL_LENGTH = 2000

export const QR_MESSAGES = {
  noFile: 'Choose an image containing a QR code.',
  notAnImage: 'That file is not an image. Choose a photo or screenshot instead.',
  tooLarge: `That image is too large. Choose an image under ${MAX_QR_IMAGE_MB}MB.`,
  unreadableImage: "We couldn't read that image. Try a different photo or screenshot.",
  noQRCode: 'No QR code was found in that image. Try a clearer or closer photo.',
  unsupportedContent: 'This QR code does not contain a supported website link.',
}

export class QRDecodeError extends Error {
  constructor(message) {
    super(message)
    this.name = 'QRDecodeError'
  }
}

// Returns a user-facing message, or null if the file is worth decoding.
export function validateQRImageFile(file) {
  if (!file) return QR_MESSAGES.noFile
  if (!file.type || !file.type.startsWith('image/')) return QR_MESSAGES.notAnImage
  if (file.size > MAX_QR_IMAGE_BYTES) return QR_MESSAGES.tooLarge
  return null
}

export async function decodeQRImage(file, containerElementId) {
  const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode')

  const reader = new Html5Qrcode(containerElementId, {
    verbose: false,
    formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
    // Always use the bundled ZXing decoder, so decoding never depends on the
    // optional native BarcodeDetector.
    useBarCodeDetectorIfSupported: false,
  })

  try {
    return await reader.scanFile(file, false)
  } catch (failure) {
    // A broken image rejects with a DOM event, the decoder with its own text.
    // Neither reaches the user.
    throw new QRDecodeError(
      failure instanceof Event ? QR_MESSAGES.unreadableImage : QR_MESSAGES.noQRCode
    )
  } finally {
    // scanFile holds a blob URL for the image it just read, so release it here
    // rather than let the picked image outlive the dialog.
    reader.possiblyCloseLastScanImageFile?.()
    reader.clear()
  }
}

// Refused rather than cleaned up: the URL parser drops or rewrites these, which would let
// the hostname shown to the user differ from the string the detector receives.
const UNSAFE_URL_CHARACTERS = /[\s\\]/

// Accepts the same address forms as the pasted-link input. url stays exactly as scanned,
// so a scheme the QR did not carry is never sent to the detector.
export function parseQRWebsiteURL(decodedText) {
  const url = typeof decodedText === 'string' ? decodedText.trim() : ''

  if (!url || url.length > MAX_QR_URL_LENGTH) return null
  if (UNSAFE_URL_CHARACTERS.test(url)) return null

  const address = parseWebAddress(url)
  if (!address) return null

  const hostname = address.parsed.hostname

  // A QR can hold arbitrary text, so a scheme-less value must at least look like a domain.
  if (!address.hasScheme && !hostname.includes('.')) return null

  // Anything the parser mapped away — zero-width characters, a punycoded or numeric host
  // — would leave the user reading a different address from the one we check.
  if (!url.toLowerCase().includes(hostname)) return null

  return { url, hostname, hasScheme: address.hasScheme }
}
