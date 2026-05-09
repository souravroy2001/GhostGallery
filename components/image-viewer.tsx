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
  watermarkText,
  objectFit = "contain",
  className
}: {
  src: string,
  sessionId: string,
  visible: boolean,
  watermarkText: string,
  objectFit?: "contain" | "cover",
  className?: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!src || !visible) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const img = new window.Image()
    img.crossOrigin = "anonymous"
    img.onload = () => {
      canvas.width = img.width
      canvas.height = img.height
      ctx.drawImage(img, 0, 0)

      if (watermarkText && watermarkText !== 'disabled' && watermarkText !== '__disabled__') {
        ctx.save()
        ctx.globalAlpha = 0.35
        ctx.fillStyle = "#ff3b5c"
        ctx.font = `bold ${Math.max(14, img.width / 40)}px 'Space Mono', monospace`
        ctx.textAlign = "center"

        const ts = new Date().toISOString()
        const sid = sessionId ? sessionId.slice(0, 8).toUpperCase() : "UNKNOWN"
        const lines = [`⚠ ${watermarkText.toUpperCase()} ⚠`, `Session: ${sid}`, ts]

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
      className={className}
      style={{
        width: className ? undefined : "100%",
        height: className ? undefined : "100%",
        objectFit,
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
  const [showReloadModal, setShowReloadModal] = useState(false)

  // Validate token and load gallery
  useEffect(() => {
    let active = true

    const validateToken = async () => {
      try {
        const isPreview = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('preview') === 'true'

        const response = await fetch('/api/validate-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, preview: isPreview }),
        })

        const data = await response.json()

        if (!active) return

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
        if (!active) return
        console.error('Validation error:', err)
        setState("invalid")
      }
    }

    const timer = setTimeout(() => {
      validateToken()
    }, 1200)

    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [token])

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

    const handleMouseLeave = (e: MouseEvent) => {
      if (e.clientY < 50) setShowReloadModal(true)
    }

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
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'p' || e.key === 'S' || e.key === 'P')) {
        e.preventDefault()
      }
      if (e.key === 'PrintScreen') e.preventDefault()
      if (e.key === 'F5' || ((e.ctrlKey || e.metaKey) && (e.key === 'r' || e.key === 'R'))) {
        e.preventDefault()
        setShowReloadModal(true)
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

  /* ─── Shared styles injected once ──────────────────── */
  const sharedStyles = `
    @keyframes iv-scan {
      0% { transform: translateY(-100%); }
      100% { transform: translateY(100vh); }
    }
    @keyframes iv-fadeup {
      from { opacity: 0; transform: translateY(16px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes iv-popin {
      from { opacity: 0; transform: scale(0.88); }
      to   { opacity: 1; transform: scale(1); }
    }
    @keyframes iv-spin {
      to { transform: rotate(360deg); }
    }
    @keyframes iv-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }
    @keyframes iv-glow-red {
      0%, 100% { box-shadow: 0 0 20px rgba(255,59,92,.25), 0 0 60px rgba(255,59,92,.08); }
      50%       { box-shadow: 0 0 35px rgba(255,59,92,.45), 0 0 80px rgba(255,59,92,.15); }
    }
    @keyframes iv-glow-amber {
      0%, 100% { box-shadow: 0 0 20px rgba(245,158,11,.25); }
      50%       { box-shadow: 0 0 40px rgba(245,158,11,.4); }
    }
    @keyframes iv-shimmer {
      from { background-position: -200% 0; }
      to   { background-position: 200% 0; }
    }
    @keyframes iv-ticker {
      0%   { opacity: 0; }
      10%  { opacity: 1; }
      90%  { opacity: 1; }
      100% { opacity: 0; }
    }
    @keyframes iv-blink {
      0%, 100% { opacity: 1; }
      50% { opacity: 0; }
    }
    @keyframes iv-grid-in {
      from { opacity: 0; transform: translateY(12px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    /* Loading scanline */
    .iv-scanline {
      position: absolute; inset: 0; pointer-events: none; overflow: hidden;
    }
    .iv-scanline::after {
      content: '';
      position: absolute; left: 0; right: 0; height: 2px;
      background: linear-gradient(90deg, transparent, rgba(0,229,255,.35), transparent);
      animation: iv-scan 2.4s linear infinite;
    }

    /* Status screen base */
    .iv-status {
      min-height: 100vh; display: flex; align-items: center; justify-content: center;
      background: radial-gradient(ellipse 80% 60% at 50% 0%, rgba(0,229,255,.04), transparent 70%),
                  linear-gradient(180deg, #030810 0%, #020609 100%);
      padding: 24px; position: relative; overflow: hidden;
    }
    .iv-status::before {
      content: '';
      position: absolute; inset: 0; pointer-events: none;
      background-image: repeating-linear-gradient(
        0deg, transparent, transparent 3px, rgba(0,229,255,.012) 3px, rgba(0,229,255,.012) 4px
      );
    }

    /* Status card */
    .iv-card {
      width: 100%; max-width: 460px;
      background: linear-gradient(160deg, rgba(10,18,28,.97), rgba(6,12,20,.95));
      border: 1px solid rgba(255,255,255,.08);
      border-radius: 20px;
      padding: 48px 40px;
      display: flex; flex-direction: column; align-items: center;
      text-align: center; gap: 0;
      box-shadow: 0 32px 80px rgba(0,0,0,.7), 0 0 0 1px rgba(255,255,255,.04);
      animation: iv-popin .4s cubic-bezier(.16,1,.3,1) both;
      position: relative; overflow: hidden;
    }
    .iv-card::before {
      content: '';
      position: absolute; top: 0; left: 0; right: 0; height: 1px;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,.15), transparent);
    }

    /* Status icon ring */
    .iv-icon-ring {
      width: 80px; height: 80px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      margin: 0 auto 28px;
      position: relative;
    }
    .iv-icon-ring::before {
      content: ''; position: absolute; inset: -4px; border-radius: 50%;
      border: 1px solid currentColor; opacity: .2;
    }
    .iv-icon-ring::after {
      content: ''; position: absolute; inset: -10px; border-radius: 50%;
      border: 1px solid currentColor; opacity: .08;
    }

    /* Code chip */
    .iv-chip {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 5px 12px; border-radius: 100px;
      font-family: var(--font-mono, monospace); font-size: 10px;
      letter-spacing: .12em; text-transform: uppercase;
      margin-bottom: 16px;
    }
    .iv-chip-dot {
      width: 5px; height: 5px; border-radius: 50%;
    }

    /* Info table */
    .iv-table {
      width: 100%; margin-top: 24px;
      background: rgba(0,0,0,.35); border: 1px solid rgba(255,255,255,.06);
      border-radius: 10px; overflow: hidden;
    }
    .iv-table-row {
      display: flex; justify-content: space-between; align-items: center;
      padding: 10px 16px;
      font-family: var(--font-mono, monospace); font-size: 11px; letter-spacing: .04em;
    }
    .iv-table-row + .iv-table-row {
      border-top: 1px solid rgba(255,255,255,.05);
    }
    .iv-table-row span:first-child { color: rgba(136,146,164,.5); }

    /* Viewer header */
    .iv-header {
      position: sticky; top: 0; z-index: 50;
      display: flex; justify-content: space-between; align-items: center;
      padding: 0 24px; height: 52px;
      background: rgba(3,8,14,.92);
      backdrop-filter: blur(20px) saturate(1.4);
      border-bottom: 1px solid rgba(255,255,255,.06);
    }

    /* Timer badge */
    .iv-timer {
      display: inline-flex; align-items: center; gap: 7px;
      padding: 5px 12px; border-radius: 100px;
      font-family: var(--font-mono, monospace); font-size: 11px; letter-spacing: .06em;
      border: 1px solid rgba(0,229,255,.2); background: rgba(0,229,255,.06);
      color: rgba(0,229,255,.8);
      transition: all .3s;
    }
    .iv-timer.urgent {
      border-color: rgba(239,68,68,.4); background: rgba(239,68,68,.08);
      color: #ef4444; animation: iv-pulse 1s ease-in-out infinite;
    }
    .iv-timer-dot {
      width: 5px; height: 5px; border-radius: 50%;
      background: currentColor; animation: iv-blink 1.2s ease-in-out infinite;
    }

    /* Session badge */
    .iv-session {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 4px 10px; border-radius: 6px;
      font-family: var(--font-mono, monospace); font-size: 10px; letter-spacing: .06em;
      background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.07);
      color: rgba(136,146,164,.6);
    }

    /* Warning banner */
    .iv-banner {
      display: flex; align-items: center; justify-content: center; gap: 10px;
      padding: 11px 24px;
      background: linear-gradient(90deg, rgba(245,158,11,.0) 0%, rgba(245,158,11,.07) 30%, rgba(245,158,11,.07) 70%, rgba(245,158,11,.0) 100%);
      border-bottom: 1px solid rgba(245,158,11,.15);
      font-family: var(--font-mono, monospace); font-size: 10px; letter-spacing: .08em;
      color: rgba(245,158,11,.75); text-transform: uppercase; text-align: center;
    }

    /* Gallery grid */
    .iv-grid {
      width: 100%; max-width: 1400px; margin: 0 auto;
      padding: 28px 24px 80px;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
      gap: 12px;
    }
    @media (max-width: 640px) {
      .iv-grid { grid-template-columns: repeat(2, 1fr); gap: 8px; padding: 16px 12px 60px; }
    }
    @media (min-width: 1280px) {
      .iv-grid { grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px; }
    }

    /* Gallery thumb */
    .iv-thumb {
      position: relative; aspect-ratio: 1;
      border-radius: 10px; overflow: hidden;
      border: 1px solid rgba(255,255,255,.07);
      background: rgba(8,14,22,.6);
      cursor: pointer;
      transition: transform .25s cubic-bezier(.16,1,.3,1), border-color .2s, box-shadow .25s;
      animation: iv-grid-in .4s cubic-bezier(.16,1,.3,1) both;
    }
    .iv-thumb:hover {
      transform: translateY(-5px) scale(1.01);
      border-color: rgba(0,229,255,.4);
      box-shadow: 0 16px 40px rgba(0,0,0,.5), 0 0 0 1px rgba(0,229,255,.12);
    }
    .iv-thumb canvas { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }

    /* Thumb overlay */
    .iv-thumb-overlay {
      position: absolute; inset: 0;
      background: linear-gradient(to top, rgba(3,8,14,.85) 0%, rgba(3,8,14,0) 55%);
      display: flex; align-items: flex-end;
      padding: 12px;
      opacity: 0;
      transition: opacity .2s;
    }
    .iv-thumb:hover .iv-thumb-overlay { opacity: 1; }
    .iv-thumb-idx {
      position: absolute; top: 9px; right: 9px;
      width: 22px; height: 22px; border-radius: 50%;
      background: rgba(0,0,0,.55); border: 1px solid rgba(255,255,255,.15);
      display: flex; align-items: center; justify-content: center;
      font-family: var(--font-mono, monospace); font-size: 9px;
      color: rgba(200,216,232,.7); letter-spacing: 0;
      opacity: 0; transition: opacity .2s;
    }
    .iv-thumb:hover .iv-thumb-idx { opacity: 1; }

    /* Blur overlay */
    .iv-blur-overlay {
      position: fixed; inset: 0; z-index: 200;
      background: rgba(2,6,12,.92);
      backdrop-filter: blur(24px) saturate(0);
      display: flex; align-items: center; justify-content: center;
      animation: iv-fadeup .2s ease;
    }
    .iv-blur-card {
      display: flex; flex-direction: column; align-items: center; gap: 14px;
      padding: 40px 48px; border-radius: 20px;
      background: rgba(10,18,28,.95); border: 1px solid rgba(255,255,255,.08);
      box-shadow: 0 24px 60px rgba(0,0,0,.6);
    }

    /* Lightbox */
    .iv-lightbox {
      position: fixed; inset: 0; z-index: 500;
      background: rgba(1,4,8,.96);
      backdrop-filter: blur(28px) saturate(1.2);
      display: flex; align-items: center; justify-content: center;
      animation: iv-fadeup .2s ease;
    }
    .iv-lightbox-close {
      position: absolute; top: 20px; right: 24px;
      width: 36px; height: 36px; border-radius: 50%;
      background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.12);
      color: rgba(200,216,232,.7); font-size: 18px; line-height: 1;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; transition: all .15s; z-index: 10;
    }
    .iv-lightbox-close:hover { background: rgba(255,255,255,.12); color: #fff; }

    .iv-lb-nav {
      position: absolute; top: 50%; transform: translateY(-50%);
      width: 44px; height: 44px; border-radius: 50%;
      background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.12);
      color: rgba(200,216,232,.8); font-size: 22px;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; z-index: 10; transition: all .15s;
    }
    .iv-lb-nav:hover { background: rgba(0,229,255,.12); border-color: rgba(0,229,255,.4); color: #00e5ff; }
    .iv-lb-nav.prev { left: 20px; }
    .iv-lb-nav.next { right: 20px; }

    .iv-lb-counter {
      position: absolute; bottom: 28px; left: 50%; transform: translateX(-50%);
      display: flex; flex-direction: column; align-items: center; gap: 8px; z-index: 10;
    }
    .iv-lb-title {
      padding: 5px 18px; border-radius: 100px;
      background: rgba(10,16,22,.85); border: 1px solid rgba(255,255,255,.1);
      font-family: var(--font-mono, monospace); font-size: 11px;
      color: rgba(200,216,232,.7); letter-spacing: .05em;
      backdrop-filter: blur(8px);
    }
    .iv-lb-nums {
      display: flex; align-items: center; gap: 6px;
      font-family: var(--font-mono, monospace); font-size: 11px; color: rgba(136,146,164,.5);
    }
    .iv-lb-dot-track { display: flex; gap: 4px; }
    .iv-lb-dot {
      width: 4px; height: 4px; border-radius: 50%;
      background: rgba(255,255,255,.2); transition: all .2s;
    }
    .iv-lb-dot.cur { background: #00e5ff; box-shadow: 0 0 6px #00e5ff; width: 16px; border-radius: 2px; }

    /* Reload modal */
    .iv-reload-modal {
      position: fixed; inset: 0; z-index: 9999;
      background: rgba(2,6,12,.9);
      backdrop-filter: blur(20px) saturate(1.4);
      display: flex; align-items: center; justify-content: center;
      animation: iv-fadeup .2s ease;
    }

    /* Loading screen */
    .iv-loading {
      min-height: 100vh; display: flex; align-items: center; justify-content: center;
      flex-direction: column; gap: 24px;
      background: radial-gradient(ellipse 60% 40% at 50% 0%, rgba(0,229,255,.05), transparent),
                  #030810;
      position: relative; overflow: hidden;
    }
    .iv-spinner {
      width: 48px; height: 48px; border-radius: 50%;
      border: 2px solid rgba(0,229,255,.15);
      border-top-color: #00e5ff;
      animation: iv-spin 1s linear infinite;
      box-shadow: 0 0 20px rgba(0,229,255,.15);
    }
    .iv-loading-text {
      font-family: var(--font-mono, monospace); font-size: 12px;
      color: rgba(0,229,255,.6); letter-spacing: .12em; text-transform: uppercase;
    }
    .iv-loading-sub {
      font-family: var(--font-mono, monospace); font-size: 10px;
      color: rgba(136,146,164,.35); letter-spacing: .06em; text-transform: uppercase;
      margin-top: -16px;
    }
  `

  /* ─── LOADING ──────────────────────────────────────── */
  if (state === "loading") {
    return (
      <>
        <style>{sharedStyles}</style>
        <div className="iv-loading">
          <div className="iv-scanline" />
          <div className="iv-spinner" />
          <p className="iv-loading-text">Verifying secure link</p>
          <p className="iv-loading-sub">Decrypting cryptographic token…</p>
        </div>
      </>
    )
  }

  /* ─── STATUS SCREENS ───────────────────────────────── */
  if (state === "used") {
    return (
      <>
        <style>{sharedStyles}</style>
        <div className="iv-status">
          <div className="iv-scanline" />
          <div className="iv-card" style={{ borderColor: 'rgba(239,68,68,.2)', animation: 'iv-glow-red 3s ease-in-out infinite, iv-popin .4s cubic-bezier(.16,1,.3,1) both' }}>
            <div className="iv-icon-ring" style={{ background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', color: '#ef4444', boxShadow: '0 0 30px rgba(239,68,68,.2)' }}>
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </div>

            <div className="iv-chip" style={{ background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.25)', color: '#ef4444' }}>
              <span className="iv-chip-dot" style={{ background: '#ef4444', boxShadow: '0 0 5px #ef4444' }} />
              ACCESS DENIED
            </div>

            <h2 style={{ fontFamily: 'var(--font-display, var(--font-mono))', fontSize: '28px', color: '#e8f0f8', margin: '0 0 12px', letterSpacing: '.04em' }}>Link Already Used</h2>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'rgba(136,146,164,.7)', lineHeight: 1.7, margin: 0 }}>
              This secure Ghost Gallery link was already accessed and is permanently destroyed. Single-use tokens cannot be replayed.
            </p>

            <div className="iv-table">
              <div className="iv-table-row">
                <span>STATUS</span>
                <span style={{ color: '#ef4444', fontWeight: 700 }}>REVOKED — 403</span>
              </div>
              <div className="iv-table-row">
                <span>POLICY</span>
                <span style={{ color: '#e8f0f8' }}>SINGLE-USE TOKEN</span>
              </div>
            </div>
          </div>
        </div>
      </>
    )
  }

  if (state === "expired") {
    return (
      <>
        <style>{sharedStyles}</style>
        <div className="iv-status">
          <div className="iv-scanline" />
          <div className="iv-card" style={{ borderColor: 'rgba(245,158,11,.2)', animation: 'iv-glow-amber 3s ease-in-out infinite, iv-popin .4s cubic-bezier(.16,1,.3,1) both' }}>
            <div className="iv-icon-ring" style={{ background: 'rgba(245,158,11,.1)', border: '1px solid rgba(245,158,11,.3)', color: '#f59e0b', boxShadow: '0 0 30px rgba(245,158,11,.2)' }}>
              <Clock size={30} strokeWidth={1.8} />
            </div>

            <div className="iv-chip" style={{ background: 'rgba(245,158,11,.1)', border: '1px solid rgba(245,158,11,.25)', color: '#f59e0b' }}>
              <span className="iv-chip-dot" style={{ background: '#f59e0b', boxShadow: '0 0 5px #f59e0b' }} />
              TIME EXPIRED
            </div>

            <h2 style={{ fontFamily: 'var(--font-display, var(--font-mono))', fontSize: '28px', color: '#e8f0f8', margin: '0 0 12px', letterSpacing: '.04em' }}>Link Expired</h2>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'rgba(136,146,164,.7)', lineHeight: 1.7, margin: 0 }}>
              This Ghost Gallery link exceeded its validity window and was automatically deactivated. Contact the sender for a new link.
            </p>

            <div className="iv-table">
              <div className="iv-table-row">
                <span>STATUS</span>
                <span style={{ color: '#f59e0b', fontWeight: 700 }}>EXPIRED — 410</span>
              </div>
              <div className="iv-table-row">
                <span>RETENTION</span>
                <span style={{ color: '#e8f0f8' }}>AUTO-DESTRUCT ACTIVE</span>
              </div>
            </div>
          </div>
        </div>
      </>
    )
  }

  if (state === "invalid" || !gallery) {
    return (
      <>
        <style>{sharedStyles}</style>
        <div className="iv-status">
          <div className="iv-scanline" />
          <div className="iv-card" style={{ borderColor: 'rgba(239,68,68,.15)', animation: 'iv-popin .4s cubic-bezier(.16,1,.3,1) both' }}>
            <div className="iv-icon-ring" style={{ background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.25)', color: '#ef4444', boxShadow: '0 0 20px rgba(239,68,68,.15)' }}>
              <AlertTriangle size={30} strokeWidth={1.8} />
            </div>

            <div className="iv-chip" style={{ background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)', color: 'rgba(239,68,68,.85)' }}>
              <span className="iv-chip-dot" style={{ background: '#ef4444' }} />
              LINK UNVERIFIED
            </div>

            <h2 style={{ fontFamily: 'var(--font-display, var(--font-mono))', fontSize: '28px', color: '#e8f0f8', margin: '0 0 12px', letterSpacing: '.04em' }}>Invalid Link</h2>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'rgba(136,146,164,.7)', lineHeight: 1.7, margin: 0 }}>
              The cryptographic token is invalid, tampered with, or does not exist on our servers. Verify you have the correct URL.
            </p>

            <div className="iv-table">
              <div className="iv-table-row">
                <span>STATUS</span>
                <span style={{ color: '#ef4444', fontWeight: 700 }}>NOT FOUND — 404</span>
              </div>
              <div className="iv-table-row">
                <span>SECURITY</span>
                <span style={{ color: '#e8f0f8' }}>CRYPTO-TOKEN FAILURE</span>
              </div>
            </div>
          </div>
        </div>
      </>
    )
  }

  /* ─── ACTIVE GALLERY VIEW ──────────────────────────── */
  return (
    <>
      <style>{sharedStyles}</style>

      <div className={`gallery-viewer ${blurred ? "blurred" : ""} secure-image-container`} style={{ minHeight: '100vh', background: '#030810', position: 'relative' }}>

        {/* ── Header ── */}
        <div className="iv-header">
          <span style={{
            fontFamily: 'var(--font-display, var(--font-mono))', fontSize: '13px',
            letterSpacing: '.12em', color: '#e8f0f8', fontWeight: 700,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ color: '#00e5ff', fontSize: 16, filter: 'drop-shadow(0 0 6px rgba(0,229,255,.5))' }}>⬡</span>
            {gallery?.title?.toUpperCase() || 'GHOST GALLERY'}
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
            {gallery.watermarkText && gallery.watermarkText !== 'disabled'
              ? ' All images carry dynamic watermarks.'
              : ''}
          </span>
        </div>

        {/* ── Blur overlay ── */}
        {blurred && (
          <div className="iv-blur-overlay">
            <div className="iv-blur-card">
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(0,229,255,.08)', border: '1px solid rgba(0,229,255,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 24px rgba(0,229,255,.15)' }}>
                <Lock size={22} style={{ color: '#00e5ff' }} />
              </div>
              <p style={{ fontFamily: 'var(--font-display, var(--font-mono))', fontSize: '16px', color: '#e8f0f8', margin: 0, letterSpacing: '.04em' }}>Content Hidden</p>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'rgba(136,146,164,.55)', margin: 0, letterSpacing: '.06em', textTransform: 'uppercase' }}>Return to this tab to resume viewing</p>
            </div>
          </div>
        )}

        {/* ── Gallery grid ── */}
        <div className="iv-grid">
          {gallery.images.map((img, idx) => (
            <div
              key={img.id}
              className="iv-thumb"
              style={{ animationDelay: `${idx * 0.055}s` }}
              onClick={() => setLightbox(idx)}
            >
              <WatermarkCanvas
                src={getImageUrl(img.pathname)}
                sessionId={sessionId}
                visible={!blurred}
                watermarkText={gallery.watermarkText}
                objectFit="cover"
              />
              <div className="iv-thumb-overlay">
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#00e5ff' }}>
                  <Maximize2 size={11} /> EXPAND
                </span>
              </div>
              <span className="iv-thumb-idx">{idx + 1}</span>
            </div>
          ))}
        </div>

        {/* ── Lightbox ── */}
        {lightbox !== null && (
          <div className="iv-lightbox" onClick={() => setLightbox(null)}>
            <button className="iv-lightbox-close" onClick={() => setLightbox(null)}>×</button>

            {gallery.images.length > 1 && (
              <>
                <button className="iv-lb-nav prev" onClick={e => { e.stopPropagation(); setLightbox((lightbox - 1 + gallery.images.length) % gallery.images.length) }}>‹</button>
                <button className="iv-lb-nav next" onClick={e => { e.stopPropagation(); setLightbox((lightbox + 1) % gallery.images.length) }}>›</button>
              </>
            )}

            <div className="lightbox-content" onClick={e => e.stopPropagation()} style={{ maxHeight: '80vh', maxWidth: '90vw', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <WatermarkCanvas
                src={getImageUrl(gallery.images[lightbox].pathname)}
                sessionId={sessionId}
                visible={!blurred}
                watermarkText={gallery.watermarkText}
                objectFit="contain"
                className="lightbox-image"
              />
            </div>

            {/* Caption + dot track */}
            <div className="iv-lb-counter">
              <div className="iv-lb-title">{gallery.title || 'GHOST GALLERY'}</div>
              <div className="iv-lb-nums">
                <div className="iv-lb-dot-track">
                  {gallery.images.map((_, i) => (
                    <div key={i} className={`iv-lb-dot ${i === lightbox ? 'cur' : ''}`}
                      onClick={e => { e.stopPropagation(); setLightbox(i) }}
                      style={{ cursor: 'pointer' }}
                    />
                  ))}
                </div>
                <span style={{ marginLeft: 10 }}>{lightbox + 1} / {gallery.images.length}</span>
              </div>
            </div>
          </div>
        )}

        {/* ── Reload warning modal ── */}
        {showReloadModal && (
          <div className="iv-reload-modal">
            <div style={{
              width: '90%', maxWidth: 440,
              background: 'linear-gradient(160deg, rgba(12,18,28,.98), rgba(8,12,20,.96))',
              border: '1px solid rgba(239,68,68,.3)',
              borderRadius: 20, padding: '44px 36px',
              textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0,
              boxShadow: '0 32px 80px rgba(0,0,0,.8), 0 0 60px rgba(239,68,68,.12)',
              animation: 'iv-popin .3s cubic-bezier(.16,1,.3,1)',
              position: 'relative', overflow: 'hidden',
            }}>
              {/* Top glow line */}
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(90deg, transparent, rgba(239,68,68,.4), transparent)' }} />

              <div style={{
                width: 72, height: 72, borderRadius: '50%', marginBottom: 24,
                background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 0 30px rgba(239,68,68,.2)', color: '#ef4444',
                animation: 'iv-glow-red 2s ease-in-out infinite',
              }}>
                <AlertTriangle size={30} strokeWidth={1.8} />
              </div>

              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 100, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.25)', marginBottom: 16 }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 5px #ef4444', display: 'inline-block', animation: 'iv-blink 1s ease-in-out infinite' }} />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#ef4444', letterSpacing: '.1em' }}>SECURE WARNING</span>
              </div>

              <h3 style={{ fontFamily: 'var(--font-display, var(--font-mono))', fontSize: '22px', color: '#e8f0f8', margin: '0 0 14px', letterSpacing: '.04em' }}>Confirm Reload?</h3>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'rgba(136,146,164,.7)', lineHeight: 1.7, margin: '0 0 28px' }}>
                This is a <strong style={{ color: '#e8f0f8' }}>single-use</strong> gallery. Reloading or closing will permanently destroy this cryptographic token and revoke your access forever.
              </p>

              <div style={{ display: 'flex', gap: 12, width: '100%' }}>
                <button onClick={() => setShowReloadModal(false)} style={{
                  flex: 1, padding: '13px', borderRadius: 10, cursor: 'pointer',
                  background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)',
                  color: 'rgba(200,216,232,.8)', fontFamily: 'var(--font-mono)', fontSize: '12px',
                  fontWeight: 700, letterSpacing: '.06em', transition: 'all .15s',
                }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,.09)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,.2)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,.05)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,.1)' }}
                >
                  Cancel — Stay
                </button>
                <button onClick={() => window.location.reload()} style={{
                  flex: 1, padding: '13px', borderRadius: 10, cursor: 'pointer',
                  background: '#ef4444', border: 'none',
                  color: '#fff', fontFamily: 'var(--font-mono)', fontSize: '12px',
                  fontWeight: 700, letterSpacing: '.06em',
                  boxShadow: '0 4px 20px rgba(239,68,68,.4)', transition: 'all .15s',
                }}
                  onMouseEnter={e => { e.currentTarget.style.filter = 'brightness(1.1)'; e.currentTarget.style.boxShadow = '0 6px 28px rgba(239,68,68,.55)' }}
                  onMouseLeave={e => { e.currentTarget.style.filter = 'none'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(239,68,68,.4)' }}
                >
                  Confirm Reload
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
