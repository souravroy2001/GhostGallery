'use client'

import { useState, useRef } from 'react'
import { ShareLinkDisplay } from '@/components/share-link-display'
import { Lock, Droplet, Clock, Link2Off } from 'lucide-react'

interface FileWithPreview extends File {
  preview: string
  id: string
}

interface ShareResult {
  url: string
  expiresAt: string
}

const EXPIRY_OPTIONS = [
  { label: "1 hour", hours: 1 },
  { label: "6 hours", hours: 6 },
  { label: "12 hours", hours: 12 },
  { label: "24 hours", hours: 24 },
  { label: "7 days", hours: 168 },
]

export function UploadForm() {
  const [files, setFiles] = useState<FileWithPreview[]>([])
  const [expiryHours, setExpiryHours] = useState<number>(EXPIRY_OPTIONS[3].hours)
  const [dragging, setDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [shareResult, setShareResult] = useState<ShareResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [watermarkEnabled, setWatermarkEnabled] = useState(true)
  const [watermarkText, setWatermarkText] = useState('CONFIDENTIAL')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const processFiles = (newFiles: FileList | null) => {
    if (!newFiles) return
    const validFiles = Array.from(newFiles).filter(f => f.type.startsWith('image/'))
    
    validFiles.forEach(file => {
      const preview = URL.createObjectURL(file)
      const fileWithPreview = Object.assign(file, {
        preview,
        id: Math.random().toString(36).substring(7)
      })
      setFiles(prev => [...prev, fileWithPreview])
    })
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    processFiles(e.dataTransfer.files)
  }

  const removeFile = (e: React.MouseEvent, idToRemove: string) => {
    e.stopPropagation()
    setFiles(prev => {
      const filtered = prev.filter(f => f.id !== idToRemove)
      // Revoke the object URL to free memory
      const removed = prev.find(f => f.id === idToRemove)
      if (removed) URL.revokeObjectURL(removed.preview)
      return filtered
    })
  }

  const handleGenerate = async () => {
    if (files.length === 0) {
      setError('Please select at least one image')
      return
    }

    setIsUploading(true)
    setError(null)

    try {
      const formData = new FormData()
      files.forEach(file => formData.append('files', file))
      formData.append('title', 'GhostGallery') // Default title for now
      formData.append('watermarkText', watermarkEnabled ? watermarkText : 'disabled')
      formData.append('expiryHours', expiryHours.toString())

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed')
      }

      setShareResult({
        url: data.shareLink.url,
        expiresAt: data.shareLink.expiresAt,
      })

      // Clean up previews
      files.forEach(file => URL.revokeObjectURL(file.preview))
      setFiles([])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setIsUploading(false)
    }
  }

  if (shareResult) {
    return (
      <ShareLinkDisplay 
        shareUrl={shareResult.url} 
        expiresAt={shareResult.expiresAt} 
        watermarkText={watermarkEnabled ? watermarkText : 'disabled'}
        onReset={() => {
          setShareResult(null)
          setError(null)
        }} 
      />
    )
  }

  return (
    <div className="upload-view">
      <div className="hero-text">
        <div className="logo-mark">⬡</div>
        <h1>GHOST<span className="accent">GALLERY</span></h1>
        <p className="tagline">One-time secure photo delivery. View once. Gone forever.</p>
      </div>

      {/* Drop Zone */}
      <div
        className={`dropzone ${dragging ? "drag-over" : ""} ${files.length ? "has-files" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => !files.length && fileInputRef.current?.click()}
      >
        {files.length === 0 ? (
          <div className="drop-prompt">
            <div className="drop-icon">⬆</div>
            <p>Drop images here or <span className="link-text">browse files</span></p>
            <p className="hint">PNG, JPG, WEBP — multiple files supported</p>
          </div>
        ) : (
          <div className="preview-grid">
            {files.map((img) => (
              <div key={img.id} className="preview-thumb">
                <img src={img.preview} alt={img.name} />
                <button
                  className="remove-btn"
                  onClick={(e) => removeFile(e, img.id)}
                >×</button>
              </div>
            ))}
            <div
              className="add-more"
              onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
            >
              <span>+</span>
              <p>Add more</p>
            </div>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          style={{ display: "none" }}
          onChange={(e) => processFiles(e.target.files)}
        />
      </div>

      {/* Expiry Selector */}
      <div className="expiry-section">
        <p className="section-label">⏱ LINK EXPIRES IN</p>
        <div className="expiry-options">
          {EXPIRY_OPTIONS.map((opt) => (
            <button
              key={opt.hours}
              type="button"
              className={`expiry-btn ${expiryHours === opt.hours ? "active" : ""}`}
              onClick={() => setExpiryHours(opt.hours)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Watermark Section */}
      <div className="watermark-section" style={{ width: '100%', background: 'rgba(20, 28, 35, 0.4)', border: '1px solid var(--border)', borderRadius: '4px', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px', boxShadow: '0 4px 15px rgba(0, 0, 0, 0.15)', textAlign: 'left' }}>
        <div className="watermark-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <p className="section-label" style={{ margin: 0 }}>💧 WATERMARK SECURITY</p>
          <label className="toggle-switch">
            <input 
              type="checkbox" 
              checked={watermarkEnabled} 
              onChange={(e) => setWatermarkEnabled(e.target.checked)} 
              style={{ display: 'none' }}
            />
            <span className="slider"></span>
          </label>
        </div>
        
        {watermarkEnabled && (
          <div className="watermark-input-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
            <input
              type="text"
              className="watermark-input"
              value={watermarkText}
              onChange={(e) => setWatermarkText(e.target.value)}
              placeholder="Enter watermark text (e.g., CONFIDENTIAL)"
              maxLength={24}
              style={{
                width: '100%',
                background: 'rgba(8, 12, 15, 0.95)',
                border: '1px solid rgba(0, 229, 255, 0.3)',
                borderRadius: '4px',
                padding: '12px 16px',
                color: '#ffffff',
                fontFamily: 'var(--font-mono), monospace',
                fontSize: '13px',
                outline: 'none',
              }}
            />
            <span className="input-hint" style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono), monospace' }}>
              Will be tiled diagonally over all images
            </span>
          </div>
        )}
      </div>

      {error && (
        <div className="w-full text-center text-sm" style={{ color: 'var(--accent2)' }}>
          {error}
        </div>
      )}

      {/* Generate Button */}
      <button
        className={`generate-btn ${files.length ? "ready" : "disabled"} ${isUploading ? "loading" : ""}`}
        onClick={handleGenerate}
        disabled={!files.length || isUploading}
        type="button"
      >
        {isUploading ? (
          <span className="spinner-text">Encrypting & generating link<span className="dots">...</span></span>
        ) : (
          <span>Generate Secure Link → {files.length > 0 && `(${files.length} photo${files.length > 1 ? "s" : ""})`}</span>
        )}
      </button>

      <div className="security-badges">
        <span><Lock size={14} /> One-time access</span>
        <span><Droplet size={14} /> Watermarked</span>
        <span><Clock size={14} /> Auto-expires</span>
        <span><Link2Off size={14} /> No direct URLs</span>
      </div>
    </div>
  )
}
