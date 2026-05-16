'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { AlertTriangle, Maximize2 } from 'lucide-react'

import './viewer/image-viewer.css'
import { GalleryData } from './viewer/types'
import { WatermarkCanvas } from './viewer/WatermarkCanvas'
import { LoadingScreen, UsedScreen, ExpiredScreen, InvalidScreen } from './viewer/StatusScreens'
import { BlurOverlay, ReloadModal } from './viewer/Overlays'
import { Lightbox } from './viewer/Lightbox'

interface ImageViewerProps {
  token: string
}

export function ImageViewer({ token }: ImageViewerProps) {
  const [state, setState] = useState<"loading" | "active" | "used" | "expired" | "invalid">("loading")
  const [gallery, setGallery] = useState<GalleryData | null>(null)
  const [sessionId, setSessionId] = useState<string>("UNKNOWN")
  const [expiresAt, setExpiresAt] = useState<string | null>(null)
  const [timeLeft, setTimeLeft] = useState<number | null>(null)
  const [lightbox, setLightbox] = useState<number | null>(null)
  const [blurred, setBlurred] = useState(false)
  const [showReloadModal, setShowReloadModal] = useState(false)

  // Validate token and load gallery
  const loadGallery = useCallback(async () => {
    try {
      const isPreview = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('preview') === 'true'

      const response = await fetch('/api/validate-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, preview: isPreview }),
      })

      const data = await response.json()

      if (!response.ok || !data.valid) {
        if (data.error?.includes('already been used')) setState("used")
        else if (data.error?.includes('expired')) setState("expired")
        else setState("invalid")
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
  }, [token])

  useEffect(() => {
    const timer = setTimeout(() => { loadGallery() }, 1200)
    return () => clearTimeout(timer)
  }, [loadGallery])

  // Countdown timer
  useEffect(() => {
    if (!expiresAt || state !== "active") return
    const tick = () => {
      const now = Date.now()
      const expiry = new Date(expiresAt).getTime()
      const remaining = Math.max(0, expiry - now)
      setTimeLeft(remaining)
      if (remaining === 0) setState("expired")
    }
    tick()
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [expiresAt, state])

  // Single-use reload warning
  useEffect(() => {
    if (state !== "active") return
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const message = "Warning: This is a secure single-use gallery. If you reload or close this page, you will lose access forever!"
      e.preventDefault()
      e.returnValue = message
      return message
    }
    const handleMouseLeave = (e: MouseEvent) => { if (e.clientY < 50) setShowReloadModal(true) }
    document.body.style.overscrollBehaviorY = 'contain'
    window.addEventListener("beforeunload", handleBeforeUnload)
    document.addEventListener("mouseleave", handleMouseLeave)
    return () => {
      document.body.style.overscrollBehaviorY = 'auto'
      window.removeEventListener("beforeunload", handleBeforeUnload)
      document.removeEventListener("mouseleave", handleMouseLeave)
    }
  }, [state])

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
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'p' || e.key === 'S' || e.key === 'P')) e.preventDefault()
      if (e.key === 'PrintScreen') e.preventDefault()
      if (e.key === 'F5' || ((e.ctrlKey || e.metaKey) && (e.key === 'r' || e.key === 'R'))) {
        e.preventDefault(); setShowReloadModal(true)
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
      if (e.key === 'Escape') setLightbox(null)
      else if (e.key === 'ArrowRight') setLightbox((lightbox + 1) % gallery.images.length)
      else if (e.key === 'ArrowLeft') setLightbox((lightbox - 1 + gallery.images.length) % gallery.images.length)
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

  // Flow branches
  if (state === "loading") return <LoadingScreen />
  if (state === "used") return <UsedScreen />
  if (state === "expired") return <ExpiredScreen />
  if (state === "invalid" || !gallery) return <InvalidScreen />

  return (
    <div className={`gallery-viewer ${blurred ? "blurred" : ""} secure-image-container`} style={{ minHeight: '100vh', background: '#030810', position: 'relative' }}>

      {/* ── Header ── */}
      <div className="iv-header">
        <span style={{
          fontFamily: 'var(--font-display, var(--font-mono))', fontSize: '13px',
          letterSpacing: '.12em', color: '#e8f0f8', fontWeight: 700,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ color: '#00e5ff', fontSize: 16, filter: 'drop-shadow(0 0 6px rgba(0,229,255,.5))' }}>⬡</span>
          {gallery.title?.toUpperCase() || 'GHOST GALLERY'}
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="iv-session hidden sm:inline-flex">
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#00e5ff', boxShadow: '0 0 5px #00e5ff', display: 'inline-block' }} />
            {sessionId.slice(0, 8).toUpperCase()}
          </span>
          {timeLeft !== null && (
            <span className={`iv-timer ${timeLeft < 60000 ? 'urgent' : ''}`}>
              <span className="iv-timer-dot" />
              {formatTime(timeLeft)}
            </span>
          )}
        </div>
      </div>

      {/* ── Warning banner ── */}
      <div className="iv-banner">
        <AlertTriangle size={13} style={{ flexShrink: 0, opacity: .8 }} />
        <span>
          One-time access only — This session is securely logged.
          {gallery.watermarkText && gallery.watermarkText !== 'disabled' ? ' All views carry dynamic protection.' : ''}
        </span>
      </div>

      {/* ── Content ── */}
      {gallery.targetUrl ? (
        <div style={{ width: '100%', height: 'calc(100vh - 86px)', position: 'relative', background: '#020609', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          {gallery.iframeBlocked ? (
            <div style={{ padding: 40, textAlign: 'center', maxWidth: 400, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <AlertTriangle size={48} color="#ef4444" style={{ marginBottom: 20, opacity: 0.8 }} />
              <h2 style={{ fontFamily: 'var(--font-mono)', color: '#fff', fontSize: 18, marginBottom: 10 }}>URL NOT SUPPORTED</h2>
              <p style={{ color: 'rgba(200,216,232,0.7)', fontSize: 14, lineHeight: 1.5 }}>
                This URL does not allow secure iframe embedding. Please check the URL, or if it is your website, ensure that X-Frame-Options allows framing.
              </p>
            </div>
          ) : (
            <>
              {/* Watermark Overlay */}
              <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 10, overflow: 'hidden' }}>
                {gallery.watermarkText && gallery.watermarkText !== 'disabled' && gallery.watermarkText !== '__disabled__' && (
                  <div style={{ width: '100%', height: '100%', display: 'flex', flexWrap: 'wrap', gap: '120px', alignContent: 'center', justifyContent: 'center', opacity: 0.12, transform: 'rotate(-25deg) scale(1.4)' }}>
                    {Array.from({ length: 48 }).map((_, i) => (
                      <div key={i} style={{ fontFamily: 'var(--font-mono), monospace', fontSize: '13px', fontWeight: 700, color: '#00e5ff', whiteSpace: 'nowrap', userSelect: 'none' }}>
                        ⚠ {gallery.watermarkText.toUpperCase()} ⚠ {sessionId.slice(0, 8).toUpperCase()}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <iframe src={gallery.targetUrl} style={{ width: '100%', height: '100%', border: 'none', background: '#fff' }} title={gallery.title || 'Secure Link'} />
            </>
          )}
        </div>
      ) : (
        <div className="iv-grid">
          {gallery.images.map((img, idx) => (
            <div key={img.id} className="iv-thumb" style={{ animationDelay: `${idx * 0.055}s` }} onClick={() => setLightbox(idx)}>
              <WatermarkCanvas src={getImageUrl(img.pathname)} sessionId={sessionId} visible={!blurred} watermarkText={gallery.watermarkText} objectFit="cover" />
              <div className="iv-thumb-overlay">
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#00e5ff' }}>
                  <Maximize2 size={11} /> EXPAND
                </span>
              </div>
              <span className="iv-thumb-idx">{idx + 1}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Overlay systems ── */}
      {blurred && <BlurOverlay />}
      {lightbox !== null && (
        <Lightbox gallery={gallery} index={lightbox} onClose={() => setLightbox(null)} setLightbox={setLightbox} getImageUrl={getImageUrl} sessionId={sessionId} blurred={blurred} />
      )}
      {showReloadModal && <ReloadModal onClose={() => setShowReloadModal(false)} />}
    </div>
  )
}
