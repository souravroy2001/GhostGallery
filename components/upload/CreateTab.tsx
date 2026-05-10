'use client'

import React from 'react'
import { Plus, Loader2 } from 'lucide-react'
import { FileWithPreview, EXPIRY_OPTIONS } from './types'

interface CreateTabProps {
  createType: 'photos' | 'links';
  setCreateType: (t: 'photos' | 'links') => void;
  error: string | null;
  setError: (e: string | null) => void;
  dragging: boolean;
  setDragging: (b: boolean) => void;
  files: FileWithPreview[];
  processFiles: (newFiles: FileList | File[] | null) => void;
  removeFile: (e: React.MouseEvent, id: string) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  targetUrl: string;
  setTargetUrl: (v: string) => void;
  expiryHours: number;
  setExpiryHours: (n: number) => void;
  watermarkEnabled: boolean;
  setWatermarkEnabled: (b: boolean) => void;
  watermarkText: string;
  setWatermarkText: (s: string) => void;
  galleryTitle: string;
  setGalleryTitle: (s: string) => void;
  isUploading: boolean;
  uploadProgress: number;
  handleGenerate: () => Promise<void>;
  showCustomAlert: (title: string, message: string, icon?: 'info' | 'success' | 'warning' | 'danger') => void;
  toast: (opts: any) => void;
}

export function CreateTab({
  createType, setCreateType, error, setError, dragging, setDragging, files, processFiles, removeFile,
  fileInputRef, targetUrl, setTargetUrl, expiryHours, setExpiryHours, watermarkEnabled, setWatermarkEnabled,
  watermarkText, setWatermarkText, galleryTitle, setGalleryTitle, isUploading, uploadProgress, handleGenerate,
  showCustomAlert, toast
}: CreateTabProps) {

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files)
    } else {
      const html = e.dataTransfer.getData('text/html')
      const url = e.dataTransfer.getData('URL') || e.dataTransfer.getData('text/uri-list')
      let imgSrc = url
      if (html) {
        const match = html.match(/src\s*=\s*"([^"]+)"/)
        if (match) imgSrc = match[1]
      }
      if (imgSrc) {
        try {
          toast({ title: 'Fetching image...', description: 'Downloading from external site' })
          const res = await fetch(`/api/proxy-image?url=${encodeURIComponent(imgSrc)}`)
          if (!res.ok) throw new Error('Proxy failed')
          const blob = await res.blob()
          const file = new File([blob], "dragged-image.jpg", { type: blob.type || 'image/jpeg' })
          processFiles([file])
        } catch (err) {
          showCustomAlert('FETCH FAILED', 'Could not fetch the external image. Try saving it to your computer first.', 'danger')
        }
      }
    }
  }

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '22px' }} className="gg-animate-up">

      {/* Subtabs for Photos vs Links */}
      <div style={{ display: 'flex', gap: 6, width: '100%', background: 'rgba(255,255,255,.03)', padding: 4, borderRadius: 10, border: '1px solid rgba(255,255,255,.05)' }}>
        <button
          onClick={() => { setCreateType('photos'); setError(null) }}
          style={{
            flex: 1, padding: '10px', borderRadius: 8, cursor: 'pointer', border: 'none',
            fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700, letterSpacing: '.05em', transition: 'all .2s',
            background: createType === 'photos' ? 'rgba(0,229,255,.08)' : 'transparent',
            color: createType === 'photos' ? '#00e5ff' : 'rgba(136,146,164,.6)',
            borderBottom: createType === 'photos' ? '1px solid rgba(0,229,255,.3)' : '1px solid transparent'
          }}
          type="button"
        >
          PHOTOS & IMAGES
        </button>
        <button
          onClick={() => { setCreateType('links'); setError(null) }}
          style={{
            flex: 1, padding: '10px', borderRadius: 8, cursor: 'pointer', border: 'none',
            fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700, letterSpacing: '.05em', transition: 'all .2s',
            background: createType === 'links' ? 'rgba(0,229,255,.08)' : 'transparent',
            color: createType === 'links' ? '#00e5ff' : 'rgba(136,146,164,.6)',
            borderBottom: createType === 'links' ? '1px solid rgba(0,229,255,.3)' : '1px solid transparent'
          }}
          type="button"
        >
          SECURE WEBSITES & LINKS
        </button>
      </div>

      {/* Drop zone / URL input */}
      {createType === 'photos' ? (
        <div
          className={`gg-dropzone${dragging ? ' drag-over' : ''}`}
          style={{ minHeight: files.length ? 'auto' : 200 }}
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => !files.length && fileInputRef.current?.click()}
        >
          {files.length === 0 ? (
            <div style={{ padding: '48px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, userSelect: 'none' }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', border: '1px solid rgba(0,229,255,.3)', background: 'rgba(0,229,255,.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 20px rgba(0,229,255,.15)' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#00e5ff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </div>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'rgba(200,216,232,.8)', margin: '0 0 4px' }}>
                  Drop images here or <span style={{ color: '#00e5ff', textDecoration: 'underline', cursor: 'pointer' }}>browse files</span>
                </p>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'rgba(136,146,164,.5)', margin: 0, letterSpacing: '.04em' }}>PNG · JPG · WEBP · Multiple files</p>
              </div>
            </div>
          ) : (
            <div style={{ padding: 16 }}>
              <div className="gg-scroll" style={{ display: 'flex', overflowX: 'auto', gap: 10, paddingBottom: 8 }}>
                {files.map(img => (
                  <div key={img.id} className="gg-thumb" style={{ width: 90, flexShrink: 0 }}>
                    <img src={img.preview} alt={img.name} />
                    <button className="gg-remove" onClick={e => removeFile(e, img.id)}>×</button>
                  </div>
                ))}
                <div onClick={e => { e.stopPropagation(); fileInputRef.current?.click() }} style={{
                  width: 90,
                  flexShrink: 0,
                  aspectRatio: '1', borderRadius: 8, border: '1px dashed rgba(0,229,255,.2)',
                  background: 'rgba(0,229,255,.03)', display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', gap: 4, cursor: 'pointer',
                  color: 'rgba(136,146,164,.5)', fontSize: 11, fontFamily: 'var(--font-mono)', transition: 'all .15s',
                }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(0,229,255,.4)'; (e.currentTarget as HTMLDivElement).style.color = '#00e5ff' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(0,229,255,.2)'; (e.currentTarget as HTMLDivElement).style.color = 'rgba(136,146,164,.5)' }}
                >
                  <Plus size={18} /><span>Add</span>
                </div>
              </div>
            </div>
          )}
          <input ref={fileInputRef} type="file" multiple accept="image/*" style={{ display: 'none' }} onChange={e => processFiles(e.target.files)} />
        </div>
      ) : (
        <div className="gg-card gg-animate-up" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'rgba(136,146,164,.5)', letterSpacing: '.08em' }}>WEBSITE OR LINK DESTINATION</label>
            <input className="gg-input" type="url" value={targetUrl} onChange={e => { setTargetUrl(e.target.value); setError(null) }} placeholder="https://example.com/private/document" />
          </div>
          <p style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'rgba(136,146,164,.4)', letterSpacing: '.03em' }}>
            <span style={{ color: 'rgba(0,229,255,.5)', marginRight: 6 }}>⬡</span>The destination URL will be hidden from the receiver using our reverse proxy wrapper.
          </p>
        </div>
      )}

      {/* Expiry */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <span className="gg-section-label">Link expires in</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {EXPIRY_OPTIONS.map(opt => (
            <button key={opt.hours} className={`gg-pill ${expiryHours === opt.hours ? 'active' : ''}`}
              onClick={() => setExpiryHours(opt.hours)}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Settings card */}
      <div className="gg-card" style={{ gap: 0 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(0,229,255,.08)', border: '1px solid rgba(0,229,255,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#00e5ff', fontSize: 13 }}>⬡</div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '.08em', color: 'rgba(200,216,232,.7)', textTransform: 'uppercase' }}>Gallery Settings</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'rgba(136,146,164,.6)', letterSpacing: '.06em' }}>WATERMARK</span>
            <label className="gg-toggle">
              <input type="checkbox" checked={watermarkEnabled} onChange={e => setWatermarkEnabled(e.target.checked)} />
              <span className="gg-toggle-track" />
              <span className="gg-toggle-thumb" />
            </label>
          </div>
        </div>

        {/* Fields */}
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 180, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'rgba(136,146,164,.5)', letterSpacing: '.08em' }}>{createType === 'links' ? 'LINK TITLE' : 'GALLERY TITLE'}</label>
            <input className="gg-input" type="text" value={galleryTitle} onChange={e => setGalleryTitle(e.target.value)} placeholder={createType === 'links' ? 'Secure Link' : 'Ghost Gallery'} />
          </div>

          {watermarkEnabled && (
            <div style={{ flex: 1, minWidth: 180, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'rgba(136,146,164,.5)', letterSpacing: '.08em' }}>WATERMARK OVERLAY</label>
              <input className="gg-input" type="text" value={watermarkText} onChange={e => setWatermarkText(e.target.value)} placeholder="CONFIDENTIAL" maxLength={24} />
            </div>
          )}
        </div>

        <p style={{ marginTop: 14, marginBottom: 0, fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'rgba(136,146,164,.4)', letterSpacing: '.03em' }}>
          <span style={{ color: 'rgba(0,229,255,.5)', marginRight: 6 }}>⬡</span>Settings are encrypted and stored securely with the gallery.
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="gg-error gg-animate-up">
          <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'rgba(239,68,68,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 11, fontWeight: 700 }}>!</div>
          <span>{error}</span>
        </div>
      )}

      {/* Progress bar (uploading) */}
      {isUploading && files.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'rgba(136,146,164,.6)' }}>
            <span>{uploadProgress < files.length ? `Uploading photo ${uploadProgress + 1} of ${files.length}` : 'Finalizing…'}</span>
            <span>{Math.round((uploadProgress / files.length) * 100)}%</span>
          </div>
          <div className="gg-progress-bar">
            <div className="gg-progress-fill" style={{ width: `${(uploadProgress / files.length) * 100}%` }} />
          </div>
        </div>
      )}

      {/* Generate button */}
      <button
        className={`gg-generate${(createType === 'photos' ? files.length : !!targetUrl) ? ' ready' : ' disabled'}${isUploading ? ' loading' : ''}`}
        onClick={handleGenerate} disabled={!(createType === 'photos' ? files.length : !!targetUrl) || isUploading} type="button"
      >
        {isUploading
          ? <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              <Loader2 size={15} style={{ animation: 'gg-spin 1s linear infinite' }} />
              {createType === 'photos'
                ? (uploadProgress < files.length ? `Processing ${uploadProgress + 1} / ${files.length}` : 'Finalizing gallery…')
                : 'Creating secure proxy link…'
              }
            </span>
          : <span>Generate Secure Link {createType === 'photos' && files.length > 0 && `— ${files.length} photo${files.length > 1 ? 's' : ''}`} →</span>
        }
      </button>
    </div>
  )
}
