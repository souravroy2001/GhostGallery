'use client'

import { useState, useCallback } from 'react'
import { Copy, Check, ExternalLink, Clock, Shield, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface ShareLinkDisplayProps {
  shareUrl: string
  expiresAt: string
}

export function ShareLinkDisplay({ shareUrl, expiresAt }: ShareLinkDisplayProps) {
  const [copied, setCopied] = useState(false)

  const copyToClipboard = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }, [shareUrl])

  const expiryDate = new Date(expiresAt)
  const timeUntilExpiry = expiryDate.getTime() - Date.now()
  const hoursUntilExpiry = Math.round(timeUntilExpiry / (1000 * 60 * 60))

  return (
    <Card className="border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-400">
          <Check className="size-5" />
          Share Link Created
        </CardTitle>
        <CardDescription>
          Your secure link is ready to share
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="flex-1 truncate rounded-md border bg-background p-3 font-mono text-sm">
            {shareUrl}
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={copyToClipboard}
            className="shrink-0"
          >
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            <span className="sr-only">{copied ? 'Copied' : 'Copy link'}</span>
          </Button>
          <Button
            variant="outline"
            size="icon"
            asChild
            className="shrink-0"
          >
            <a href={shareUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="size-4" />
              <span className="sr-only">Open in new tab</span>
            </a>
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex items-start gap-3 rounded-lg border bg-background p-3">
            <Clock className="size-5 text-muted-foreground" />
            <div>
              <p className="font-medium text-sm">Expires in {hoursUntilExpiry} hour{hoursUntilExpiry !== 1 ? 's' : ''}</p>
              <p className="text-xs text-muted-foreground">
                {expiryDate.toLocaleString()}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-lg border bg-background p-3">
            <Shield className="size-5 text-muted-foreground" />
            <div>
              <p className="font-medium text-sm">One-time access</p>
              <p className="text-xs text-muted-foreground">
                Session-locked after first view
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          <AlertTriangle className="size-4 mt-0.5 shrink-0" />
          <p className="text-xs">
            Save this link now. It will only be shown once and cannot be retrieved later.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
