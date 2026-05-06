'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { AlertTriangle, Clock, ShieldAlert, Eye, Lock, Maximize2 } from 'lucide-react'

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
        ctx.fillStyle = "#ff3b5c" // Ghost Gallery accent2
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
      <div className="status-screen error-screen" style={{ animation: 'fade-up 0.5s ease' }}>
        <div className="link-generated-container" style={{ maxWidth: '440px', padding: '40px 32px' }}>
          <div className="success-icon" style={{
            background: 'rgba(255, 59, 92, 0.08)',
            border: '2px solid var(--accent2)',
            color: 'var(--accent2)',
            boxShadow: '0 0 25px rgba(255, 59, 92, 0.25)',
            animation: 'pop-glow 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
            margin: '0 auto 24px auto'
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>

          <div>
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              color: 'var(--accent2)',
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              display: 'inline-block',
              marginBottom: '8px'
            }}>
              [ ACCESS DENIED ]
            </span>
            <h2 style={{ fontSize: '28px', color: 'var(--text)', marginBottom: '12px', fontFamily: 'var(--font-display)', letterSpacing: '0.05em' }}>Link Already Used</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '14.5px', lineHeight: '1.6', marginBottom: '20px' }}>
              This secure Ghost Gallery link has already been accessed and is now permanently destroyed.
            </p>
            <div style={{
              background: 'rgba(20, 28, 35, 0.6)',
              border: '1px solid var(--border)',
              padding: '12px 16px',
              borderRadius: '4px',
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
              color: 'var(--text-muted)',
              textAlign: 'left',
              lineHeight: '1.5'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span>STATUS:</span>
                <span style={{ color: 'var(--accent2)', fontWeight: 'bold' }}>REVOKED (403)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>SECURITY:</span>
                <span style={{ color: 'var(--text)' }}>SINGLE-USE POLICY</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (state === "expired") {
    return (
      <div className="status-screen error-screen" style={{ animation: 'fade-up 0.5s ease' }}>
        <div className="link-generated-container" style={{ maxWidth: '440px', padding: '40px 32px' }}>
          <div className="success-icon" style={{
            background: 'rgba(255, 184, 0, 0.08)',
            border: '2px solid var(--warning)',
            color: 'var(--warning)',
            boxShadow: '0 0 25px rgba(255, 184, 0, 0.25)',
            animation: 'pop-glow 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
            margin: '0 auto 24px auto'
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 2h14" />
              <path d="M5 22h14" />
              <path d="M19 2v4c0 3.87-3.13 7-7 7s-7-3.13-7-7V2" />
              <path d="M12 13c-3.87 0-7 3.13-7 7v2h14v-2c0-3.13-3.13-7-7-7z" />
            </svg>
          </div>

          <div>
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              color: 'var(--warning)',
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              display: 'inline-block',
              marginBottom: '8px'
            }}>
              [ TIME EXPIRED ]
            </span>
            <h2 style={{ fontSize: '28px', color: 'var(--text)', marginBottom: '12px', fontFamily: 'var(--font-display)', letterSpacing: '0.05em' }}>Link Expired</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '14.5px', lineHeight: '1.6', marginBottom: '20px' }}>
              This secure Ghost Gallery link has exceeded its validity timeframe and has been automatically deactivated.
            </p>
            <div style={{
              background: 'rgba(20, 28, 35, 0.6)',
              border: '1px solid var(--border)',
              padding: '12px 16px',
              borderRadius: '4px',
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
              color: 'var(--text-muted)',
              textAlign: 'left',
              lineHeight: '1.5'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span>STATUS:</span>
                <span style={{ color: 'var(--warning)', fontWeight: 'bold' }}>EXPIRED (410)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>RETENTION:</span>
                <span style={{ color: 'var(--text)' }}>AUTO-DESTRUCT ACTIVE</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (state === "invalid" || !gallery) {
    return (
      <div className="status-screen error-screen" style={{ animation: 'fade-up 0.5s ease' }}>
        <div className="link-generated-container" style={{ maxWidth: '440px', padding: '40px 32px' }}>
          <div className="success-icon" style={{
            background: 'rgba(255, 59, 92, 0.08)',
            border: '2px solid var(--accent2)',
            color: 'var(--accent2)',
            boxShadow: '0 0 25px rgba(255, 59, 92, 0.25)',
            animation: 'pop-glow 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
            margin: '0 auto 24px auto'
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>

          <div>
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              color: 'var(--accent2)',
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              display: 'inline-block',
              marginBottom: '8px'
            }}>
              [ LINK UNVERIFIED ]
            </span>
            <h2 style={{ fontSize: '28px', color: 'var(--text)', marginBottom: '12px', fontFamily: 'var(--font-display)', letterSpacing: '0.05em' }}>Invalid Link</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '14.5px', lineHeight: '1.6', marginBottom: '20px' }}>
              The cryptographic token provided is invalid, has been tampered with, or does not exist on our servers.
            </p>
            <div style={{
              background: 'rgba(20, 28, 35, 0.6)',
              border: '1px solid var(--border)',
              padding: '12px 16px',
              borderRadius: '4px',
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
              color: 'var(--text-muted)',
              textAlign: 'left',
              lineHeight: '1.5'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span>STATUS:</span>
                <span style={{ color: 'var(--accent2)', fontWeight: 'bold' }}>NOT FOUND (404)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>SECURITY:</span>
                <span style={{ color: 'var(--text)' }}>CRYPTO-TOKEN FAILURE</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`gallery-viewer ${blurred ? "blurred" : ""} secure-image-container`}>
      {/* Header */}
      <div className="viewer-header">
        <span className="viewer-logo">⬡ GHOST GALLERY</span>
        <div className="viewer-meta">
          <span className="session-badge">Session: {sessionId.slice(0, 8).toUpperCase()}</span>
          {timeLeft !== null && (
            <span className={`timer-badge ${timeLeft < 60000 ? "urgent" : ""}`}>
              ⏱ {formatTime(timeLeft)}
            </span>
          )}
        </div>
      </div>

      {/* Redesigned Cyber Notice Banner */}
      <div style={{
        background: 'linear-gradient(90deg, rgba(255, 184, 0, 0.08), rgba(255, 184, 0, 0.02), rgba(255, 184, 0, 0.08))',
        borderBottom: '1px solid rgba(255, 184, 0, 0.2)',
        padding: '14px 24px',
        fontFamily: 'var(--font-mono)',
        fontSize: '11px',
        color: 'var(--warning)',
        letterSpacing: '0.05em',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        textAlign: 'center',
        textTransform: 'uppercase'
      }}>
        <AlertTriangle size={14} style={{ color: '#f59e0b' }} />
        <span>ONE-TIME ACCESS ONLY — This session is securely logged. All images are dynamically watermarked.</span>
      </div>

      {/* Blur Overlay */}
      {blurred && (
        <div className="blur-overlay">
          <div className="blur-message">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent)', filter: 'drop-shadow(0 0 8px rgba(0, 229, 255, 0.4))', marginBottom: '8px' }}>
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <p>Content hidden</p>
            <p className="blur-sub">Return to this tab to continue viewing</p>
          </div>
        </div>
      )}

      {/* Redesigned Premium Gallery Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: '24px',
        padding: '10px 32px 64px 32px',
        maxWidth: '1400px',
        margin: '0 auto'
      }}>
        {gallery.images.map((img, idx) => (
          <div
            key={img.id}
            className="gallery-item-premium"
            onClick={() => setLightbox(idx)}
            style={{
              position: 'relative',
              aspectRatio: '1',
              borderRadius: '12px',
              border: '1px solid var(--border)',
              background: 'rgba(10, 16, 22, 0.6)',
              overflow: 'hidden',
              cursor: 'pointer',
              transition: 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)',
              animation: 'fadeIn 0.5s ease both',
              animationDelay: `${idx * 0.08}s`
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--accent)';
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = '0 12px 32px rgba(0, 229, 255, 0.12)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border)';
              e.currentTarget.style.transform = 'none';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <div style={{ width: '100%', height: '100%', position: 'relative' }}>
              <WatermarkCanvas
                src={getImageUrl(img.pathname)}
                sessionId={sessionId}
                visible={!blurred}
                watermarkText={gallery.watermarkText}
              />

              {/* Sleek Minimalist Hover Overlay */}
              <div
                className="img-overlay-premium"
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'linear-gradient(to top, rgba(3, 7, 10, 0.8) 0%, rgba(3, 7, 10, 0) 60%)',
                  display: 'flex',
                  alignItems: 'flex-end',
                  justifyContent: 'space-between',
                  padding: '16px',
                  opacity: 0,
                  transition: 'all 0.25s ease'
                }}
              >
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  color: 'var(--text)',
                  letterSpacing: '0.05em'
                }}>
                  {img.filename.length > 20 ? img.filename.slice(0, 17) + '...' : img.filename}
                </span>
                <span style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  color: 'var(--accent)'
                }}>
                  <Eye size={12} /> VIEW
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Lightbox */}
      {lightbox !== null && (
        <div className="lightbox" onClick={() => setLightbox(null)} style={{ backdropFilter: 'blur(20px)' }}>
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

          {/* Lightbox Caption */}
          <div style={{
            position: 'absolute',
            bottom: '32px',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px',
            zIndex: 10
          }}>
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
              color: 'var(--text)',
              letterSpacing: '0.05em',
              background: 'rgba(10, 16, 22, 0.8)',
              border: '1px solid var(--border)',
              padding: '6px 16px',
              borderRadius: '20px',
              backdropFilter: 'blur(8px)'
            }}>
              {gallery.images[lightbox].filename}
            </span>
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              color: 'var(--text-muted)',
              letterSpacing: '0.1em'
            }}>
              {lightbox + 1} / {gallery.images.length}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
