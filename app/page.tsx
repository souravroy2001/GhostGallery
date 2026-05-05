import { Shield } from 'lucide-react'
import { UploadForm } from '@/components/upload-form'

export default function HomePage() {
  return (
    <main className="min-h-screen py-8 px-4">
      <div className="mx-auto max-w-2xl space-y-8">
        <header className="text-center space-y-3">
          <div className="flex items-center justify-center gap-2">
            <div className="rounded-full bg-primary p-2">
              <Shield className="size-6 text-primary-foreground" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">SecureShare</h1>
          </div>
          <p className="text-muted-foreground text-balance">
            Share photos securely with time-limited, one-time access links.
            Your images are protected with watermarks and session-locked viewing.
          </p>
        </header>

        <UploadForm />

        <footer className="text-center text-sm text-muted-foreground space-y-1">
          <p>Images are stored securely and never publicly accessible.</p>
          <p>Links automatically expire and cannot be shared with others.</p>
        </footer>
      </div>
    </main>
  )
}
