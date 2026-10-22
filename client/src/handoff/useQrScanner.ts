import { useEffect, useRef, useState, type RefObject } from 'react'

// Reads QR codes from the camera: getUserMedia into a <video>, frames drawn to
// an offscreen canvas and decoded with jsQR (works on every browser, unlike
// BarcodeDetector). jsQR is loaded on first use to keep it out of the main
// bundle. Camera access needs HTTPS or localhost.

const SCAN_INTERVAL_MS = 200

export type ScannerStatus = 'starting' | 'scanning' | 'unavailable' | 'denied'

const cameraSupported = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia

/** While `active`, scans and calls `onResult` once per code found, then stops until re-activated. */
export function useQrScanner(video: RefObject<HTMLVideoElement | null>, active: boolean, onResult: (text: string) => void) {
  const [status, setStatus] = useState<ScannerStatus>('starting')

  // Latest callback without restarting the camera when the parent re-renders.
  const onResultRef = useRef(onResult)
  useEffect(() => {
    onResultRef.current = onResult
  })

  useEffect(() => {
    const el = video.current
    if (!active || !el || !cameraSupported) return

    let stream: MediaStream | null = null
    let timer: number | undefined
    let stopped = false
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d', { willReadFrequently: true })

    function startDecoding(jsQR: typeof import('jsqr').default) {
      function tick() {
        if (stopped || !el || !ctx) return
        if (el.readyState >= el.HAVE_ENOUGH_DATA && el.videoWidth > 0) {
          canvas.width = el.videoWidth
          canvas.height = el.videoHeight
          ctx.drawImage(el, 0, 0, canvas.width, canvas.height)
          const image = ctx.getImageData(0, 0, canvas.width, canvas.height)
          const code = jsQR(image.data, image.width, image.height, { inversionAttempts: 'dontInvert' })
          if (code?.data) {
            stopped = true
            onResultRef.current(code.data)
            return
          }
        }
        timer = window.setTimeout(tick, SCAN_INTERVAL_MS)
      }
      tick()
    }

    Promise.all([navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false }), import('jsqr')])
      .then(async ([s, { default: jsQR }]) => {
        stream = s
        if (stopped) {
          s.getTracks().forEach((t) => t.stop())
          return
        }
        el.srcObject = s
        await el.play().catch(() => {})
        setStatus('scanning')
        startDecoding(jsQR)
      })
      .catch((err: unknown) => {
        if (stopped) return
        const name = err instanceof DOMException ? err.name : ''
        setStatus(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'unavailable')
      })

    return () => {
      stopped = true
      window.clearTimeout(timer)
      stream?.getTracks().forEach((t) => t.stop())
      el.srcObject = null
    }
  }, [active, video])

  return cameraSupported ? status : 'unavailable'
}
