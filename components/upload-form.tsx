'use client'

import { useState } from 'react'
import { Shield, Upload, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dropzone } from '@/components/dropzone'
import { ShareLinkDisplay } from '@/components/share-link-display'

interface FileWithPreview extends File {
  preview: string
}

interface ShareResult {
  url: string
  expiresAt: string
}

export function UploadForm() {
  const [files, setFiles] = useState<FileWithPreview[]>([])
  const [title, setTitle] = useState('')
  const [watermarkText, setWatermarkText] = useState('Confidential')
  const [expiryHours, setExpiryHours] = useState('24')
  const [isUploading, setIsUploading] = useState(false)
  const [shareResult, setShareResult] = useState<ShareResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (files.length === 0) {
      setError('Please select at least one image')
      return
    }

    setIsUploading(true)
    setError(null)

    try {
      const formData = new FormData()
      files.forEach(file => formData.append('files', file))
      formData.append('title', title || 'Untitled Gallery')
      formData.append('watermarkText', watermarkText)
      formData.append('expiryHours', expiryHours)

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
      setTitle('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setIsUploading(false)
    }
  }

  const handleReset = () => {
    setShareResult(null)
    setError(null)
  }

  if (shareResult) {
    return (
      <div className="space-y-4">
        <ShareLinkDisplay shareUrl={shareResult.url} expiresAt={shareResult.expiresAt} />
        <Button onClick={handleReset} variant="outline" className="w-full">
          Create Another Share Link
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="size-5" />
            Upload Photos
          </CardTitle>
          <CardDescription>
            Upload images and create a secure, time-limited share link
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Dropzone files={files} setFiles={setFiles} />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="title">Gallery Title (optional)</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="My Photos"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="watermark">Watermark Text</Label>
              <Input
                id="watermark"
                value={watermarkText}
                onChange={(e) => setWatermarkText(e.target.value)}
                placeholder="Confidential"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="expiry">Link Expiry</Label>
            <Select value={expiryHours} onValueChange={setExpiryHours}>
              <SelectTrigger id="expiry" className="w-full sm:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 hour</SelectItem>
                <SelectItem value="6">6 hours</SelectItem>
                <SelectItem value="12">12 hours</SelectItem>
                <SelectItem value="24">24 hours</SelectItem>
                <SelectItem value="48">48 hours</SelectItem>
                <SelectItem value="168">7 days</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <Button 
            type="submit" 
            disabled={isUploading || files.length === 0}
            className="w-full"
            size="lg"
          >
            {isUploading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="size-4" />
                Create Share Link
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </form>
  )
}
