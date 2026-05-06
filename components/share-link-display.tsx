'use client'

import { useState, useEffect } from 'react'
import { Check, Copy, Clock, Eye, ShieldCheck, AlertOctagon } from 'lucide-react'

interface ShareLinkDisplayProps {
  shareUrl: string
  expiresAt: string
  watermarkText?: string
  onReset?: () => void
}

export function ShareLinkDisplay({ shareUrl, expiresAt, watermarkText, onReset }: ShareLinkDisplayProps) {
  const [copied, setCopied] = useState(false)
  const [timeLeftStr, setTimeLeftStr] = useState<string>('Calculating...')

  const copy = () => {
    navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handlePreview = () => {
    const previewUrl = shareUrl.includes('?') ? `${shareUrl}&preview=true` : `${shareUrl}?preview=true`
    window.open(previewUrl, '_blank', 'noopener,noreferrer')
  }

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date().getTime()
      const expiry = new Date(expiresAt).getTime()
      const diff = expiry - now
      
      if (diff <= 0) return 'Expired'
      
      const h = Math.floor(diff / (1000 * 60 * 60))
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      
      const d = Math.floor(h / 24)
      const rh = h % 24

      if (d > 0) return `${d}d ${rh}h`
      if (h > 0) return `${h}h ${m}m`
      return `${m}m`
    }
    
    setTimeLeftStr(calculateTimeLeft())
    const interval = setInterval(() => {
      setTimeLeftStr(calculateTimeLeft())
    }, 60000) // Update every minute
    
    return () => clearInterval(interval)
  }, [expiresAt])

  return (
    <div className="link-generated-container">
      <div className="link-generated-view">
        <div className="success-icon">
          <Check size={28} />
        </div>
        
        <h2>Link Generated</h2>
        <p className="sub">This link works <strong>exactly once</strong>. Share it carefully.</p>

        <div className="link-box">
          <span className="link-display">{shareUrl}</span>
          <button className="copy-btn" onClick={copy}>
            {copied ? (
              <span className="btn-inner"><Check size={14} /> Copied</span>
            ) : (
              <span className="btn-inner"><Copy size={14} /> Copy</span>
            )}
          </button>
        </div>

        <div className="link-meta">
          <div className="meta-item">
            <Clock size={15} className="meta-svg" />
            <span>Expires in <strong>{timeLeftStr}</strong></span>
          </div>
          <div className="meta-item">
            <Eye size={15} className="meta-svg" />
            <span>Views allowed: <strong>1</strong></span>
          </div>
          <div className="meta-item">
            <ShieldCheck size={15} className="meta-svg" />
            <span>Watermark: <strong>{watermarkText === 'disabled' ? 'Disabled' : watermarkText || 'Enabled'}</strong></span>
          </div>
        </div>

        <div className="action-row">
          <button className="preview-btn" onClick={handlePreview}>
            Preview as recipient →
          </button>
          {onReset && (
            <button className="reset-btn" onClick={onReset}>
              Upload new photos
            </button>
          )}
        </div>

        {watermarkText !== 'disabled' && (
          <div className="warning-banner">
            <AlertOctagon size={16} className="warning-svg" />
            <span className="warning-title">SECURITY BRIEF</span>
            <p className="warning-body">The recipient's session ID will be embedded in all watermarks. Screenshots are traceable.</p>
          </div>
        )}
      </div>
    </div>
  )
}
