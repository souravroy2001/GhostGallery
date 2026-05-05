'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, ChevronLeft, ChevronRight, AlertCircle, Clock, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

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

export function ImageViewer({ token }: ImageViewerProps) {
  const [gallery, setGallery] = useState<GalleryData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [expiresAt, setExpiresAt] = useState<string | null>(null)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [isBlurred, setIsBlurred] = useState(false)

  // Validate token and load gallery
  useEffect(() => {
    const validateToken = async () => {
      try {
        const response = await fetch('/api/validate-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        })

        const data = await response.json()

        if (!response.ok || !data.valid) {
          setError(data.error || 'Invalid or expired link')
          return
        }

        setGallery(data.gallery)
        setExpiresAt(data.expiresAt)
      } catch (err) {
        setError('Failed to load gallery')
        console.error('Validation error:', err)
      } finally {
        setLoading(false)
      }
    }

    validateToken()
  }, [token])

  // Tab blur detection
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsBlurred(true)
      }
    }

    const handleBlur = () => {
      setIsBlurred(true)
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('blur', handleBlur)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('blur', handleBlur)
    }
  }, [])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedIndex === null || !gallery) return

      if (e.key === 'Escape') {
        setSelectedIndex(null)
      } else if (e.key === 'ArrowRight') {
        setSelectedIndex((selectedIndex + 1) % gallery.images.length)
      } else if (e.key === 'ArrowLeft') {
        setSelectedIndex((selectedIndex - 1 + gallery.images.length) % gallery.images.length)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedIndex, gallery])

  // Context menu prevention
  useEffect(() => {
    const preventContextMenu = (e: MouseEvent) => {
      e.preventDefault()
    }

    // Prevent keyboard shortcuts for save/print
    const preventShortcuts = (e: KeyboardEvent) => {
      // Prevent Ctrl+S, Ctrl+P, Ctrl+Shift+S
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'p' || e.key === 'S' || e.key === 'P')) {
        e.preventDefault()
      }
      // Prevent PrintScreen
      if (e.key === 'PrintScreen') {
        e.preventDefault()
      }
    }

    document.addEventListener('contextmenu', preventContextMenu)
    document.addEventListener('keydown', preventShortcuts)
    return () => {
      document.removeEventListener('contextmenu', preventContextMenu)
      document.removeEventListener('keydown', preventShortcuts)
    }
  }, [])

  const getImageUrl = useCallback((pathname: string) => {
    return `/api/image?pathname=${encodeURIComponent(pathname)}&token=${encodeURIComponent(token)}`
  }, [token])

  const openLightbox = (index: number) => {
    setSelectedIndex(index)
  }

  const closeLightbox = () => {
    setSelectedIndex(null)
  }

  const goNext = () => {
    if (gallery && selectedIndex !== null) {
      setSelectedIndex((selectedIndex + 1) % gallery.images.length)
    }
  }

  const goPrev = () => {
    if (gallery && selectedIndex !== null) {
      setSelectedIndex((selectedIndex - 1 + gallery.images.length) % gallery.images.length)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="size-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted-foreground">Validating access...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="max-w-md text-center space-y-4">
          <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-destructive/10">
            <AlertCircle className="size-8 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold">Access Denied</h1>
          <p className="text-muted-foreground">{error}</p>
          <p className="text-sm text-muted-foreground">
            This link may have expired, been used by another device, or is invalid.
          </p>
        </div>
      </div>
    )
  }

  if (!gallery) return null

  const timeUntilExpiry = expiresAt ? new Date(expiresAt).getTime() - Date.now() : 0
  const minutesUntilExpiry = Math.max(0, Math.round(timeUntilExpiry / (1000 * 60)))

  return (
    <div className="min-h-screen pb-8">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Shield className="size-5 text-muted-foreground" />
            <div>
              <h1 className="font-semibold">{gallery.title}</h1>
              <p className="text-xs text-muted-foreground">
                {gallery.images.length} image{gallery.images.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="size-4" />
            <span>
              {minutesUntilExpiry > 60 
                ? `${Math.round(minutesUntilExpiry / 60)}h remaining`
                : `${minutesUntilExpiry}m remaining`
              }
            </span>
          </div>
        </div>
      </header>

      {/* Blur overlay when tab loses focus */}
      {isBlurred && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-xl">
          <div className="text-center space-y-4 p-8">
            <AlertCircle className="mx-auto size-12 text-muted-foreground" />
            <h2 className="text-xl font-semibold">Session Paused</h2>
            <p className="text-muted-foreground max-w-sm">
              You navigated away from this page. Click below to continue viewing.
            </p>
            <Button onClick={() => setIsBlurred(false)}>
              Continue Viewing
            </Button>
          </div>
        </div>
      )}

      {/* Image Grid */}
      <main className="mx-auto max-w-7xl px-4 py-6 secure-image-container">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {gallery.images.map((image, index) => (
            <button
              key={image.id}
              onClick={() => openLightbox(index)}
              className="group relative aspect-square overflow-hidden rounded-lg bg-muted focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            >
              {/* Image with watermark */}
              <div className="relative size-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={getImageUrl(image.pathname)}
                  alt={image.filename}
                  className="size-full object-cover transition-transform group-hover:scale-105"
                  draggable={false}
                  onDragStart={(e) => e.preventDefault()}
                />
                {/* Watermark overlay */}
                <div 
                  className="pointer-events-none absolute inset-0 flex items-center justify-center"
                  style={{ userSelect: 'none' }}
                >
                  <span 
                    className="rotate-[-30deg] text-white/20 font-bold text-lg whitespace-nowrap select-none"
                    style={{ 
                      textShadow: '0 0 2px rgba(0,0,0,0.3)',
                      WebkitUserSelect: 'none',
                      MozUserSelect: 'none',
                      msUserSelect: 'none',
                    }}
                  >
                    {gallery.watermarkText}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </main>

      {/* Lightbox */}
      {selectedIndex !== null && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/95"
          onClick={closeLightbox}
        >
          {/* Close button */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-4 top-4 text-white hover:bg-white/10"
            onClick={closeLightbox}
          >
            <X className="size-6" />
            <span className="sr-only">Close</span>
          </Button>

          {/* Navigation buttons */}
          {gallery.images.length > 1 && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/10"
                onClick={(e) => { e.stopPropagation(); goPrev() }}
              >
                <ChevronLeft className="size-8" />
                <span className="sr-only">Previous</span>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/10"
                onClick={(e) => { e.stopPropagation(); goNext() }}
              >
                <ChevronRight className="size-8" />
                <span className="sr-only">Next</span>
              </Button>
            </>
          )}

          {/* Image with watermark */}
          <div 
            className="relative max-h-[90vh] max-w-[90vw] secure-image-container"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={getImageUrl(gallery.images[selectedIndex].pathname)}
              alt={gallery.images[selectedIndex].filename}
              className="max-h-[90vh] max-w-[90vw] object-contain"
              draggable={false}
              onDragStart={(e) => e.preventDefault()}
            />
            {/* Fullscreen watermark overlay */}
            <div 
              className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden"
              style={{ userSelect: 'none' }}
            >
              {/* Multiple watermarks in a grid pattern */}
              <div className="absolute inset-0 grid grid-cols-3 grid-rows-3">
                {Array.from({ length: 9 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-center">
                    <span 
                      className="rotate-[-30deg] text-white/15 font-bold text-xl whitespace-nowrap select-none"
                      style={{ 
                        textShadow: '0 0 4px rgba(0,0,0,0.5)',
                        WebkitUserSelect: 'none',
                        MozUserSelect: 'none',
                        msUserSelect: 'none',
                      }}
                    >
                      {gallery.watermarkText}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Image counter */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-sm text-white/70">
            {selectedIndex + 1} / {gallery.images.length}
          </div>
        </div>
      )}
    </div>
  )
}
