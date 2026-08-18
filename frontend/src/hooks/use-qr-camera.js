// Live-camera scanner for the QR dialog. Frames are decoded on the device and never
// uploaded; only the address the user confirms is sent on.

import { useCallback, useEffect, useRef, useState } from 'react'

export const CAMERA_MESSAGES = {
  insecure: 'Live camera scanning requires HTTPS. You can still upload a QR image.',
  unsupported: 'This browser cannot open a live camera. You can still upload a QR image.',
  denied: 'Camera access was not allowed. You can try again or upload a QR image.',
  notFound: 'No camera was found on this device.',
  busy: 'The camera may be in use by another application.',
  startFailed: "We couldn't start the camera. You can try again or upload a QR image.",
  switchFailed: "We couldn't switch to that camera. Try starting the camera again.",
}

const SCAN_CONFIG = {
  fps: 10,
  // A function rather than a fixed box, so the frame still fits a 375px-wide dialog.
  qrbox: (viewfinderWidth, viewfinderHeight) => {
    const size = Math.floor(Math.min(viewfinderWidth, viewfinderHeight) * 0.7)
    return { width: size, height: size }
  },
}

export function getCameraAvailability() {
  if (typeof window === 'undefined') return 'unsupported'
  // True on https and on localhost, false for a phone opening a LAN IP over http.
  if (!window.isSecureContext) return 'insecure'
  if (!navigator.mediaDevices?.getUserMedia) return 'unsupported'
  return 'available'
}

// html5-qrcode rejects with a string that embeds the DOMException name, so the cause is
// classified from that text and the text itself is never shown.
function messageForFailure(failure, isSwitching) {
  const detail = typeof failure === 'string' ? failure : String(failure?.name ?? '')

  if (/NotAllowedError|PermissionDenied|SecurityError/i.test(detail)) return CAMERA_MESSAGES.denied
  if (/NotReadableError|TrackStartError/i.test(detail)) return CAMERA_MESSAGES.busy
  if (isSwitching) return CAMERA_MESSAGES.switchFailed
  if (/NotFoundError|DevicesNotFound|OverconstrainedError/i.test(detail)) {
    return CAMERA_MESSAGES.notFound
  }
  return CAMERA_MESSAGES.startFailed
}

// stop() throws when the scanner is not running, and clear() throws when nothing was
// rendered, so both are guarded to keep cleanup safe to call repeatedly.
async function releaseScanner(scanner) {
  if (!scanner) return
  try {
    await scanner.stop()
  } catch {
    // Already stopped.
  }
  try {
    scanner.clear()
  } catch {
    // Nothing rendered.
  }
}

export function useQRCamera({ containerId, onDecoded }) {
  const [state, setState] = useState('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [cameras, setCameras] = useState([])
  const [activeCameraId, setActiveCameraId] = useState('')

  const scannerRef = useRef(null)
  // Bumped by every stop or start request; a start that resolves against a stale token
  // belongs to a cancelled attempt and shuts its own camera down.
  const runTokenRef = useRef(0)
  const hasResultRef = useRef(false)
  const onDecodedRef = useRef(onDecoded)
  onDecodedRef.current = onDecoded

  const releaseActive = useCallback(async () => {
    const scanner = scannerRef.current
    scannerRef.current = null
    await releaseScanner(scanner)
  }, [])

  const stop = useCallback(async () => {
    runTokenRef.current += 1
    await releaseActive()
  }, [releaseActive])

  const reset = useCallback(async () => {
    await stop()
    setState('idle')
    setErrorMessage('')
    setCameras([])
    setActiveCameraId('')
  }, [stop])

  const listCameras = useCallback(async (scanner) => {
    // enumerateDevices() rather than Html5Qrcode.getCameras(): labels are already
    // available once permission is granted, and it opens no second stream.
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      const videoInputs = devices.filter((device) => device.kind === 'videoinput')
      setCameras(
        videoInputs.map((device, index) => ({
          id: device.deviceId,
          label: device.label || `Camera ${index + 1}`,
        }))
      )
    } catch {
      setCameras([])
    }

    try {
      setActiveCameraId(scanner.getRunningTrackSettings()?.deviceId || '')
    } catch {
      setActiveCameraId('')
    }
  }, [])

  const start = useCallback(
    async (cameraId) => {
      const availability = getCameraAvailability()
      if (availability !== 'available') {
        setErrorMessage(CAMERA_MESSAGES[availability])
        setState('idle')
        return
      }

      const isSwitching = Boolean(cameraId)
      // Claimed before any await, so a second Start in the same tick supersedes this
      // attempt rather than both reading the same token and opening two cameras.
      const token = (runTokenRef.current += 1)
      hasResultRef.current = false
      setErrorMessage('')
      setState(isSwitching ? 'switching' : 'starting')

      await releaseActive()
      if (token !== runTokenRef.current) return

      let scanner = null
      try {
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode')
        if (token !== runTokenRef.current) return

        scanner = new Html5Qrcode(containerId, {
          verbose: false,
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
          useBarCodeDetectorIfSupported: false,
        })

        await scanner.start(
          // Never audio, and a non-strict facing preference so single-camera laptops
          // still start instead of failing an exact constraint.
          cameraId ? { deviceId: { exact: cameraId } } : { facingMode: 'environment' },
          SCAN_CONFIG,
          (decodedText) => {
            if (hasResultRef.current) return
            hasResultRef.current = true
            setState('stopping')
            void stop().then(() => {
              setState('idle')
              onDecodedRef.current(decodedText)
            })
          },
          // Per-frame decode misses are ignored: they are not errors worth rendering.
          undefined
        )
      } catch (failure) {
        await releaseScanner(scanner)
        if (token !== runTokenRef.current) return
        setErrorMessage(messageForFailure(failure, isSwitching))
        setState('idle')
        return
      }

      // Cancelled while the camera was opening, so shut down what just started.
      if (token !== runTokenRef.current) {
        await releaseScanner(scanner)
        return
      }

      scannerRef.current = scanner
      setState('active')
      void listCameras(scanner)
    },
    [containerId, listCameras, releaseActive, stop]
  )

  useEffect(() => {
    // A backgrounded tab keeps the camera light on, so release it. Restarting stays a
    // deliberate user action.
    function handleVisibilityChange() {
      if (document.visibilityState === 'hidden' && scannerRef.current) {
        void stop().then(() => setState('idle'))
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      void stop()
    }
  }, [stop])

  return { state, errorMessage, cameras, activeCameraId, start, stop, reset }
}
