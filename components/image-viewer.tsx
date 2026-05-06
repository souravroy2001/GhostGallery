'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

interface GalleryImage {
  id: string
  pathname: string
  filename: string
}

interface GalleryData {
  id: string
  title: string
  watermarkText: string
  images: GalleryImage[]
}

interface ImageViewerProps {
  token: string
}

function WatermarkCanvas({ 
  src, 
  sessionId, 
  visible, 
  watermarkText 
}: { 
  src: string, 
  sessionId: string, 
  visible: boolean, 
  watermarkText: string 
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!src || !visible) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const img = new Image()
    img.crossOrigin = "anonymous" // Important for CORS if loading from external origin
    img.onload = () => {
      canvas.width = img.width
      canvas.height = img.height
      ctx.drawImage(img, 0, 0)
      
      // Watermark overlay
      if (watermarkText && watermarkText !== 'disabled' && watermarkText !== '__disabled__') {
        ctx.save()
        ctx.globalAlpha = 0.35
        ctx.fillStyle = "#ff3b5c" // GhostGallery accent2
        ctx.font = `bold ${Math.max(14, img.width / 40)}px 'Space Mono', monospace`
        ctx.textAlign = "center"
        
        const ts = new Date().toISOString()
        const sid = sessionId ? sessionId.slice(0, 8).toUpperCase() : "UNKNOWN"
        const lines = [`⚠ ${watermarkText.toUpperCase()} ⚠`, `Session: ${sid}`, ts]
        
        // Diagonal tiled watermarks
        ctx.translate(canvas.width / 2, canvas.height / 2)
        ctx.rotate(-Math.PI / 6)
        const step = Math.max(160, img.width / 4)
        
        for (let x = -img.width; x < img.width; x += step) {
          for (let y = -img.height; y < img.height; y += step) {
            lines.forEach((line, i) => {
              ctx.fillText(line, x, y + i * (Math.max(14, img.width / 40) + 4))
            })
          }
        }
        ctx.restore()
      }
      setLoaded(true)
    }
    img.src = src
  }, [src, sessionId, visible, watermarkText])

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: "100%",
        height: "100%",
        objectFit: "contain",
        display: loaded && visible ? "block" : "none",
      }}
    />
  )
}

export function ImageViewer({ token }: ImageViewerProps) {
  const [state, setState] = useState<"loading" | "active" | "used" | "expired" | "invalid">("loading")
  const [gallery, setGallery] = useState<GalleryData | null>(null)
  const [sessionId, setSessionId] = useState<string>("UNKNOWN")
  const [expiresAt, setExpiresAt] = useState<string | null>(null)
  const [timeLeft, setTimeLeft] = useState<number | null>(null)
  const [lightbox, setLightbox] = useState<number | null>(null)
  const [blurred, setBlurred] = useState(false)
  const accessedRef = useRef(false)

  // Validate token and load gallery
  useEffect(() => {
    if (accessedRef.current) return
    accessedRef.current = true

    const validateToken = async () => {
      try {
        const isPreview = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('preview') === 'true'

        const response = await fetch('/api/validate-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, preview: isPreview }),
        })

        const data = await response.json()

        if (!response.ok || !data.valid) {
          if (data.error?.includes('already been used')) {
            setState("used")
          } else if (data.error?.includes('expired')) {
            setState("expired")
          } else {
            setState("invalid")
          }
          return
        }

        setGallery(data.gallery)
        setExpiresAt(data.expiresAt)
        if (data.sessionId) setSessionId(data.sessionId)
        setState("active")
      } catch (err) {
        console.error('Validation error:', err)
        setState("invalid")
      }
    }

    // Add a small delay for the "decrypting" effect
    setTimeout(() => {
      validateToken()
    }, 1200)
  }, [token])

  // Countdown timer
  useEffect(() => {
    if (!expiresAt || state !== "active") return

    const tick = () => {
      const now = Date.now()
      const expiry = new Date(expiresAt).getTime()
      const remaining = Math.max(0, expiry - now)

      setTimeLeft(remaining)
      if (remaining === 0) {
        setState("expired")
      }
    }

    tick()
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [expiresAt, state])

  // Tab blur detection
  useEffect(() => {
    const handleVis = () => setBlurred(document.hidden)
    const handleBlur = () => setBlurred(true)
    const handleFocus = () => setBlurred(false)
    
    document.addEventListener("visibilitychange", handleVis)
    window.addEventListener("blur", handleBlur)
    window.addEventListener("focus", handleFocus)
    
    return () => {
      document.removeEventListener("visibilitychange", handleVis)
      window.removeEventListener("blur", handleBlur)
      window.removeEventListener("focus", handleFocus)
    }
  }, [])

  // Disable context menu and shortcuts
  useEffect(() => {
    const prevent = (e: MouseEvent) => e.preventDefault()
    const preventShortcuts = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'p' || e.key === 'S' || e.key === 'P')) {
        e.preventDefault()
      }
      if (e.key === 'PrintScreen') {
        e.preventDefault()
      }
    }
    document.addEventListener("contextmenu", prevent)
    document.addEventListener("keydown", preventShortcuts)
    return () => {
      document.removeEventListener("contextmenu", prevent)
      document.removeEventListener("keydown", preventShortcuts)
    }
  }, [])

  // Keyboard navigation for lightbox
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (lightbox === null || !gallery) return

      if (e.key === 'Escape') {
        setLightbox(null)
      } else if (e.key === 'ArrowRight') {
        setLightbox((lightbox + 1) % gallery.images.length)
      } else if (e.key === 'ArrowLeft') {
        setLightbox((lightbox - 1 + gallery.images.length) % gallery.images.length)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [lightbox, gallery])

  const getImageUrl = useCallback((pathname: string) => {
    return `/api/image?pathname=${encodeURIComponent(pathname)}&token=${encodeURIComponent(token)}`
  }, [token])

  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000)
    const m = Math.floor(s / 60)
    const h = Math.floor(m / 60)
    const d = Math.floor(h / 24)
    if (d > 0) return `${d}d ${h % 24}h ${m % 60}m`
    if (h > 0) return `${h}h ${m % 60}m`
    if (m > 0) return `${m}m ${s % 60}s`
    return `${s}s`
  }

  if (state === "loading") {
    return (
      <div className="status-screen loading-screen">
        <div className="status-spinner"></div>
        <p>Verifying secure link<span className="dots">...</span></p>
      </div>
    )
  }

  if (state === "used") {
    return (
      <div className="status-screen error-screen">
        <div className="status-icon used-icon">🔒</div>
        <h2>Link Already Used</h2>
        <p>This secure link has already been accessed once and is now invalid.</p>
        <p className="sub-hint">Each GhostGallery link can only be viewed a single time.</p>
      </div>
    )
  }

  if (state === "expired") {
    return (
      <div className="status-screen error-screen">
        <div className="status-icon">⌛</div>
        <h2>Link Expired</h2>
        <p>This link has passed its expiry time and is no longer accessible.</p>
      </div>
    )
  }

  if (state === "invalid" || !gallery) {
    return (
      <div className="status-screen error-screen">
        <div className="status-icon">⚠</div>
        <h2>Invalid Link</h2>
        <p>This token does not exist or was never issued.</p>
      </div>
    )
  }

  return (
    <div className={`gallery-viewer ${blurred ? "blurred" : ""} secure-image-container`}>
      {/* Header */}
      <div className="viewer-header">
        <span className="viewer-logo">⬡ GHOSTGALLERY</span>
        <div className="viewer-meta">
          <span className="session-badge">Session: {sessionId.slice(0, 8).toUpperCase()}</span>
          {timeLeft !== null && (
            <span className={`timer-badge ${timeLeft < 60000 ? "urgent" : ""}`}>
              ⏱ {formatTime(timeLeft)}
            </span>
          )}
        </div>
      </div>

      {/* Warning Banner */}
      <div className="viewer-warning">
        ⚠ ONE-TIME ACCESS — This session is recorded. All images are watermarked with your session ID and timestamp.
      </div>

      {/* Blur Overlay */}
      {blurred && (
        <div className="blur-overlay">
          <div className="blur-message">
            <span className="blur-icon">🔒</span>
            <p>Content hidden</p>
            <p className="blur-sub">Return to this tab to continue viewing</p>
          </div>
        </div>
      )}

      {/* Gallery Grid */}
      <div className="gallery-grid">
        {gallery.images.map((img, idx) => (
          <div
            key={img.id}
            className="gallery-item"
            onClick={() => setLightbox(idx)}
            style={{ animationDelay: `${idx * 0.08}s` }}
          >
            <div className="gallery-img-wrap">
              <WatermarkCanvas 
                src={getImageUrl(img.pathname)} 
                sessionId={sessionId} 
                visible={!blurred} 
                watermarkText={gallery.watermarkText}
              />
              <div className="img-overlay">
                <span>⬡ View</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Lightbox */}
      {lightbox !== null && (
        <div className="lightbox" onClick={() => setLightbox(null)}>
          <button className="lightbox-close" onClick={() => setLightbox(null)}>×</button>
          
          {gallery.images.length > 1 && (
            <>
              <button
                className="lightbox-nav prev"
                onClick={(e) => { e.stopPropagation(); setLightbox((lightbox - 1 + gallery.images.length) % gallery.images.length) }}
              >‹</button>
              <button
                className="lightbox-nav next"
                onClick={(e) => { e.stopPropagation(); setLightbox((lightbox + 1) % gallery.images.length) }}
              >›</button>
            </>
          )}

          <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
            <WatermarkCanvas
              src={getImageUrl(gallery.images[lightbox].pathname)}
              sessionId={sessionId}
              visible={!blurred}
              watermarkText={gallery.watermarkText}
            />
          </div>
          
          <div className="lightbox-counter">{lightbox + 1} / {gallery.images.length}</div>
        </div>
      )}
    </div>
  )
}
