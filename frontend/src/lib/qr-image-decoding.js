// Decodes a QR image in the browser. The image is never uploaded — only the address the
// user confirms is sent on. The decoder is imported on demand to keep it out of the URL
// page's initial bundle.

import { parseSupportedWebAddress } from './web-address'

export const MAX_QR_IMAGE_MB = 10
export const MAX_QR_IMAGE_BYTES = MAX_QR_IMAGE_MB * 1024 * 1024

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

// A QR can hold arbitrary text, so the decoded value goes through the same website-address
// contract as a pasted link. url stays exactly as scanned, so a scheme the QR did not
// carry is never sent to the detector.
export function parseQRWebsiteURL(decodedText) {
  return parseSupportedWebAddress(decodedText)
}
