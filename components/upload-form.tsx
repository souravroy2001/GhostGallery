'use client'

import { useState, useRef, useEffect } from 'react'
import { useToast } from '@/hooks/use-toast'
import { ShareLinkDisplay } from '@/components/share-link-display'
import {
  Lock, Droplet, Clock, Link2Off, Plus, Layers
} from 'lucide-react'
import { createClient as createBrowserClient } from '@/lib/supabase/client'

import './upload/upload-form.css'
import { FileWithPreview, ShareResult, EXPIRY_OPTIONS } from './upload/types'
import { AuthModal } from './upload/AuthModal'
import { DialogModal } from './upload/DialogModal'
import { CreateTab } from './upload/CreateTab'
import { DashboardTab } from './upload/DashboardTab'

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
  const [createType, setCreateType] = useState<'photos' | 'links'>('photos')
  const [targetUrl, setTargetUrl] = useState('')
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
      
      const deletedIds = new Set(JSON.parse(localStorage.getItem('ghost_deleted_galleries') || '[]'))
      galleryList = galleryList.filter((g: any) => !deletedIds.has(g.id))
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
  const processFiles = async (newFiles: FileList | File[] | null) => {
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
      return Object.assign(safe, { preview: URL.createObjectURL(safe), id: Math.random().toString(36).slice(2, 9) }) as FileWithPreview
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

  /* ── Paste Handler ── */
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (activeTab !== 'create' || isUploading || dialogOpen) return
      if (e.clipboardData && e.clipboardData.files.length > 0) {
        e.preventDefault()
        processFiles(e.clipboardData.files)
      }
    }
    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [activeTab, isUploading, dialogOpen, files])

  /* ── Upload ── */
  const handleGenerate = async () => {
    if (createType === 'links' && !targetUrl) {
      setError('Please provide a website or link destination')
      return
    }
    if (createType === 'photos' && !files.length) {
      setError('Please select at least one image')
      return
    }

    setIsUploading(true); setUploadProgress(0); setError(null)
    try {
      if (createType === 'links') {
        const initRes = await fetch('/api/upload', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            action: 'create_url', 
            title: galleryTitle, 
            watermarkText: watermarkEnabled ? watermarkText : 'disabled',
            expiryHours,
            targetUrl
          })
        })
        if (!initRes.ok) throw new Error((await initRes.json().catch(() => ({}))).error || 'Link creation failed')
        const data = await initRes.json()
        setShareResult({ url: data.shareLink.url, expiresAt: data.shareLink.expiresAt, originalUrl: data.shareLink.originalUrl })
        setTargetUrl('')
        return
      }

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
          
          const deletedArr = JSON.parse(localStorage.getItem('ghost_deleted_galleries') || '[]')
          if (!deletedArr.includes(id)) deletedArr.push(id)
          localStorage.setItem('ghost_deleted_galleries', JSON.stringify(deletedArr))

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

  /* ════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════ */
  return (
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

        {/* Main content area toggled via activeTab */}
        {activeTab === 'create' ? (
          <CreateTab
            createType={createType} setCreateType={setCreateType}
            error={error} setError={setError}
            dragging={dragging} setDragging={setDragging}
            files={files} processFiles={processFiles} removeFile={removeFile}
            fileInputRef={fileInputRef} targetUrl={targetUrl} setTargetUrl={setTargetUrl}
            expiryHours={expiryHours} setExpiryHours={setExpiryHours}
            watermarkEnabled={watermarkEnabled} setWatermarkEnabled={setWatermarkEnabled}
            watermarkText={watermarkText} setWatermarkText={setWatermarkText}
            galleryTitle={galleryTitle} setGalleryTitle={setGalleryTitle}
            isUploading={isUploading} uploadProgress={uploadProgress}
            handleGenerate={handleGenerate}
            showCustomAlert={showCustomAlert} toast={toast}
          />
        ) : (
          <DashboardTab
            fetchMyGalleries={fetchMyGalleries}
            dashboardLoading={dashboardLoading}
            myGalleries={myGalleries}
            deletingGalleryId={deletingGalleryId}
            handleDeleteGallery={handleDeleteGallery}
            copiedLinkId={copiedLinkId}
            copyToClipboard={copyToClipboard}
            handleRevokeLink={handleRevokeLink}
            generatingLinkFor={generatingLinkFor}
            setGeneratingLinkFor={setGeneratingLinkFor}
            newLinkResult={newLinkResult}
            setNewLinkResult={setNewLinkResult}
            newLinkHours={newLinkHours}
            setNewLinkHours={setNewLinkHours}
            newLinkOneTime={newLinkOneTime}
            setNewLinkOneTime={setNewLinkOneTime}
            newLinkLoading={newLinkLoading}
            handleCreateNewLink={handleCreateNewLink}
            isAddingMore={isAddingMore}
            addingToGalleryId={addingToGalleryId}
            setAddingToGalleryId={setAddingToGalleryId}
            addMoreFileInputRef={addMoreFileInputRef}
            handleAddMoreFiles={handleAddMoreFiles}
          />
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
      
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onSubmit={handleAuth}
        email={authEmail} setEmail={setAuthEmail}
        password={authPassword} setPassword={setAuthPassword}
        authType={authType} setAuthType={setAuthType}
        loading={authLoading}
        error={authError} setError={setAuthError}
      />

      <DialogModal
        isOpen={dialogOpen}
        onClose={() => setDialogOpen(false)}
        config={dialogConfig}
      />

    </div>
  )
}
