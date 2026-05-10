'use client'

import React from 'react'
import { WatermarkCanvas } from './WatermarkCanvas'
import { GalleryData } from './types'

interface LightboxProps {
  gallery: GalleryData
  index: number
  onClose: () => void
  setLightbox: (idx: number) => void
  getImageUrl: (pathname: string) => string
  sessionId: string
  blurred: boolean
}

export function Lightbox({
  gallery, index, onClose, setLightbox, getImageUrl, sessionId, blurred
}: LightboxProps) {
  return (
    <div className="iv-lightbox" onClick={onClose}>
      <button className="iv-lightbox-close" onClick={onClose}>×</button>

      {gallery.images.length > 1 && (
        <>
          <button className="iv-lb-nav prev" onClick={e => { e.stopPropagation(); setLightbox((index - 1 + gallery.images.length) % gallery.images.length) }}>‹</button>
          <button className="iv-lb-nav next" onClick={e => { e.stopPropagation(); setLightbox((index + 1) % gallery.images.length) }}>›</button>
        </>
      )}

      <div className="lightbox-content" onClick={e => e.stopPropagation()} style={{ maxHeight: '80vh', maxWidth: '90vw', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <WatermarkCanvas
          src={getImageUrl(gallery.images[index].pathname)}
          sessionId={sessionId}
          visible={!blurred}
          watermarkText={gallery.watermarkText}
          objectFit="contain"
          className="lightbox-image"
        />
      </div>

      <div className="iv-lb-counter">
        <div className="iv-lb-title">{gallery.title || 'GHOST GALLERY'}</div>
        <div className="iv-lb-nums">
          <div className="iv-lb-dot-track">
            {gallery.images.map((_, i) => (
              <div key={i} className={`iv-lb-dot ${i === index ? 'cur' : ''}`}
                onClick={e => { e.stopPropagation(); setLightbox(i) }}
                style={{ cursor: 'pointer' }}
              />
            ))}
          </div>
          <span style={{ marginLeft: 10 }}>{index + 1} / {gallery.images.length}</span>
        </div>
      </div>
    </div>
  )
}
