'use client'

import { useState, useRef, useEffect } from 'react'
import { useToast } from '@/hooks/use-toast'
import { ShareLinkDisplay } from '@/components/share-link-display'
import {
  Lock, Droplet, Clock, Link2Off, Key, Copy, Check, Eye, Trash2,
  Plus, ShieldCheck, AlertOctagon, RefreshCw, Loader2, Layers, Link2
} from 'lucide-react'
import { upload } from '@vercel/blob/client'
import { createClient as createBrowserClient } from '@/lib/supabase/client'

/* ─── Types ─────────────────────────────────────────── */
interface FileWithPreview extends File { preview: string; id: string }
interface ShareResult { url: string; expiresAt: string; originalUrl?: string }

/* ─── Constants ─────────────────────────────────────── */
const EXPIRY_OPTIONS = [
  { label: '1 hr',   hours: 1   },
  { label: '6 hrs',  hours: 6   },
  { label: '12 hrs', hours: 12  },
  { label: '24 hrs', hours: 24  },
  { label: '7 days', hours: 168 },
]

/* ─── Image compression helper ──────────────────────── */
const compressImage = (file: File): Promise<File> =>
  new Promise((resolve) => {
    if (!file.type.startsWith('image/')) return resolve(file)
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.src = url
    img.onload = () => {
      URL.revokeObjectURL(url)
      const canvas = document.createElement('canvas')
      let { width, height } = img
      const MAX_W = 1920, MAX_H = 1080
      if (width > MAX_W || height > MAX_H) {
        if (width > height) { height = Math.round(height * MAX_W / width); width = MAX_W }
        else { width = Math.round(width * MAX_H / height); height = MAX_H }
      }
      canvas.width = width; canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) return resolve(file)
      ctx.drawImage(img, 0, 0, width, height)
      canvas.toBlob(blob => {
        if (!blob) return resolve(file)
        resolve(new File([blob], file.name.replace(/\.[^/.]+$/, '') + '.jpg', { type: 'image/jpeg', lastModified: Date.now() }))
      }, 'image/jpeg', 0.82)
    }
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file) }
  })

/* ═══════════════════════════════════════════════════════
   COMPONENT
═══════════════════════════════════════════════════════ */
export function UploadForm() {
  const { toast } = useToast()

  /* Upload states */
  const [files, setFiles] = useState<FileWithPreview[]>([])
  const [expiryHours, setExpiryHours] = useState<number>(EXPIRY_OPTIONS[3].hours)
  const [dragging, setDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [shareResult, setShareResult] = useState<ShareResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [watermarkEnabled, setWatermarkEnabled] = useState(true)
  const [watermarkText, setWatermarkText] = useState('CONFIDENTIAL')
  const [galleryTitle, setGalleryTitle] = useState('Ghost Gallery')
  const fileInputRef = useRef<HTMLInputElement>(null)

  /* Auth states */
  const supabase = createBrowserClient()
  const [user, setUser] = useState<any>(null)
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authType, setAuthType] = useState<'signin' | 'signup'>('signin')
  const [authError, setAuthError] = useState<string | null>(null)
  const [authLoading, setAuthLoading] = useState(false)

  /* Dashboard states */
  const [activeTab, setActiveTab] = useState<'create' | 'dashboard'>('create')
  const [myGalleries, setMyGalleries] = useState<any[]>([])
  const [dashboardLoading, setDashboardLoading] = useState(false)
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null)
  const [deletingGalleryId, setDeletingGalleryId] = useState<string | null>(null)

  /* Link states */
  const [generatingLinkFor, setGeneratingLinkFor] = useState<string | null>(null)
  const [newLinkHours, setNewLinkHours] = useState<number>(24)
  const [newLinkOneTime, setNewLinkOneTime] = useState<boolean>(true)
  const [newLinkLoading, setNewLinkLoading] = useState(false)
  const [newLinkResult, setNewLinkResult] = useState<any | null>(null)

  /* Add more images */
  const addMoreFileInputRef = useRef<HTMLInputElement>(null)
  const [addingToGalleryId, setAddingToGalleryId] = useState<string | null>(null)
  const [isAddingMore, setIsAddingMore] = useState(false)

  /* Dialog */
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogConfig, setDialogConfig] = useState<{
    type: 'alert' | 'confirm'
    title: string; message: string
    icon: 'info' | 'success' | 'warning' | 'danger'
    onConfirm?: () => void
  } | null>(null)

  const showCustomAlert = (title: string, message: string, icon: 'info' | 'success' | 'warning' | 'danger' = 'info') =>
    { setDialogConfig({ type: 'alert', title, message, icon }); setDialogOpen(true) }
  const showCustomConfirm = (title: string, message: string, icon: 'info' | 'success' | 'warning' | 'danger' = 'warning', onConfirm: () => void) =>
    { setDialogConfig({ type: 'confirm', title, message, icon, onConfirm }); setDialogOpen(true) }

  /* ── Auth lifecycle ── */
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setUser(s?.user || null))
    return () => subscription.unsubscribe()
  }, [])

  /* ── Gallery fetch ── */
  const fetchMyGalleries = async () => {
    setDashboardLoading(true)
    try {
      let galleryList: any[] = []
      const res = await fetch('/api/gallery')
      if (res.ok) galleryList = (await res.json()).galleries || []
      const saved = JSON.parse(localStorage.getItem('ghost_galleries') || '[]')
      const ids = new Set(galleryList.map((g: any) => g.id))
      for (const g of saved) if (!ids.has(g.id)) { galleryList.push(g); ids.add(g.id) }
      const enriched = await Promise.all(galleryList.map(async (g: any) => {
        try {
          const r = await fetch(`/api/gallery?id=${g.id}`)
          return r.ok ? (await r.json()).gallery : { ...g, error: 'Removed or not found' }
        } catch { return { ...g, error: 'Network failed' } }
      }))
      if (galleryList.length) localStorage.setItem('ghost_galleries', JSON.stringify(galleryList))
      setMyGalleries(enriched)
    } catch (err) { console.error(err) }
    finally { setDashboardLoading(false) }
  }

  useEffect(() => { if (user && activeTab === 'dashboard') fetchMyGalleries() }, [user, activeTab])

  /* ── File processing ── */
  const processFiles = async (newFiles: FileList | null) => {
    if (!newFiles) return
    const valid = Array.from(newFiles).filter(f => f.type.startsWith('image/'))
    const currSize = files.reduce((a, f) => a + f.size, 0)
    const newSize  = valid.reduce((a, f) => a + f.size, 0)
    if (currSize + newSize > 50 * 1024 * 1024) {
      showCustomAlert('SIZE LIMIT EXCEEDED', 'Total batch size cannot exceed 50 MB. Please select fewer images.', 'warning')
      return
    }
    const buffered = await Promise.all(valid.map(async (file) => {
      const buf = await file.arrayBuffer()
      const safe = new File([buf], file.name, { type: file.type || 'image/jpeg', lastModified: file.lastModified })
      return Object.assign(safe, { preview: URL.createObjectURL(safe), id: Math.random().toString(36).slice(2, 9) })
    }))
    setFiles(prev => [...prev, ...buffered])
  }

  const removeFile = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    setFiles(prev => {
      const removed = prev.find(f => f.id === id)
      if (removed) URL.revokeObjectURL(removed.preview)
      return prev.filter(f => f.id !== id)
    })
  }

  /* ── Upload ── */
  const handleGenerate = async () => {
    if (!files.length) { setError('Please select at least one image'); return }
    setIsUploading(true); setUploadProgress(0); setError(null)
    try {
      const initRes = await fetch('/api/upload', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'init', title: galleryTitle, watermarkText: watermarkEnabled ? watermarkText : 'disabled' })
      })
      if (!initRes.ok) throw new Error((await initRes.json().catch(() => ({}))).error || 'Init failed')
      const { galleryId } = await initRes.json()
      const uploadedImages: any[] = []
      for (let i = 0; i < files.length; i++) {
        let toUpload: File = files[i]
        try { toUpload = await compressImage(files[i]) } catch {}
        const buf = await toUpload.arrayBuffer()
        const upRes = await fetch(`/api/upload?galleryId=${galleryId}`, {
          method: 'POST', body: buf,
          headers: { 'Content-Type': toUpload.type || 'image/jpeg', 'X-File-Name': encodeURIComponent(toUpload.name || 'upload.jpg') }
        })
        if (!upRes.ok) throw new Error((await upRes.json().catch(() => ({}))).error || `Upload ${i + 1} failed`)
        const blob = await upRes.json()
        uploadedImages.push({ url: blob.url, pathname: blob.pathname, size: blob.size, contentType: blob.contentType, filename: blob.filename })
        setUploadProgress(i + 1)
      }
      const finalRes = await fetch('/api/upload', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'finalize', galleryId, expiryHours, images: uploadedImages })
      })
      if (!finalRes.ok) throw new Error((await finalRes.json().catch(() => ({}))).error || 'Finalize failed')
      const data = await finalRes.json()
      setShareResult({ url: data.shareLink.url, expiresAt: data.shareLink.expiresAt, originalUrl: data.shareLink.originalUrl })
      if (user && data.gallery) {
        const saved = JSON.parse(localStorage.getItem('ghost_galleries') || '[]')
        localStorage.setItem('ghost_galleries', JSON.stringify([{ id: data.gallery.id, title: data.gallery.title, createdAt: new Date().toISOString(), imageCount: data.gallery.imageCount }, ...saved]))
      }
      files.forEach(f => URL.revokeObjectURL(f.preview)); setFiles([])
    } catch (err) { setError(err instanceof Error ? err.message : 'Upload failed') }
    finally { setIsUploading(false) }
  }

  /* ── Add more images ── */
  const handleAddMoreFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = e.target.files
    if (!newFiles || !addingToGalleryId) return
    const valid = Array.from(newFiles).filter(f => f.type.startsWith('image/'))
    if (valid.reduce((a, f) => a + f.size, 0) > 50 * 1024 * 1024) {
      showCustomAlert('SIZE LIMIT', 'Batch cannot exceed 50 MB.', 'warning')
      setAddingToGalleryId(null); if (addMoreFileInputRef.current) addMoreFileInputRef.current.value = ''; return
    }
    setIsAddingMore(true)
    try {
      const buffered = await Promise.all(valid.map(async f => {
        const buf = await f.arrayBuffer(); return new File([buf], f.name, { type: f.type || 'image/jpeg', lastModified: f.lastModified })
      }))
      const uploadedImages: any[] = []
      for (let i = 0; i < buffered.length; i++) {
        let toUpload = buffered[i]; try { toUpload = await compressImage(buffered[i]) } catch {}
        const buf = await toUpload.arrayBuffer()
        const upRes = await fetch(`/api/upload?galleryId=${addingToGalleryId}`, {
          method: 'POST', body: buf,
          headers: { 'Content-Type': toUpload.type || 'image/jpeg', 'X-File-Name': encodeURIComponent(toUpload.name || 'upload.jpg') }
        })
        if (!upRes.ok) throw new Error((await upRes.json().catch(() => ({}))).error || `Upload ${i + 1} failed`)
        uploadedImages.push(await upRes.json())
      }
      const addRes = await fetch('/api/upload', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add_images', galleryId: addingToGalleryId, images: uploadedImages })
      })
      if (!addRes.ok) throw new Error((await addRes.json().catch(() => ({}))).error || 'Add failed')
      toast({ title: 'Images Added', description: `${uploadedImages.length} images added successfully.` })
      fetchMyGalleries()
    } catch (err) { toast({ title: 'Upload Failed', description: err instanceof Error ? err.message : 'Failed', variant: 'destructive' }) }
    finally { setIsAddingMore(false); setAddingToGalleryId(null); if (addMoreFileInputRef.current) addMoreFileInputRef.current.value = '' }
  }

  /* ── Auth ── */
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault(); setAuthLoading(true); setAuthError(null)
    try {
      if (authType === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword })
        if (error) throw error
      } else {
        const { error } = await supabase.auth.signUp({ email: authEmail, password: authPassword })
        if (error) throw error
        showCustomAlert('ACCOUNT CREATED', 'Check your email to verify your account.', 'success')
      }
      setAuthModalOpen(false); setAuthEmail(''); setAuthPassword('')
    } catch (err: any) { setAuthError(err.message || 'Authentication failed') }
    finally { setAuthLoading(false) }
  }

  const handleSignOut = async () => { await supabase.auth.signOut(); setActiveTab('create') }

  /* ── Gallery actions ── */
  const handleDeleteGallery = (id: string) => showCustomConfirm('DELETE GALLERY',
    'Permanently delete this gallery and all photos? This cannot be undone.', 'danger', async () => {
      setDeletingGalleryId(id)
      try {
        const res = await fetch(`/api/gallery?id=${id}`, { method: 'DELETE' })
        if (res.ok) {
          const saved = JSON.parse(localStorage.getItem('ghost_galleries') || '[]')
          localStorage.setItem('ghost_galleries', JSON.stringify(saved.filter((g: any) => g.id !== id)))
          setMyGalleries(prev => prev.filter(g => g.id !== id))
          toast({ title: 'Gallery Deleted', description: 'All assets permanently removed.' })
        } else toast({ title: 'Failed', description: (await res.json()).error || 'Delete failed', variant: 'destructive' })
      } catch { toast({ title: 'Error', description: 'Delete failed.', variant: 'destructive' }) }
      finally { setDeletingGalleryId(null) }
    })

  const handleRevokeLink = (token: string, shortToken: string) => showCustomConfirm('REVOKE LINK',
    'Anyone with this URL will immediately lose access. Continue?', 'warning', async () => {
      try {
        const res = await fetch(`/api/gallery?token=${token}&shortToken=${shortToken}`, { method: 'DELETE' })
        if (res.ok) { fetchMyGalleries(); toast({ title: 'Link Revoked', description: 'Share link invalidated.' }) }
        else toast({ title: 'Failed', description: (await res.json()).error || 'Revoke failed', variant: 'destructive' })
      } catch { toast({ title: 'Error', description: 'Revoke failed.', variant: 'destructive' }) }
    })

  const handleCreateNewLink = async (galleryId: string) => {
    setNewLinkLoading(true)
    try {
      const res = await fetch('/api/gallery', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ galleryId, expiryHours: newLinkHours, oneTimeUse: newLinkOneTime })
      })
      const data = await res.json()
      if (res.ok) { setNewLinkResult(data.shareLink); fetchMyGalleries(); toast({ title: 'Link Created', description: 'New secure share link generated.' }) }
      else toast({ title: 'Failed', description: data.error || 'Generation failed', variant: 'destructive' })
    } catch { toast({ title: 'Error', description: 'Generation failed.', variant: 'destructive' }) }
    finally { setNewLinkLoading(false) }
  }

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text); setCopiedLinkId(id)
    setTimeout(() => setCopiedLinkId(null), 2000)
  }

  /* ── Early return ── */
  if (shareResult) return (
    <ShareLinkDisplay shareUrl={shareResult.url} expiresAt={shareResult.expiresAt}
      watermarkText={watermarkEnabled ? watermarkText : 'disabled'} originalUrl={shareResult.originalUrl}
      onReset={() => { setShareResult(null); setError(null) }} />
  )

  /* ── Colour helpers ── */
  const iconColor = (icon: string) =>
    icon === 'success' ? '#10b981' : icon === 'warning' ? '#f59e0b' : icon === 'danger' ? '#ef4444' : '#00e5ff'
  const iconBg = (icon: string) =>
    icon === 'success' ? 'rgba(16,185,129,.12)' : icon === 'warning' ? 'rgba(245,158,11,.12)' : icon === 'danger' ? 'rgba(239,68,68,.12)' : 'rgba(0,229,255,.12)'

  /* ════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════ */
  return (
    <>
      {/* ── Inline styles ─────────────────────────────── */}
      <style>{`
        /* Scanline + noise overlay */
        .gg-root { position: relative; width: 100%; min-height: 100vh; }
        .gg-root::before {
          content: '';
          position: fixed; inset: 0; pointer-events: none; z-index: 0;
          background-image:
            repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,229,255,.018) 2px, rgba(0,229,255,.018) 4px);
          mix-blend-mode: screen;
        }

        /* Animated corner accent for cards */
        @keyframes gg-pulse { 0%,100%{opacity:.5} 50%{opacity:1} }
        @keyframes gg-fadeup { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }
        @keyframes gg-spin { to{transform:rotate(360deg)} }
        @keyframes gg-blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes gg-glow {
          0%,100%{box-shadow:0 0 10px rgba(0,229,255,.2),0 0 30px rgba(0,229,255,.06)}
          50%{box-shadow:0 0 20px rgba(0,229,255,.4),0 0 60px rgba(0,229,255,.12)}
        }
        @keyframes gg-shimmer {
          from{background-position:-300% 0} to{background-position:300% 0}
        }

        .gg-animate-up { animation: gg-fadeup .35s cubic-bezier(.16,1,.3,1) both }

        /* Drop zone */
        .gg-dropzone {
          width: 100%;
          border: 1px dashed rgba(0,229,255,.25);
          border-radius: 12px;
          background: rgba(0,229,255,.015);
          cursor: pointer;
          transition: border-color .2s, background .2s, box-shadow .2s;
          position: relative; overflow: hidden;
        }
        .gg-dropzone::before {
          content: '';
          position: absolute; inset: 0; pointer-events: none;
          background: radial-gradient(ellipse 60% 40% at 50% 0%, rgba(0,229,255,.06), transparent);
          opacity: 0; transition: opacity .3s;
        }
        .gg-dropzone:hover, .gg-dropzone.drag-over {
          border-color: rgba(0,229,255,.6);
          background: rgba(0,229,255,.04);
          box-shadow: 0 0 0 1px rgba(0,229,255,.12) inset, 0 8px 32px rgba(0,229,255,.06);
        }
        .gg-dropzone:hover::before, .gg-dropzone.drag-over::before { opacity: 1; }
        .gg-dropzone.drag-over { border-style: solid; animation: gg-glow 1.5s ease-in-out infinite; }

        /* Expiry pills */
        .gg-pill {
          padding: 8px 16px; border-radius: 100px;
          font-family: var(--font-mono, monospace); font-size: 11px; letter-spacing: .06em;
          border: 1px solid rgba(0,229,255,.18); background: transparent;
          color: var(--text-muted, #8892a4); cursor: pointer;
          transition: all .18s cubic-bezier(.16,1,.3,1);
        }
        .gg-pill:hover { border-color: rgba(0,229,255,.45); color: #c8d8e8; }
        .gg-pill.active {
          border-color: rgba(0,229,255,.7); background: rgba(0,229,255,.1);
          color: #00e5ff; box-shadow: 0 0 12px rgba(0,229,255,.2), inset 0 0 12px rgba(0,229,255,.06);
        }

        /* Toggle */
        .gg-toggle { position: relative; width: 40px; height: 22px; flex-shrink: 0; cursor: pointer; }
        .gg-toggle input { opacity: 0; width: 0; height: 0; }
        .gg-toggle-track {
          position: absolute; inset: 0; border-radius: 100px;
          background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.12);
          transition: all .2s;
        }
        .gg-toggle input:checked ~ .gg-toggle-track {
          background: rgba(0,229,255,.2); border-color: rgba(0,229,255,.5);
          box-shadow: 0 0 8px rgba(0,229,255,.3);
        }
        .gg-toggle-thumb {
          position: absolute; top: 3px; left: 3px;
          width: 14px; height: 14px; border-radius: 50%;
          background: #fff; opacity: .35; transition: all .2s;
          box-shadow: 0 1px 4px rgba(0,0,0,.4);
        }
        .gg-toggle input:checked ~ .gg-toggle-thumb { transform: translateX(18px); opacity: 1; background: #00e5ff; }

        /* Input */
        .gg-input {
          width: 100%; padding: 13px 16px;
          background: rgba(0,0,0,.4); border: 1px solid rgba(255,255,255,.08);
          border-radius: 8px; color: #e8f0f8;
          font-family: var(--font-mono, monospace); font-size: 13px; letter-spacing: .04em;
          outline: none; transition: border-color .18s, box-shadow .18s;
        }
        .gg-input::placeholder { color: rgba(136,146,164,.5); }
        .gg-input:focus {
          border-color: rgba(0,229,255,.5);
          box-shadow: 0 0 0 3px rgba(0,229,255,.08), 0 0 16px rgba(0,229,255,.08);
        }

        /* Card */
        .gg-card {
          background: linear-gradient(135deg, rgba(14,22,32,.85), rgba(10,16,24,.7));
          border: 1px solid rgba(255,255,255,.07);
          border-radius: 12px; padding: 24px;
          transition: border-color .2s, box-shadow .2s;
          backdrop-filter: blur(8px);
          position: relative; overflow: hidden;
        }
        .gg-card::after {
          content: ''; position: absolute; inset: 0; pointer-events: none;
          background: radial-gradient(ellipse 80% 60% at 50% -20%, rgba(0,229,255,.04), transparent);
        }
        .gg-card:hover { border-color: rgba(0,229,255,.15); box-shadow: 0 4px 32px rgba(0,0,0,.3); }

        /* Generate button */
        .gg-generate {
          width: 100%; padding: 16px;
          font-family: var(--font-mono, monospace); font-size: 13px; letter-spacing: .08em; font-weight: 700;
          border: none; border-radius: 10px; cursor: pointer;
          position: relative; overflow: hidden;
          transition: all .25s cubic-bezier(.16,1,.3,1);
        }
        .gg-generate.ready {
          background: linear-gradient(135deg, #00c8e6, #00e5ff 50%, #00c8e6);
          background-size: 200% 100%;
          color: #041a20;
          box-shadow: 0 4px 20px rgba(0,229,255,.35), 0 0 0 0 rgba(0,229,255,.3);
        }
        .gg-generate.ready:hover {
          background-position: 100% 0;
          box-shadow: 0 6px 30px rgba(0,229,255,.5), 0 0 40px rgba(0,229,255,.15);
          transform: translateY(-1px);
        }
        .gg-generate.ready:active { transform: translateY(0); }
        .gg-generate.ready::before {
          content: ''; position: absolute; inset: 0;
          background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,.25) 50%, transparent 100%);
          background-size: 200% 100%; animation: gg-shimmer 2s linear infinite;
        }
        .gg-generate.disabled {
          background: rgba(255,255,255,.05); color: rgba(255,255,255,.2);
          cursor: not-allowed; border: 1px solid rgba(255,255,255,.06);
        }
        .gg-generate.loading {
          background: rgba(0,229,255,.12); color: #00e5ff;
          border: 1px solid rgba(0,229,255,.3);
          box-shadow: 0 0 20px rgba(0,229,255,.1);
          cursor: wait;
        }

        /* Badge */
        .gg-badge {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 6px 12px; border-radius: 100px;
          border: 1px solid rgba(0,229,255,.12);
          background: rgba(0,229,255,.04);
          color: rgba(136,146,164,.8);
          font-size: 11px; font-family: var(--font-mono, monospace); letter-spacing: .04em;
          transition: all .2s;
        }
        .gg-badge:hover { border-color: rgba(0,229,255,.3); color: #00e5ff; }

        /* Tab */
        .gg-tab {
          display: flex; align-items: center; gap: 8px;
          padding: 8px 18px; border-radius: 8px;
          font-family: var(--font-mono, monospace); font-size: 12px; letter-spacing: .05em;
          border: 1px solid transparent; background: transparent;
          color: rgba(136,146,164,.7); cursor: pointer;
          transition: all .18s;
        }
        .gg-tab.active {
          background: rgba(0,229,255,.08); border-color: rgba(0,229,255,.35); color: #00e5ff;
          box-shadow: 0 0 12px rgba(0,229,255,.1);
        }
        .gg-tab:not(.active):hover { background: rgba(255,255,255,.04); color: #c8d8e8; }

        /* Gallery link row */
        .gg-link-row {
          background: rgba(0,0,0,.3); border: 1px solid rgba(255,255,255,.06);
          border-radius: 8px; padding: 12px 14px;
          transition: border-color .15s;
        }
        .gg-link-row:hover { border-color: rgba(255,255,255,.12); }
        .gg-link-row.active-link { border-color: rgba(0,229,255,.12); }

        /* Small action button */
        .gg-action-btn {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 5px 10px; border-radius: 6px;
          font-family: var(--font-mono, monospace); font-size: 11px; letter-spacing: .03em;
          border: 1px solid rgba(255,255,255,.1); background: rgba(255,255,255,.04);
          color: rgba(200,216,232,.7); cursor: pointer; transition: all .15s;
        }
        .gg-action-btn:hover { background: rgba(255,255,255,.08); color: #e8f0f8; border-color: rgba(255,255,255,.2); }
        .gg-action-btn.cyan { border-color: rgba(0,229,255,.25); color: #00e5ff; background: rgba(0,229,255,.06); }
        .gg-action-btn.cyan:hover { background: rgba(0,229,255,.12); border-color: rgba(0,229,255,.5); }
        .gg-action-btn.danger { border-color: rgba(239,68,68,.2); color: #ef4444; background: rgba(239,68,68,.04); }
        .gg-action-btn.danger:hover { background: rgba(239,68,68,.1); border-color: rgba(239,68,68,.4); }

        /* Scrollbar */
        .gg-scroll::-webkit-scrollbar { width: 4px; }
        .gg-scroll::-webkit-scrollbar-track { background: transparent; }
        .gg-scroll::-webkit-scrollbar-thumb { background: rgba(0,229,255,.2); border-radius: 2px; }

        /* Preview thumb */
        .gg-thumb {
          position: relative; border-radius: 8px; overflow: hidden;
          aspect-ratio: 1; background: rgba(0,0,0,.4);
          border: 1px solid rgba(255,255,255,.08);
          transition: border-color .15s, transform .15s;
        }
        .gg-thumb:hover { border-color: rgba(0,229,255,.35); transform: scale(1.02); }
        .gg-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .gg-thumb .gg-remove {
          position: absolute; top: 6px; right: 6px;
          width: 22px; height: 22px; border-radius: 50%;
          background: rgba(0,0,0,.7); border: 1px solid rgba(255,255,255,.2);
          color: #fff; font-size: 14px; line-height: 1;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; opacity: 0; transition: opacity .15s;
        }
        .gg-thumb:hover .gg-remove { opacity: 1; }

        /* Section label */
        .gg-section-label {
          font-family: var(--font-mono, monospace); font-size: 10px;
          letter-spacing: .1em; text-transform: uppercase;
          color: rgba(136,146,164,.6);
          display: flex; align-items: center; gap: 8px;
        }
        .gg-section-label::before {
          content: ''; display: block; width: 18px; height: 1px;
          background: rgba(0,229,255,.4);
        }

        /* Status dot */
        .gg-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
        .gg-dot.active { background: #00e5ff; box-shadow: 0 0 6px #00e5ff; animation: gg-pulse 2s ease-in-out infinite; }
        .gg-dot.used { background: #ef4444; }
        .gg-dot.expired { background: rgba(136,146,164,.4); }

        /* Error panel */
        .gg-error {
          width: 100%; padding: 12px 16px; border-radius: 8px;
          background: rgba(239,68,68,.06); border: 1px solid rgba(239,68,68,.25);
          color: #ef4444; font-family: var(--font-mono, monospace); font-size: 11px;
          letter-spacing: .04em; display: flex; align-items: center; gap: 10px;
        }

        /* Progress bar */
        .gg-progress-bar {
          height: 2px; border-radius: 1px; background: rgba(0,229,255,.15); overflow: hidden;
        }
        .gg-progress-fill {
          height: 100%; background: linear-gradient(90deg, #00a8c0, #00e5ff);
          transition: width .3s ease; box-shadow: 0 0 8px rgba(0,229,255,.5);
        }

        /* Dashed action button (add more / create link) */
        .gg-dashed-btn {
          flex: 1; padding: 14px; border-radius: 8px;
          border: 1px dashed rgba(255,255,255,.12); background: transparent;
          color: rgba(136,146,164,.6);
          font-family: var(--font-mono, monospace); font-size: 12px;
          display: flex; align-items: center; justify-content: center; gap: 7px;
          cursor: pointer; transition: all .2s;
        }
        .gg-dashed-btn:hover {
          border-color: rgba(0,229,255,.35); color: #00e5ff;
          background: rgba(0,229,255,.04);
        }
        .gg-dashed-btn:disabled { opacity: .4; cursor: not-allowed; }

        /* Logo hex */
        @keyframes gg-hex-rotate { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        .gg-hex { font-size: 28px; color: #00e5ff; display: inline-block; animation: gg-pulse 3s ease-in-out infinite; }

        /* Modal backdrop */
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        .gg-backdrop {
          position: fixed; inset: 0; z-index: 1000;
          background: rgba(2,6,12,.88); backdrop-filter: blur(18px) saturate(1.6);
          display: flex; align-items: center; justify-content: center;
          animation: fadeIn .2s ease-out;
        }
        .gg-modal {
          background: linear-gradient(160deg, rgba(12,20,30,.98), rgba(8,14,22,.95));
          border: 1px solid rgba(255,255,255,.1); border-radius: 16px;
          box-shadow: 0 24px 64px rgba(0,0,0,.7), 0 0 0 1px rgba(0,229,255,.06);
          padding: 40px 36px; width: 90%; max-width: 440px;
          display: flex; flex-direction: column; gap: 24px;
          position: relative; animation: gg-fadeup .25s cubic-bezier(.16,1,.3,1);
        }
      `}</style>

      {/* ── Outer Layout Wrapper ───────────────────────────────────── */}
      <div className="gg-root" style={{ display: 'flex', justifyContent: 'center', padding: '20px 16px' }}>

        {/* ── Creator console button (unauthenticated) ── */}
        {!user && (
          <button onClick={() => { setAuthModalOpen(true); setAuthError(null) }} style={{
            position: 'absolute', top: '20px', right: '20px',
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '8px 18px', borderRadius: '100px',
            background: 'rgba(0,229,255,.04)', border: '1px solid rgba(0,229,255,.2)',
            color: 'rgba(0,229,255,.8)', fontFamily: 'var(--font-mono)', fontSize: '11px',
            letterSpacing: '.07em', fontWeight: '700', cursor: 'pointer',
            transition: 'all .2s', zIndex: 10,
          }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,229,255,.1)'; e.currentTarget.style.borderColor = '#00e5ff'; e.currentTarget.style.color = '#00e5ff'; e.currentTarget.style.boxShadow = '0 0 20px rgba(0,229,255,.2)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,229,255,.04)'; e.currentTarget.style.borderColor = 'rgba(0,229,255,.2)'; e.currentTarget.style.color = 'rgba(0,229,255,.8)'; e.currentTarget.style.boxShadow = 'none' }}
          >
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#00e5ff', boxShadow: '0 0 8px #00e5ff', flexShrink: 0 }} />
            CREATOR CONSOLE
          </button>
        )}

        {/* ── Inner Content Container (Constrained width) ── */}
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '28px', width: '100%', maxWidth: '840px', paddingTop: user ? '0px' : '40px' }}>

          {/* ── Hero ──────────────────────────────────── */}
          <div style={{ textAlign: 'center', paddingTop: user ? 0 : 12 }}>
            <div className="gg-hex">⬡</div>
            <h1 style={{
              fontFamily: 'var(--font-display, var(--font-mono))', fontSize: 'clamp(26px, 5vw, 40px)',
              letterSpacing: '.18em', fontWeight: 900, margin: '10px 0 8px',
              color: '#e8f0f8', textTransform: 'uppercase',
            }}>
              GHOST <span style={{ color: '#00e5ff', textShadow: '0 0 20px rgba(0,229,255,.5)' }}>GALLERY</span>
            </h1>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'rgba(136,146,164,.7)', letterSpacing: '.08em', margin: 0 }}>
              ONE-TIME SECURE PHOTO DELIVERY · VIEW ONCE · GONE FOREVER
            </p>
          </div>

          {/* ── Auth tabs ─────────────────────────────── */}
          {user && (
            <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', borderBottom: '1px solid rgba(255,255,255,.06)', paddingBottom: 16 }}>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className={`gg-tab ${activeTab === 'create' ? 'active' : ''}`}
                  onClick={() => { setActiveTab('create'); setNewLinkResult(null); setGeneratingLinkFor(null) }}>
                  <Plus size={13} /> Create
                </button>
                <button className={`gg-tab ${activeTab === 'dashboard' ? 'active' : ''}`}
                  onClick={() => { setActiveTab('dashboard'); setNewLinkResult(null); setGeneratingLinkFor(null) }}>
                  <Layers size={13} /> My Galleries
                </button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'rgba(136,146,164,.6)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</span>
                <button onClick={handleSignOut} style={{
                  padding: '6px 14px', borderRadius: '6px', cursor: 'pointer',
                  background: 'rgba(239,68,68,.06)', border: '1px solid rgba(239,68,68,.25)',
                  color: '#ef4444', fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '.04em',
                  transition: 'all .15s',
                }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,.12)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,.06)' }}
                >Sign out</button>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════
              TAB: CREATE
          ════════════════════════════════════════════ */}
          {activeTab === 'create' ? (
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '22px' }} className="gg-animate-up">

              {/* Drop zone */}
              <div
                className={`gg-dropzone${dragging ? ' drag-over' : ''}`}
                style={{ minHeight: files.length ? 'auto' : 200 }}
                onDragOver={e => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={e => { e.preventDefault(); setDragging(false); processFiles(e.dataTransfer.files) }}
                onClick={() => !files.length && fileInputRef.current?.click()}
              >
                {files.length === 0 ? (
                  <div style={{ padding: '48px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, userSelect: 'none' }}>
                    <div style={{ width: 52, height: 52, borderRadius: '50%', border: '1px solid rgba(0,229,255,.3)', background: 'rgba(0,229,255,.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 20px rgba(0,229,255,.15)' }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#00e5ff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
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
                        width: 90, flexShrink: 0,
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
                    <label style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'rgba(136,146,164,.5)', letterSpacing: '.08em' }}>GALLERY TITLE</label>
                    <input className="gg-input" type="text" value={galleryTitle} onChange={e => setGalleryTitle(e.target.value)} placeholder="Ghost Gallery" />
                  </div>
                  {watermarkEnabled && (
                    <div style={{ flex: 1, minWidth: 180, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <label style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'rgba(136,146,164,.5)', letterSpacing: '.08em' }}>WATERMARK TEXT</label>
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
                className={`gg-generate${files.length ? ' ready' : ' disabled'}${isUploading ? ' loading' : ''}`}
                onClick={handleGenerate} disabled={!files.length || isUploading} type="button"
              >
                {isUploading
                  ? <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                      <Loader2 size={15} style={{ animation: 'gg-spin 1s linear infinite' }} />
                      {uploadProgress < files.length ? `Processing ${uploadProgress + 1} / ${files.length}` : 'Finalizing gallery…'}
                    </span>
                  : <span>Generate Secure Link {files.length > 0 && `— ${files.length} photo${files.length > 1 ? 's' : ''}`} →</span>
                }
              </button>
            </div>

          ) : (
          /* ════════════════════════════════════════════
              TAB: DASHBOARD
          ════════════════════════════════════════════ */
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 20 }} className="gg-animate-up">

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="gg-section-label"><Layers size={12} style={{ color: '#00e5ff' }} /> Active Galleries</span>
                <button onClick={fetchMyGalleries} disabled={dashboardLoading} style={{
                  background: 'transparent', border: 'none', color: 'rgba(0,229,255,.7)',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                  fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '.04em', padding: '6px 10px',
                  borderRadius: 6, transition: 'color .15s',
                }}
                  onMouseEnter={e => e.currentTarget.style.color = '#00e5ff'}
                  onMouseLeave={e => e.currentTarget.style.color = 'rgba(0,229,255,.7)'}
                >
                  <RefreshCw size={12} style={{ animation: dashboardLoading ? 'gg-spin 1s linear infinite' : 'none' }} /> Refresh
                </button>
              </div>

              {dashboardLoading && myGalleries.length === 0 ? (
                <div style={{ padding: '60px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                  <div style={{ width: 36, height: 36, border: '2px solid rgba(0,229,255,.2)', borderTopColor: '#00e5ff', borderRadius: '50%', animation: 'gg-spin 1s linear infinite' }} />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'rgba(136,146,164,.5)', letterSpacing: '.05em' }}>Loading gallery states…</span>
                </div>
              ) : myGalleries.length === 0 ? (
                <div style={{ border: '1px dashed rgba(255,255,255,.08)', borderRadius: 10, padding: '56px 24px', textAlign: 'center' }}>
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'rgba(136,146,164,.5)', margin: '0 0 6px' }}>No galleries yet.</p>
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'rgba(136,146,164,.3)', margin: 0 }}>Create a gallery while signed in to manage it here.</p>
                </div>
              ) : (
                myGalleries.map(gal => (
                  <div key={gal.id} className="gg-card" style={{ padding: 0, overflow: 'hidden' }}>

                    {/* Card top bar */}
                    <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid rgba(255,255,255,.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
                      <div>
                        <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: '16px', fontWeight: 700, color: '#e8f0f8', margin: '0 0 5px', letterSpacing: '.04em' }}>
                          {gal.title || 'Untitled Gallery'}
                        </h3>
                        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'rgba(136,146,164,.45)', margin: 0, letterSpacing: '.03em' }}>
                          {gal.id} · {new Date(gal.createdAt || gal.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                        <span style={{ padding: '4px 10px', borderRadius: '100px', background: 'rgba(0,229,255,.07)', border: '1px solid rgba(0,229,255,.18)', fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#00e5ff' }}>
                          {gal.images?.length || gal.imageCount || 0} photo{(gal.images?.length || gal.imageCount) !== 1 ? 's' : ''}
                        </span>
                        <button className="gg-action-btn danger" onClick={() => handleDeleteGallery(gal.id)} disabled={deletingGalleryId === gal.id}>
                          {deletingGalleryId === gal.id ? <Loader2 size={11} style={{ animation: 'gg-spin 1s linear infinite' }} /> : <Trash2 size={11} />}
                          {deletingGalleryId === gal.id ? 'Deleting' : 'Delete'}
                        </button>
                      </div>
                    </div>

                    {gal.error ? (
                      <div style={{ padding: '16px 24px', fontFamily: 'var(--font-mono)', fontSize: '12px', color: '#f59e0b', display: 'flex', gap: 8, alignItems: 'center' }}>
                        <AlertOctagon size={14} /> {gal.error}
                      </div>
                    ) : (
                      <>
                        {/* Links section */}
                        <div style={{ padding: '16px 24px' }}>
                          <span className="gg-section-label" style={{ marginBottom: 12, display: 'flex' }}><Link2 size={11} style={{ color: '#00e5ff' }} /> Share Links</span>
                          <div className="gg-scroll" style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 220, overflowY: 'auto', paddingRight: 4 }}>
                            {(!gal.links || gal.links.filter((l: any) => l.status === 'active').length === 0) && (
                              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'rgba(136,146,164,.4)', margin: 0 }}>No active links — generate one below.</p>
                            )}
                            {gal.links && gal.links.map((link: any) => (
                              <div key={link.id} className={`gg-link-row ${link.status === 'active' ? 'active-link' : ''}`} style={{ opacity: link.status === 'active' ? 1 : .5 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5, overflow: 'hidden', flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                      <span className={`gg-dot ${link.status}`} />
                                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: link.status === 'active' ? '#00e5ff' : 'rgba(136,146,164,.5)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                        {link.url}
                                      </span>
                                    </div>
                                    <div style={{ display: 'flex', gap: 12, fontSize: 10, fontFamily: 'var(--font-mono)', color: 'rgba(136,146,164,.4)', paddingLeft: 14 }}>
                                      <span>{link.oneTimeUse ? 'One-time' : 'Multi-use'}</span>
                                      <span>{link.accessCount || 0} views</span>
                                      <span>Exp {new Date(link.expiresAt).toLocaleTimeString()}</span>
                                    </div>
                                  </div>
                                  {link.status === 'active' && (
                                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                                      <button className="gg-action-btn" onClick={() => copyToClipboard(link.url, link.id)}>
                                        {copiedLinkId === link.id ? <Check size={11} style={{ color: '#10b981' }} /> : <Copy size={11} />}
                                        {copiedLinkId === link.id ? 'Copied' : 'Copy'}
                                      </button>
                                      <button className="gg-action-btn cyan" onClick={() => window.open(`${link.url}?preview=true`, '_blank')}>
                                        <Eye size={11} /> Preview
                                      </button>
                                      <button className="gg-action-btn danger" onClick={() => handleRevokeLink(link.token, link.shortToken)}>
                                        <Link2Off size={11} /> Revoke
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Actions footer */}
                        <div style={{ padding: '14px 24px 20px', borderTop: '1px solid rgba(255,255,255,.05)' }}>
                          {generatingLinkFor === gal.id ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, background: 'rgba(0,0,0,.3)', borderRadius: 8, padding: 16, border: '1px solid rgba(255,255,255,.06)' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'rgba(136,146,164,.6)', letterSpacing: '.06em', display: 'flex', alignItems: 'center', gap: 7 }}>
                                  <Clock size={12} style={{ color: '#00e5ff' }} /> NEW LINK SETTINGS
                                </span>
                                <button onClick={() => { setGeneratingLinkFor(null); setNewLinkResult(null) }}
                                  style={{ background: 'transparent', border: 'none', color: 'rgba(136,146,164,.5)', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>×</button>
                              </div>

                              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                {EXPIRY_OPTIONS.map(opt => (
                                  <button key={opt.hours} className={`gg-pill ${newLinkHours === opt.hours ? 'active' : ''}`}
                                    style={{ padding: '6px 12px', fontSize: '11px' }} onClick={() => setNewLinkHours(opt.hours)}>
                                    {opt.label}
                                  </button>
                                ))}
                              </div>

                              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'rgba(136,146,164,.5)', letterSpacing: '.06em', flexShrink: 0 }}>TYPE:</span>
                                {[{ label: 'One-time', val: true }, { label: 'Multi-use', val: false }].map(o => (
                                  <button key={o.label} onClick={() => setNewLinkOneTime(o.val)} style={{
                                    padding: '5px 12px', borderRadius: '100px', cursor: 'pointer',
                                    fontFamily: 'var(--font-mono)', fontSize: '11px', transition: 'all .15s',
                                    background: newLinkOneTime === o.val ? 'rgba(0,229,255,.1)' : 'transparent',
                                    border: `1px solid ${newLinkOneTime === o.val ? 'rgba(0,229,255,.5)' : 'rgba(255,255,255,.1)'}`,
                                    color: newLinkOneTime === o.val ? '#00e5ff' : 'rgba(136,146,164,.6)',
                                  }}>{o.label}</button>
                                ))}
                              </div>

                              {newLinkResult && (
                                <div style={{ background: 'rgba(16,185,129,.05)', border: '1px solid rgba(16,185,129,.2)', borderRadius: 8, padding: 14 }}>
                                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#10b981', margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}>
                                    <ShieldCheck size={12} /> LINK GENERATED
                                  </p>
                                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                    <span style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: '12px', color: '#00e5ff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{newLinkResult.url}</span>
                                    <button className="gg-action-btn cyan" onClick={() => copyToClipboard(newLinkResult.url, 'new-link')}>
                                      {copiedLinkId === 'new-link' ? <Check size={11} /> : <Copy size={11} />} {copiedLinkId === 'new-link' ? 'Copied' : 'Copy'}
                                    </button>
                                  </div>
                                </div>
                              )}

                              <button onClick={() => handleCreateNewLink(gal.id)} disabled={newLinkLoading} style={{
                                width: '100%', padding: '11px', border: 'none', borderRadius: 8, cursor: 'pointer',
                                background: 'linear-gradient(135deg, #00c8e6, #00e5ff)',
                                color: '#041a20', fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700,
                                letterSpacing: '.06em', transition: 'all .15s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                              }}
                                onMouseEnter={e => e.currentTarget.style.filter = 'brightness(1.1)'}
                                onMouseLeave={e => e.currentTarget.style.filter = 'none'}
                              >
                                {newLinkLoading ? <><Loader2 size={13} style={{ animation: 'gg-spin 1s linear infinite' }} /> Generating…</> : 'Generate New Link →'}
                              </button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                              <button className="gg-dashed-btn" onClick={() => { setGeneratingLinkFor(gal.id); setNewLinkResult(null) }}>
                                <Plus size={13} /> Create Share Link
                              </button>
                              <button className="gg-dashed-btn" disabled={isAddingMore} onClick={() => { setAddingToGalleryId(gal.id); addMoreFileInputRef.current?.click() }}>
                                {isAddingMore && addingToGalleryId === gal.id
                                  ? <><Loader2 size={13} style={{ animation: 'gg-spin 1s linear infinite' }} /> Adding…</>
                                  : <><Plus size={13} /> Add Images</>
                                }
                              </button>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                ))
              )}
              <input ref={addMoreFileInputRef} type="file" multiple accept="image/*" style={{ display: 'none' }} onChange={handleAddMoreFiles} />
            </div>
          )}

          {/* ── Security badges ───────────────────────── */}
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 8, paddingTop: 4 }}>
            {[
              { icon: <Lock size={12} />, label: 'One-time access' },
              { icon: <Droplet size={12} />, label: 'Watermarked' },
              { icon: <Clock size={12} />, label: 'Auto-expires' },
              { icon: <Link2Off size={12} />, label: 'No direct URLs' },
            ].map(b => (
              <span key={b.label} className="gg-badge">{b.icon} {b.label}</span>
            ))}
          </div>
        </div>

        {/* ════════════════════════════════════════════
            MODALS
        ════════════════════════════════════════════ */}

        {/* Auth modal */}
        {authModalOpen && (
          <div className="gg-backdrop" onClick={() => setAuthModalOpen(false)}>
            <div className="gg-modal" onClick={e => e.stopPropagation()}>
              <button onClick={() => setAuthModalOpen(false)} style={{
                position: 'absolute', top: 16, right: 16,
                background: 'transparent', border: 'none', color: 'rgba(136,146,164,.5)',
                fontSize: 20, cursor: 'pointer', transition: 'color .15s', lineHeight: 1,
              }}
                onMouseEnter={e => e.currentTarget.style.color = '#e8f0f8'}
                onMouseLeave={e => e.currentTarget.style.color = 'rgba(136,146,164,.5)'}
              >×</button>

              <div style={{ textAlign: 'center' }}>
                <div style={{ width: 50, height: 50, borderRadius: '50%', background: 'rgba(0,229,255,.08)', border: '1px solid rgba(0,229,255,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 20, boxShadow: '0 0 20px rgba(0,229,255,.15)' }}>⬡</div>
                <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: '16px', letterSpacing: '.12em', color: '#e8f0f8', margin: '0 0 6px', textTransform: 'uppercase' }}>
                  {authType === 'signin' ? 'Creator Access' : 'New Account'}
                </h3>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'rgba(136,146,164,.5)', margin: 0, letterSpacing: '.04em' }}>
                  {authType === 'signin' ? 'Authenticate to manage secure galleries' : 'Register as a certified creator'}
                </p>
              </div>

              <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <label style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'rgba(136,146,164,.5)', letterSpacing: '.07em' }}>EMAIL</label>
                  <input className="gg-input" type="email" required value={authEmail} onChange={e => setAuthEmail(e.target.value)} placeholder="creator@ghostgallery.com" />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <label style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'rgba(136,146,164,.5)', letterSpacing: '.07em' }}>PASSWORD</label>
                  <input className="gg-input" type="password" required value={authPassword} onChange={e => setAuthPassword(e.target.value)} placeholder="••••••••••" />
                </div>
                {authError && <div className="gg-error"><div style={{ width: 16, height: 16, borderRadius: '50%', background: 'rgba(239,68,68,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>!</div>{authError}</div>}
                <button type="submit" disabled={authLoading} style={{
                  padding: '14px', border: 'none', borderRadius: 8, cursor: 'pointer',
                  background: 'linear-gradient(135deg, #00c8e6, #00e5ff)',
                  color: '#041a20', fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700,
                  letterSpacing: '.08em', transition: 'all .15s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
                  onMouseEnter={e => e.currentTarget.style.filter = 'brightness(1.1)'}
                  onMouseLeave={e => e.currentTarget.style.filter = 'none'}
                >
                  {authLoading ? <><Loader2 size={14} style={{ animation: 'gg-spin 1s linear infinite' }} /> Authenticating…</> : authType === 'signin' ? 'Authenticate →' : 'Create Account →'}
                </button>
              </form>

              <div style={{ borderTop: '1px solid rgba(255,255,255,.06)', paddingTop: 16, textAlign: 'center' }}>
                <button onClick={() => { setAuthType(authType === 'signin' ? 'signup' : 'signin'); setAuthError(null) }}
                  style={{ background: 'transparent', border: 'none', color: 'rgba(0,229,255,.7)', fontFamily: 'var(--font-mono)', fontSize: '11px', cursor: 'pointer', letterSpacing: '.04em', transition: 'color .15s' }}
                  onMouseEnter={e => e.currentTarget.style.color = '#00e5ff'}
                  onMouseLeave={e => e.currentTarget.style.color = 'rgba(0,229,255,.7)'}
                >
                  {authType === 'signin' ? 'New here? Create an account' : 'Have an account? Sign in'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Alert / Confirm modal */}
        {dialogOpen && dialogConfig && (
          <div className="gg-backdrop">
            <div className="gg-modal" style={{ maxWidth: 420, border: `1px solid ${iconColor(dialogConfig.icon)}22`, boxShadow: `0 24px 64px rgba(0,0,0,.7), 0 0 40px ${iconColor(dialogConfig.icon)}18` }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, textAlign: 'center' }}>
                <div style={{ width: 60, height: 60, borderRadius: '50%', background: iconBg(dialogConfig.icon), border: `1px solid ${iconColor(dialogConfig.icon)}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 20px ${iconColor(dialogConfig.icon)}20` }}>
                  {dialogConfig.icon === 'success' && <ShieldCheck size={28} style={{ color: iconColor('success') }} />}
                  {(dialogConfig.icon === 'warning' || dialogConfig.icon === 'danger') && <AlertOctagon size={28} style={{ color: iconColor(dialogConfig.icon) }} />}
                  {dialogConfig.icon === 'info' && <Lock size={28} style={{ color: iconColor('info') }} />}
                </div>
                <div>
                  <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', letterSpacing: '.1em', color: '#e8f0f8', margin: '0 0 10px', textTransform: 'uppercase' }}>{dialogConfig.title}</h3>
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'rgba(136,146,164,.7)', lineHeight: 1.7, margin: 0 }}>{dialogConfig.message}</p>
                </div>
                <div style={{ display: 'flex', gap: 10, width: '100%' }}>
                  {dialogConfig.type === 'confirm' ? (
                    <>
                      <button onClick={() => setDialogOpen(false)} style={{
                        flex: 1, padding: '12px', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8,
                        background: 'rgba(255,255,255,.04)', color: 'rgba(200,216,232,.7)',
                        fontFamily: 'var(--font-mono)', fontSize: '12px', cursor: 'pointer', letterSpacing: '.05em',
                        transition: 'all .15s',
                      }}
                        onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,.2)'}
                        onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,.1)'}
                      >Cancel</button>
                      <button onClick={() => { setDialogOpen(false); dialogConfig.onConfirm?.() }} style={{
                        flex: 1, padding: '12px', border: 'none', borderRadius: 8, cursor: 'pointer',
                        background: dialogConfig.icon === 'danger' ? '#ef4444' : 'linear-gradient(135deg, #00c8e6, #00e5ff)',
                        color: dialogConfig.icon === 'danger' ? '#fff' : '#041a20',
                        fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700, letterSpacing: '.06em', transition: 'all .15s',
                      }}
                        onMouseEnter={e => e.currentTarget.style.filter = 'brightness(1.1)'}
                        onMouseLeave={e => e.currentTarget.style.filter = 'none'}
                      >Confirm</button>
                    </>
                  ) : (
                    <button onClick={() => setDialogOpen(false)} style={{
                      flex: 1, padding: '12px', border: 'none', borderRadius: 8,
                      background: 'linear-gradient(135deg, #00c8e6, #00e5ff)',
                      color: '#041a20', fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700,
                      letterSpacing: '.06em', cursor: 'pointer', transition: 'all .15s',
                    }}
                      onMouseEnter={e => e.currentTarget.style.filter = 'brightness(1.1)'}
                      onMouseLeave={e => e.currentTarget.style.filter = 'none'}
                    >OK</button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </>
  )
}
