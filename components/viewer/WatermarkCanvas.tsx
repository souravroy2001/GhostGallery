'use client'

import { useState, useEffect, useRef } from 'react'

interface WatermarkCanvasProps {
  src: string
  sessionId: string
  visible: boolean
  watermarkText: string
  objectFit?: "contain" | "cover"
  className?: string
}

export function WatermarkCanvas({
  src,
  sessionId,
  visible,
  watermarkText,
  objectFit = "contain",
  className
}: WatermarkCanvasProps) {
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
