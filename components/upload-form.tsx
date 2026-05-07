'use client'

import { useState, useRef, useEffect } from 'react'
import { ShareLinkDisplay } from '@/components/share-link-display'
import { Lock, Droplet, Clock, Link2Off, Key, Copy, Check, Eye, Trash2, Plus, ShieldCheck, AlertOctagon, RefreshCw, Loader2, Layers, Link2 } from 'lucide-react'
import { upload } from '@vercel/blob/client'
import { createClient as createBrowserClient } from '@/lib/supabase/client'

interface FileWithPreview extends File {
  preview: string
  id: string
}

interface ShareResult {
  url: string
  expiresAt: string
  originalUrl?: string
}

const EXPIRY_OPTIONS = [
  { label: "1 hour", hours: 1 },
  { label: "6 hours", hours: 6 },
  { label: "12 hours", hours: 12 },
  { label: "24 hours", hours: 24 },
  { label: "7 days", hours: 168 },
]

const compressImage = (file: File): Promise<File> => {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/')) {
      return resolve(file);
    }

    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.src = objectUrl;
    
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      const MAX_WIDTH = 1920;
      const MAX_HEIGHT = 1080;
      if (width > MAX_WIDTH || height > MAX_HEIGHT) {
        if (width > height) {
          height = Math.round((height * MAX_WIDTH) / width);
          width = MAX_WIDTH;
        } else {
          width = Math.round((width * MAX_HEIGHT) / height);
          height = MAX_HEIGHT;
        }
      }

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(file);

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file);
            return;
          }
          const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", {
            type: 'image/jpeg',
            lastModified: Date.now(),
          });
          resolve(compressedFile);
        },
        'image/jpeg',
        0.82
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file);
    };
  });
};

export function UploadForm() {
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

  // Supabase Auth States
  const supabase = createBrowserClient()
  const [user, setUser] = useState<any>(null)
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authType, setAuthType] = useState<'signin' | 'signup'>('signin')
  const [authError, setAuthError] = useState<string | null>(null)
  const [authLoading, setAuthLoading] = useState(false)

  // Dashboard States
  const [activeTab, setActiveTab] = useState<'create' | 'dashboard'>('create')
  const [myGalleries, setMyGalleries] = useState<any[]>([])
  const [dashboardLoading, setDashboardLoading] = useState(false)
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null)
  const [deletingGalleryId, setDeletingGalleryId] = useState<string | null>(null)

  // New Link States per Gallery Card
  const [generatingLinkFor, setGeneratingLinkFor] = useState<string | null>(null)
  const [newLinkHours, setNewLinkHours] = useState<number>(24)
  const [newLinkOneTime, setNewLinkOneTime] = useState<boolean>(true)
  const [newLinkLoading, setNewLinkLoading] = useState(false)
  const [newLinkResult, setNewLinkResult] = useState<any | null>(null)

  // Custom dialog modal states
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogConfig, setDialogConfig] = useState<{
    type: 'alert' | 'confirm'
    title: string
    message: string
    icon: 'info' | 'success' | 'warning' | 'danger'
    onConfirm?: () => void
  } | null>(null)

  const showCustomAlert = (title: string, message: string, icon: 'info' | 'success' | 'warning' | 'danger' = 'info') => {
    setDialogConfig({
      type: 'alert',
      title,
      message,
      icon
    })
    setDialogOpen(true)
  }

  const showCustomConfirm = (title: string, message: string, icon: 'info' | 'success' | 'warning' | 'danger' = 'warning', onConfirm: () => void) => {
    setDialogConfig({
      type: 'confirm',
      title,
      message,
      icon,
      onConfirm
    })
    setDialogOpen(true)
  }

  // Monitor Auth State
  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
    }
    checkUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Fetch Live Status of Saved Galleries
  const fetchMyGalleries = async () => {
    setDashboardLoading(true)
    try {
      const saved = JSON.parse(localStorage.getItem('ghost_galleries') || '[]')
      const enrichedGalleries = await Promise.all(
        saved.map(async (g: any) => {
          try {
            const res = await fetch(`/api/gallery?id=${g.id}`)
            if (res.ok) {
              const data = await res.json()
              return data.gallery
            }
            return { ...g, error: 'Removed or not found on server' }
          } catch {
            return { ...g, error: 'Network connection failed' }
          }
        })
      )
      setMyGalleries(enrichedGalleries)
    } catch (err) {
      console.error('Error fetching dashboard galleries:', err)
    } finally {
      setDashboardLoading(false)
    }
  }

  useEffect(() => {
    if (user && activeTab === 'dashboard') {
      fetchMyGalleries()
    }
  }, [user, activeTab])

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
    setUploadProgress(0)
    setError(null)

    try {
      // 1. Upload files directly to Vercel Blob from the browser sequentially
      const uploadedImages = [];
      let uploadedCount = 0;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        let fileToUpload = file;
        try {
          fileToUpload = await compressImage(file);
        } catch (compressErr) {
          console.warn('Compression failed, using original:', compressErr);
        }

        const extension = fileToUpload.name.split('.').pop() || 'jpg';
        const uniqueFilename = `${Math.random().toString(36).substring(2, 11)}_${Date.now()}.${extension}`;
        
        // Vercel Blob client upload bypasses server limits completely
        const blob = await upload(uniqueFilename, fileToUpload, {
          access: 'public',
          handleUploadUrl: '/api/upload/blob',
        });

        uploadedImages.push({
          url: blob.url,
          pathname: blob.pathname,
          size: fileToUpload.size,
          contentType: blob.contentType || fileToUpload.type,
          filename: fileToUpload.name
        });

        uploadedCount++;
        setUploadProgress(uploadedCount);
      }

      // 2. Submit metadata to API to create database records
      const payload = {
        title: galleryTitle,
        watermarkText: watermarkEnabled ? watermarkText : 'disabled',
        expiryHours: expiryHours,
        images: uploadedImages
      };

      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
      })

      if (response.status === 413) {
        throw new Error('Total file size too large. Please select fewer photos.')
      }

      let data;
      try {
        data = await response.json()
      } catch (jsonError) {
        throw new Error(`Server responded with an unexpected format (Status: ${response.status}).`)
      }

      if (!response.ok) {
        throw new Error(data?.error || 'Upload failed')
      }

      setShareResult({
        url: data.shareLink.url,
        expiresAt: data.shareLink.expiresAt,
        originalUrl: data.shareLink.originalUrl,
      })

      // If user is authenticated, save gallery reference to localStorage for dashboard reuse
      if (user && data.gallery) {
        const savedGalleries = JSON.parse(localStorage.getItem('ghost_galleries') || '[]')
        const newSaved = {
          id: data.gallery.id,
          title: data.gallery.title,
          createdAt: new Date().toISOString(),
          imageCount: data.gallery.imageCount,
        }
        localStorage.setItem('ghost_galleries', JSON.stringify([newSaved, ...savedGalleries]))
      }

      files.forEach(file => URL.revokeObjectURL(file.preview))
      setFiles([])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setIsUploading(false)
    }
  }

  // Auth Operations
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthLoading(true)
    setAuthError(null)
    try {
      if (authType === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({
          email: authEmail,
          password: authPassword,
        })
        if (error) throw error
      } else {
        const { error } = await supabase.auth.signUp({
          email: authEmail,
          password: authPassword,
        })
        if (error) throw error
        showCustomAlert('CREATOR REGISTERED', 'Verification email sent or account created!', 'success')
      }
      setAuthModalOpen(false)
      setAuthEmail('')
      setAuthPassword('')
    } catch (err: any) {
      setAuthError(err.message || 'Authentication failed')
    } finally {
      setAuthLoading(false)
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    setActiveTab('create')
  }

  // Deletion Operation
  const handleDeleteGallery = (galleryId: string) => {
    showCustomConfirm(
      'DELETE GALLERY',
      'Are you absolutely sure you want to permanently delete this gallery and all its photos? This action is IRREVERSIBLE.',
      'danger',
      async () => {
        setDeletingGalleryId(galleryId)
        try {
          const res = await fetch(`/api/gallery?id=${galleryId}`, { method: 'DELETE' })
          if (res.ok) {
            const saved = JSON.parse(localStorage.getItem('ghost_galleries') || '[]')
            const filtered = saved.filter((g: any) => g.id !== galleryId)
            localStorage.setItem('ghost_galleries', JSON.stringify(filtered))
            setMyGalleries(prev => prev.filter(g => g.id !== galleryId))
            showCustomAlert('GALLERY DELETED', 'The gallery and all associated assets have been permanently deleted.', 'success')
          } else {
            const data = await res.json()
            showCustomAlert('DELETION FAILED', data.error || 'Failed to delete gallery.', 'danger')
          }
        } catch (err) {
          console.error(err)
          showCustomAlert('DELETION FAILED', 'Failed to delete gallery.', 'danger')
        } finally {
          setDeletingGalleryId(null)
        }
      }
    )
  }

  // Revoke Specific Link Operation
  const handleRevokeLink = (token: string, shortToken: string) => {
    showCustomConfirm(
      'REVOKE SHARE LINK',
      'Are you absolutely sure you want to revoke this share link? Anyone with this URL will lose access immediately.',
      'warning',
      async () => {
        try {
          const res = await fetch(`/api/gallery?token=${token}&shortToken=${shortToken}`, { method: 'DELETE' })
          if (res.ok) {
            fetchMyGalleries()
            showCustomAlert('LINK REVOKED', 'The share link has been successfully revoked and invalidated.', 'success')
          } else {
            const data = await res.json()
            showCustomAlert('REVOCATION FAILED', data.error || 'Failed to revoke link.', 'danger')
          }
        } catch (err) {
          console.error(err)
          showCustomAlert('REVOCATION FAILED', 'Failed to revoke link.', 'danger')
        }
      }
    )
  }

  // Create New Custom Share Link
  const handleCreateNewLink = async (galleryId: string) => {
    setNewLinkLoading(true)
    try {
      const res = await fetch('/api/gallery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          galleryId,
          expiryHours: newLinkHours,
          oneTimeUse: newLinkOneTime,
        })
      })
      const data = await res.json()
      if (res.ok) {
        setNewLinkResult(data.shareLink)
        fetchMyGalleries() // Refresh live links list
        showCustomAlert('LINK GENERATED', 'A secure new share link has been generated successfully.', 'success')
      } else {
        showCustomAlert('GENERATION FAILED', data.error || 'Failed to generate link.', 'danger')
      }
    } catch (err) {
      console.error(err)
      showCustomAlert('GENERATION FAILED', 'Failed to generate link.', 'danger')
    } finally {
      setNewLinkLoading(false)
    }
  }

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedLinkId(id)
    setTimeout(() => setCopiedLinkId(null), 2000)
  }

  if (shareResult) {
    return (
      <ShareLinkDisplay
        shareUrl={shareResult.url}
        expiresAt={shareResult.expiresAt}
        watermarkText={watermarkEnabled ? watermarkText : 'disabled'}
        originalUrl={shareResult.originalUrl}
        onReset={() => {
          setShareResult(null)
          setError(null)
        }}
      />
    )
  }

  return (
    <div className="upload-view" style={{ position: 'relative' }}>
      
      {!user && (
        <button
          onClick={() => { setAuthModalOpen(true); setAuthError(null); }}
          style={{
            position: 'absolute',
            top: '20px',
            right: '0',
            background: 'rgba(0, 229, 255, 0.03)',
            border: '1px solid rgba(0, 229, 255, 0.18)',
            boxShadow: '0 0 15px rgba(0, 229, 255, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
            color: 'var(--accent)',
            padding: '8px 16px',
            borderRadius: '20px',
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            fontWeight: 'bold',
            letterSpacing: '0.08em',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
            zIndex: 10
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(0, 229, 255, 0.08)';
            e.currentTarget.style.borderColor = 'var(--accent)';
            e.currentTarget.style.boxShadow = '0 0 25px rgba(0, 229, 255, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.1)';
            e.currentTarget.style.color = '#ffffff';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(0, 229, 255, 0.03)';
            e.currentTarget.style.borderColor = 'rgba(0, 229, 255, 0.18)';
            e.currentTarget.style.boxShadow = '0 0 15px rgba(0, 229, 255, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.05)';
            e.currentTarget.style.color = 'var(--accent)';
          }}
        >
          <span style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: 'var(--accent)',
            boxShadow: '0 0 8px var(--accent)',
            display: 'inline-block'
          }} />
          CREATOR CONSOLE
        </button>
      )}

      {/* Hero section */}
      <div className="hero-text">
        <div className="logo-mark">⬡</div>
        <h1>GHOST <span className="accent">GALLERY</span></h1>
        <p className="tagline">One-time secure photo delivery. View once. Gone forever.</p>
      </div>

      {/* Tab Switcher - Only shown when user is Authenticated */}
      {user && (
        <div className="tab-switcher-container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', borderBottom: '1px solid var(--border)', paddingBottom: '16px', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              className={`tab-btn ${activeTab === 'create' ? 'active' : ''}`}
              onClick={() => { setActiveTab('create'); setNewLinkResult(null); setGeneratingLinkFor(null); }}
              style={{
                background: activeTab === 'create' ? 'rgba(0, 229, 255, 0.08)' : 'transparent',
                border: activeTab === 'create' ? '1px solid var(--accent)' : '1px solid transparent',
                color: activeTab === 'create' ? 'var(--accent)' : 'var(--text-muted)',
                padding: '8px 16px',
                borderRadius: '4px',
                fontFamily: 'var(--font-mono)',
                cursor: 'pointer',
                fontSize: '13px',
                transition: 'all 0.15s',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <Plus size={14} /> Create Gallery
            </button>
            <button
              className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => { setActiveTab('dashboard'); setNewLinkResult(null); setGeneratingLinkFor(null); }}
              style={{
                background: activeTab === 'dashboard' ? 'rgba(0, 229, 255, 0.08)' : 'transparent',
                border: activeTab === 'dashboard' ? '1px solid var(--accent)' : '1px solid transparent',
                color: activeTab === 'dashboard' ? 'var(--accent)' : 'var(--text-muted)',
                padding: '8px 16px',
                borderRadius: '4px',
                fontFamily: 'var(--font-mono)',
                cursor: 'pointer',
                fontSize: '13px',
                transition: 'all 0.15s',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <Layers size={14} /> My Galleries
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
              {user.email}
            </span>
            <button
              onClick={handleSignOut}
              style={{
                background: 'rgba(255, 59, 92, 0.08)',
                border: '1px solid var(--accent2)',
                color: 'var(--accent2)',
                padding: '6px 12px',
                borderRadius: '4px',
                fontFamily: 'var(--font-mono)',
                cursor: 'pointer',
                fontSize: '11px',
                transition: 'all 0.15s'
              }}
            >
              Sign Out
            </button>
          </div>
        </div>
      )}

      {/* TAB 1: CREATE GALLERY VIEW */}
      {activeTab === 'create' ? (
        <>
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
                <div className="drop-icon" style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent)', filter: 'drop-shadow(0 0 8px rgba(0, 229, 255, 0.4))' }}>
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                </div>
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
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)' }}>
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
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

          {/* Watermark & Title Section */}
          <div 
            className="watermark-section" 
            style={{ 
              width: '100%', 
              background: 'rgba(14, 20, 25, 0.65)', 
              backdropFilter: 'blur(8px)',
              border: '1px solid var(--border)', 
              borderRadius: '12px', 
              padding: '24px', 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '20px', 
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2), 0 0 20px rgba(0, 229, 255, 0.02)', 
              textAlign: 'left',
              transition: 'all 0.2s ease-in-out'
            }}
            onMouseEnter={(e) => e.currentTarget.style.borderColor = 'rgba(0, 229, 255, 0.2)'}
            onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
          >
            <div className="watermark-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  background: 'rgba(0, 229, 255, 0.08)',
                  color: 'var(--accent)',
                  fontSize: '14px'
                }}>
                  ⬡
                </span>
                <p className="section-label" style={{ 
                  margin: 0, 
                  fontSize: '11px', 
                  fontFamily: 'var(--font-mono)', 
                  letterSpacing: '0.08em', 
                  color: 'var(--text)'
                }}>
                  GALLERY SETTINGS & PROTECTION
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>WATERMARK</span>
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
            </div>

            <div className="gallery-settings-row" style={{ display: 'flex', gap: '16px', width: '100%', flexDirection: watermarkEnabled ? 'row' : 'column' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                <label style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>GALLERY DISPLAY TITLE</label>
                <input
                  type="text"
                  value={galleryTitle}
                  onChange={(e) => setGalleryTitle(e.target.value)}
                  placeholder="Enter gallery title (e.g., Ghost Gallery)"
                  style={{
                    width: '100%',
                    background: 'rgba(8, 12, 15, 0.95)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    padding: '14px 18px',
                    color: '#ffffff',
                    fontFamily: 'var(--font-mono), monospace',
                    fontSize: '13px',
                    outline: 'none',
                    letterSpacing: '0.05em',
                    transition: 'all 0.15s'
                  }}
                  onFocus={(e) => e.target.style.borderColor = 'var(--accent)'}
                  onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
                />
              </div>

              {watermarkEnabled && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                  <label style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>WATERMARK TEXT PROTECTION</label>
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
                      border: '1px solid var(--border)',
                      borderRadius: '6px',
                      padding: '14px 18px',
                      color: '#ffffff',
                      fontFamily: 'var(--font-mono), monospace',
                      fontSize: '13px',
                      outline: 'none',
                      letterSpacing: '0.05em',
                      transition: 'all 0.15s'
                    }}
                    onFocus={(e) => e.target.style.borderColor = 'var(--accent)'}
                    onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
                  />
                </div>
              )}
            </div>

            <span className="input-hint" style={{ 
              fontSize: '11px', 
              color: 'var(--text-muted)', 
              fontFamily: 'var(--font-mono), monospace',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              paddingLeft: '4px'
            }}>
              <span style={{ color: 'var(--accent)', fontSize: '12px' }}>⬡</span> Custom title and watermark text will be preserved securely.
            </span>
          </div>

          {error && (
            <div style={{
              background: 'linear-gradient(90deg, rgba(255, 59, 92, 0.08), rgba(255, 59, 92, 0.02), rgba(255, 59, 92, 0.08))',
              border: '1px solid rgba(255, 59, 92, 0.2)',
              borderRadius: '6px',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 4px 16px rgba(255, 59, 92, 0.05)',
              width: '100%'
            }}>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '16px',
                height: '16px',
                borderRadius: '50%',
                background: 'rgba(255, 59, 92, 0.15)',
                color: 'var(--accent2)',
                fontSize: '10px',
                fontWeight: 'bold',
                fontFamily: 'var(--font-mono)'
              }}>!</span>
              <p style={{
                color: 'var(--accent2)',
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
                margin: 0,
                textTransform: 'uppercase',
                letterSpacing: '0.03em',
                fontWeight: '500'
              }}>
                {error}
              </p>
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
              <span className="spinner-text">
                {uploadProgress < files.length 
                  ? `Processing ${uploadProgress + 1} of ${files.length}` 
                  : 'Finalizing gallery'}
                <span className="dots">...</span>
              </span>
            ) : (
              <span>Generate Secure Link → {files.length > 0 && `(${files.length} photo${files.length > 1 ? "s" : ""})`}</span>
            )}
          </button>
        </>
      ) : (
        /* TAB 2: MY GALLERIES DASHBOARD */
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p className="section-label" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers size={14} style={{ color: 'var(--accent)' }} /> MANAGE ACTIVE REUSABLE GALLERIES
            </p>
            <button
              onClick={fetchMyGalleries}
              disabled={dashboardLoading}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--accent)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12px',
                fontFamily: 'var(--font-mono)'
              }}
            >
              <RefreshCw size={12} className={dashboardLoading ? 'animate-spin' : ''} /> Refresh Status
            </button>
          </div>

          {dashboardLoading && myGalleries.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '40px 0', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '14px' }}>
              <div className="status-spinner" style={{ width: '32px', height: '32px', marginBottom: '12px' }}></div>
              Loading live gallery states...
            </div>
          ) : myGalleries.length === 0 ? (
            <div style={{ border: '1px dashed var(--border)', borderRadius: '4px', padding: '48px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', margin: '0 0 8px 0' }}>No galleries saved yet.</p>
              <p style={{ fontSize: '12px', margin: 0 }}>Create a new gallery while logged in to see it here.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
              {myGalleries.map((gal) => (
                <div
                  key={gal.id}
                  style={{
                    background: 'rgba(14, 20, 25, 0.55)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    padding: '24px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                    textAlign: 'left'
                  }}
                >
                  {/* Card Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
                    <div>
                      <h3 style={{ fontSize: '18px', fontWeight: 'bold', margin: '0 0 4px 0', color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>
                        {gal.title || 'Untitled Gallery'}
                      </h3>
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0, fontFamily: 'var(--font-mono)' }}>
                        ID: {gal.id} • Created: {new Date(gal.createdAt || gal.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <span style={{ background: 'rgba(0, 229, 255, 0.08)', border: '1px solid rgba(0, 229, 255, 0.2)', padding: '4px 8px', borderRadius: '3px', fontSize: '11px', color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>
                        {gal.images?.length || gal.imageCount || 0} photo{(gal.images?.length || gal.imageCount) !== 1 ? 's' : ''}
                      </span>
                      <button
                        onClick={() => handleDeleteGallery(gal.id)}
                        disabled={deletingGalleryId === gal.id}
                        style={{
                          background: 'rgba(255, 59, 92, 0.08)',
                          border: '1px solid rgba(255, 59, 92, 0.3)',
                          padding: '4px 8px',
                          borderRadius: '3px',
                          color: 'var(--accent2)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '11px',
                          fontFamily: 'var(--font-mono)',
                          transition: 'all 0.15s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 59, 92, 0.15)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 59, 92, 0.08)'}
                      >
                        <Trash2 size={12} /> {deletingGalleryId === gal.id ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  </div>

                  {gal.error ? (
                    <div style={{ fontSize: '12px', color: 'var(--accent2)', fontFamily: 'var(--font-mono)' }}>
                      ⚠️ {gal.error}
                    </div>
                  ) : (
                    <>
                      {/* Live Links Section */}
                      <div>
                        <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', margin: '0 0 8px 0', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Link2 size={12} style={{ color: 'var(--accent)' }} /> Share Links:
                        </p>
                        <div 
                          className="custom-scrollbar"
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px',
                            maxHeight: '220px',
                            overflowY: 'auto',
                            paddingRight: '4px'
                          }}
                        >
                          {gal.links && gal.links.filter((l: any) => l.status === 'active').length === 0 && (
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                              No active links. Generate a new link below to share this gallery.
                            </span>
                          )}
                          {gal.links && gal.links.map((link: any) => (
                            <div
                              key={link.id}
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                background: link.status === 'active' ? 'rgba(8, 12, 15, 0.6)' : 'rgba(8, 12, 15, 0.3)',
                                border: '1px solid var(--border)',
                                borderRadius: '4px',
                                padding: '8px 12px',
                                fontSize: '12px',
                                gap: '12px',
                                opacity: link.status === 'active' ? 1 : 0.6
                              }}
                            >
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden' }}>
                                <span style={{ fontFamily: 'var(--font-mono)', color: link.status === 'active' ? 'var(--accent)' : 'var(--text-muted)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                  {link.url}
                                </span>
                                <div style={{ display: 'flex', gap: '12px', fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                                  <span>Type: {link.oneTimeUse ? 'One-time' : 'Multi-use'}</span>
                                  <span>Views: {link.accessCount || 0}</span>
                                  <span>Expires: {new Date(link.expiresAt).toLocaleTimeString()}</span>
                                  <span style={{ color: link.status === 'active' ? 'var(--success)' : link.status === 'used' ? 'var(--accent2)' : 'var(--warning)', fontWeight: 'bold' }}>
                                    [{link.status.toUpperCase()}]
                                  </span>
                                </div>
                              </div>

                              {link.status === 'active' && (
                                <div style={{ display: 'flex', gap: '6px' }}>
                                  <button
                                    onClick={() => copyToClipboard(link.url, link.id)}
                                    style={{
                                      background: 'var(--surface2)',
                                      border: '1px solid var(--border)',
                                      color: 'var(--text)',
                                      padding: '4px 8px',
                                      borderRadius: '3px',
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      fontFamily: 'var(--font-mono)',
                                      fontSize: '11px'
                                    }}
                                  >
                                    {copiedLinkId === link.id ? <Check size={12} style={{ color: 'var(--success)' }} /> : <Copy size={12} />}
                                    {copiedLinkId === link.id ? 'Copied' : 'Copy'}
                                  </button>
                                  <button
                                    onClick={() => window.open(`${link.url}?preview=true`, '_blank')}
                                    style={{
                                      background: 'rgba(0, 229, 255, 0.08)',
                                      border: '1px solid var(--accent)',
                                      color: 'var(--accent)',
                                      padding: '4px 8px',
                                      borderRadius: '3px',
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      fontFamily: 'var(--font-mono)',
                                      fontSize: '11px'
                                    }}
                                  >
                                    <Eye size={12} /> Preview
                                  </button>
                                  <button
                                    onClick={() => handleRevokeLink(link.token, link.shortToken)}
                                    style={{
                                      background: 'rgba(255, 59, 92, 0.08)',
                                      border: '1px solid rgba(255, 59, 92, 0.3)',
                                      color: 'var(--accent2)',
                                      padding: '4px 8px',
                                      borderRadius: '3px',
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      fontFamily: 'var(--font-mono)',
                                      fontSize: '11px',
                                      transition: 'all 0.15s'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 59, 92, 0.15)'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 59, 92, 0.08)'}
                                  >
                                    <Trash2 size={12} /> Revoke
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Action trigger to Generate Link */}
                      <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px', marginTop: '4px' }}>
                        {generatingLinkFor === gal.id ? (
                          <div style={{ background: 'rgba(8, 12, 15, 0.4)', border: '1px solid var(--border)', padding: '16px', borderRadius: '4px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Clock size={12} style={{ color: 'var(--accent)' }} /> SET NEW LINK EXPIRATION
                              </span>
                              <button
                                onClick={() => { setGeneratingLinkFor(null); setNewLinkResult(null); }}
                                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '14px' }}
                              >
                                Cancel
                              </button>
                            </div>

                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                              {EXPIRY_OPTIONS.map((opt) => (
                                <button
                                  key={opt.hours}
                                  type="button"
                                  className={`expiry-btn ${newLinkHours === opt.hours ? "active" : ""}`}
                                  onClick={() => setNewLinkHours(opt.hours)}
                                  style={{ padding: '6px 12px', fontSize: '11px' }}
                                >
                                  {opt.label}
                                </button>
                              ))}
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px' }}>
                              <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Lock size={12} style={{ color: 'var(--accent)' }} /> LINK TYPE:
                              </span>
                              <button
                                type="button"
                                onClick={() => setNewLinkOneTime(true)}
                                style={{
                                  background: newLinkOneTime ? 'rgba(0, 229, 255, 0.08)' : 'transparent',
                                  border: newLinkOneTime ? '1px solid var(--accent)' : '1px solid var(--border)',
                                  color: newLinkOneTime ? 'var(--accent)' : 'var(--text-muted)',
                                  padding: '4px 8px',
                                  borderRadius: '2px',
                                  fontSize: '11px',
                                  fontFamily: 'var(--font-mono)',
                                  cursor: 'pointer'
                                }}
                              >
                                One-Time Use
                              </button>
                              <button
                                type="button"
                                onClick={() => setNewLinkOneTime(false)}
                                style={{
                                  background: !newLinkOneTime ? 'rgba(0, 229, 255, 0.08)' : 'transparent',
                                  border: !newLinkOneTime ? '1px solid var(--accent)' : '1px solid var(--border)',
                                  color: !newLinkOneTime ? 'var(--accent)' : 'var(--text-muted)',
                                  padding: '4px 8px',
                                  borderRadius: '2px',
                                  fontSize: '11px',
                                  fontFamily: 'var(--font-mono)',
                                  cursor: 'pointer'
                                }}
                              >
                                Multi-Use
                              </button>
                            </div>

                              {newLinkResult && (
                                <div style={{ background: 'rgba(0, 255, 136, 0.04)', border: '1px solid rgba(0, 255, 136, 0.2)', padding: '12px', borderRadius: '4px', marginTop: '4px' }}>
                                  <p style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--success)', margin: '0 0 6px 0', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <ShieldCheck size={12} /> LINK GENERATED SUCCESSFULLY!
                                  </p>
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                  <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--accent)', textOverflow: 'ellipsis', overflow: 'hidden', flex: 1 }}>{newLinkResult.url}</span>
                                  <button
                                    onClick={() => copyToClipboard(newLinkResult.url, 'new-link')}
                                    style={{ background: 'var(--accent)', border: 'none', color: 'var(--bg)', padding: '4px 8px', borderRadius: '2px', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 'bold' }}
                                  >
                                    {copiedLinkId === 'new-link' ? 'Copied' : 'Copy'}
                                  </button>
                                </div>
                              </div>
                            )}

                            <button
                              onClick={() => handleCreateNewLink(gal.id)}
                              disabled={newLinkLoading}
                              style={{
                                width: '100%',
                                padding: '10px',
                                background: 'var(--accent)',
                                border: 'none',
                                borderRadius: '2px',
                                color: 'var(--bg)',
                                fontFamily: 'var(--font-mono)',
                                fontSize: '12px',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                transition: 'all 0.15s'
                              }}
                            >
                              {newLinkLoading ? 'Generating...' : 'Generate New Link →'}
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setGeneratingLinkFor(gal.id); setNewLinkResult(null); }}
                            style={{
                              background: 'transparent',
                              border: '1px dashed var(--border)',
                              width: '100%',
                              padding: '12px',
                              borderRadius: '4px',
                              color: 'var(--text-muted)',
                              fontFamily: 'var(--font-mono)',
                              fontSize: '12px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px',
                              transition: 'all 0.15s'
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                          >
                            <Plus size={14} /> Create New Share Link
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Security Badges */}
      <div className="security-badges">
        <span><Lock size={14} /> One-time access</span>
        <span><Droplet size={14} /> Watermarked</span>
        <span><Clock size={14} /> Auto-expires</span>
        <span><Link2Off size={14} /> No direct URLs</span>
      </div>

      {/* CREATOR ACCESS SIGN IN / SIGN UP MODAL */}
      {authModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(3, 7, 10, 0.85)',
            backdropFilter: 'blur(16px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            animation: 'fadeIn 0.2s ease-out'
          }}
          onClick={() => setAuthModalOpen(false)}
        >
          <div
            style={{
              background: 'rgba(12, 19, 26, 0.95)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              padding: '40px 32px',
              maxWidth: '420px',
              width: '90%',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6), 0 0 40px rgba(0, 229, 255, 0.08)',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              gap: '24px'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Elegant Close Button */}
            <button
              onClick={() => setAuthModalOpen(false)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                fontSize: '20px',
                cursor: 'pointer',
                transition: 'color 0.15s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text)'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
            >
              ×
            </button>

            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: 'rgba(0, 229, 255, 0.08)',
                border: '1px solid var(--accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px auto',
                color: 'var(--accent)',
                fontSize: '18px',
                fontWeight: 'bold',
                boxShadow: '0 0 16px rgba(0, 229, 255, 0.2)'
              }}>
                ⬡
              </div>
              <h3 style={{
                fontSize: '20px',
                fontFamily: 'var(--font-display)',
                color: 'var(--text)',
                letterSpacing: '0.08em',
                margin: 0,
                textTransform: 'uppercase'
              }}>
                {authType === 'signin' ? 'CREATOR ACCESS' : 'CREATE ACCOUNT'}
              </h3>
              <p style={{
                fontSize: '11px',
                color: 'var(--text-muted)',
                fontFamily: 'var(--font-mono)',
                margin: '6px 0 0 0',
                letterSpacing: '0.02em',
                textTransform: 'uppercase'
              }}>
                {authType === 'signin' ? 'Authenticate to manage secure galleries' : 'Register as a certified content creator'}
              </p>
            </div>

            <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>EMAIL ADDRESS</label>
                <input
                  type="email"
                  required
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="creator@ghostgallery.com"
                  style={{
                    width: '100%',
                    background: 'rgba(8, 12, 15, 0.95)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    padding: '14px',
                    color: '#ffffff',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '13px',
                    outline: 'none',
                    transition: 'all 0.15s'
                  }}
                  onFocus={(e) => e.target.style.borderColor = 'var(--accent)'}
                  onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>PASSWORD</label>
                <input
                  type="password"
                  required
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="••••••••••••"
                  style={{
                    width: '100%',
                    background: 'rgba(8, 12, 15, 0.95)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    padding: '14px',
                    color: '#ffffff',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '13px',
                    outline: 'none',
                    transition: 'all 0.15s'
                  }}
                  onFocus={(e) => e.target.style.borderColor = 'var(--accent)'}
                  onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
                />
              </div>

              {authError && (
                <div style={{
                  background: 'linear-gradient(90deg, rgba(255, 59, 92, 0.08), rgba(255, 59, 92, 0.02), rgba(255, 59, 92, 0.08))',
                  border: '1px solid rgba(255, 59, 92, 0.2)',
                  borderRadius: '6px',
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 16px rgba(255, 59, 92, 0.05)'
                }}>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    background: 'rgba(255, 59, 92, 0.15)',
                    color: 'var(--accent2)',
                    fontSize: '10px',
                    fontWeight: 'bold',
                    fontFamily: 'var(--font-mono)'
                  }}>!</span>
                  <p style={{
                    color: 'var(--accent2)',
                    fontSize: '11px',
                    fontFamily: 'var(--font-mono)',
                    margin: 0,
                    textTransform: 'uppercase',
                    letterSpacing: '0.03em',
                    fontWeight: '500'
                  }}>
                    {authError}
                  </p>
                </div>
              )}

              <button
                type="submit"
                disabled={authLoading}
                style={{
                  width: '100%',
                  padding: '14px',
                  background: 'var(--accent)',
                  border: 'none',
                  borderRadius: '6px',
                  color: 'var(--bg)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  letterSpacing: '0.05em',
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.filter = 'brightness(1.1)'}
                onMouseLeave={(e) => e.currentTarget.style.filter = 'none'}
              >
                {authLoading ? 'AUTHENTICATING...' : authType === 'signin' ? 'AUTHENTICATE CREATOR' : 'CREATE CREATOR ACCOUNT'}
              </button>
            </form>

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px', textAlign: 'center' }}>
              <button
                onClick={() => { setAuthType(authType === 'signin' ? 'signup' : 'signin'); setAuthError(null); }}
                style={{ background: 'transparent', border: 'none', color: 'var(--accent)', fontFamily: 'var(--font-mono)', fontSize: '11px', cursor: 'pointer', letterSpacing: '0.02em' }}
              >
                {authType === 'signin' ? "NEW CREATOR? REGISTER SECURE ACCOUNT" : 'EXISTING CREATOR? ACCESS PORTAL'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* High-End Cyberpunk Dialog Modal (Alert/Confirm) */}
      {dialogOpen && dialogConfig && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(3, 7, 10, 0.85)',
          backdropFilter: 'blur(12px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <div style={{
            background: 'rgba(12, 19, 26, 0.95)',
            border: `1px solid ${
              dialogConfig.icon === 'success' ? '#10b981' :
              dialogConfig.icon === 'warning' ? '#f59e0b' :
              dialogConfig.icon === 'danger' ? '#ff3b5c' : '#00e5ff'
            }`,
            boxShadow: `0 8px 32px ${
              dialogConfig.icon === 'success' ? 'rgba(16, 185, 129, 0.15)' :
              dialogConfig.icon === 'warning' ? 'rgba(245, 158, 11, 0.15)' :
              dialogConfig.icon === 'danger' ? 'rgba(255, 59, 92, 0.15)' : 'rgba(0, 229, 255, 0.15)'
            }`,
            borderRadius: '8px',
            padding: '32px',
            width: '90%',
            maxWidth: '440px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            gap: '20px'
          }}>
            {/* Dynamic Status Icon */}
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: `${
                dialogConfig.icon === 'success' ? 'rgba(16, 185, 129, 0.1)' :
                dialogConfig.icon === 'warning' ? 'rgba(245, 158, 11, 0.1)' :
                dialogConfig.icon === 'danger' ? 'rgba(255, 59, 92, 0.1)' : 'rgba(0, 229, 255, 0.1)'
              }`,
              border: `1px solid ${
                dialogConfig.icon === 'success' ? '#10b981' :
                dialogConfig.icon === 'warning' ? '#f59e0b' :
                dialogConfig.icon === 'danger' ? '#ff3b5c' : '#00e5ff'
              }`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {dialogConfig.icon === 'success' && <ShieldCheck size={32} style={{ color: '#10b981' }} />}
              {dialogConfig.icon === 'warning' && <AlertOctagon size={32} style={{ color: '#f59e0b' }} />}
              {dialogConfig.icon === 'danger' && <AlertOctagon size={32} style={{ color: '#ff3b5c' }} />}
              {dialogConfig.icon === 'info' && <Lock size={32} style={{ color: '#00e5ff' }} />}
            </div>

            <h3 style={{
              margin: 0,
              fontSize: '16px',
              fontFamily: 'var(--font-mono)',
              color: 'var(--text)',
              letterSpacing: '0.1em',
              textTransform: 'uppercase'
            }}>
              {dialogConfig.title}
            </h3>

            <p style={{
              margin: 0,
              fontSize: '13px',
              color: 'var(--text-muted)',
              lineHeight: '1.6',
              fontFamily: 'var(--font-mono)'
            }}>
              {dialogConfig.message}
            </p>

            <div style={{ display: 'flex', gap: '12px', width: '100%', marginTop: '8px' }}>
              {dialogConfig.type === 'confirm' ? (
                <>
                  <button
                    onClick={() => setDialogOpen(false)}
                    style={{
                      flex: 1,
                      padding: '12px',
                      background: 'var(--surface2)',
                      border: '1px solid var(--border)',
                      borderRadius: '4px',
                      color: 'var(--text)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '12px',
                      cursor: 'pointer',
                      transition: 'all 0.15s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--text-muted)'}
                    onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
                  >
                    CANCEL
                  </button>
                  <button
                    onClick={() => {
                      setDialogOpen(false)
                      if (dialogConfig.onConfirm) dialogConfig.onConfirm()
                    }}
                    style={{
                      flex: 1,
                      padding: '12px',
                      background: dialogConfig.icon === 'danger' ? '#ff3b5c' : 'var(--accent)',
                      border: 'none',
                      borderRadius: '4px',
                      color: dialogConfig.icon === 'danger' ? '#ffffff' : 'var(--bg)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      transition: 'all 0.15s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.filter = 'brightness(1.1)'}
                    onMouseLeave={(e) => e.currentTarget.style.filter = 'none'}
                  >
                    CONFIRM
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setDialogOpen(false)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: 'var(--accent)',
                    border: 'none',
                    borderRadius: '4px',
                    color: 'var(--bg)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.filter = 'brightness(1.1)'}
                  onMouseLeave={(e) => e.currentTarget.style.filter = 'none'}
                >
                  OK
                </button>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
