'use client'

import { Loader2 } from 'lucide-react'
import React from 'react'

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => Promise<void>;
  email: string;
  setEmail: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  authType: 'signin' | 'signup';
  setAuthType: (t: 'signin' | 'signup') => void;
  loading: boolean;
  error: string | null;
  setError: (e: string | null) => void;
}

export function AuthModal({
  isOpen, onClose, onSubmit, email, setEmail, password, setPassword, authType, setAuthType, loading, error, setError
}: AuthModalProps) {
  if (!isOpen) return null;

  return (
    <div className="gg-backdrop" onClick={onClose}>
      <div className="gg-modal" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} style={{
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

        <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'rgba(136,146,164,.5)', letterSpacing: '.07em' }}>EMAIL</label>
            <input className="gg-input" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="creator@ghostgallery.com" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'rgba(136,146,164,.5)', letterSpacing: '.07em' }}>PASSWORD</label>
            <input className="gg-input" type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••••" />
          </div>
          {error && <div className="gg-error"><div style={{ width: 16, height: 16, borderRadius: '50%', background: 'rgba(239,68,68,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>!</div>{error}</div>}
          <button type="submit" disabled={loading} style={{
            padding: '14px', border: 'none', borderRadius: 8, cursor: 'pointer',
            background: 'linear-gradient(135deg, #00c8e6, #00e5ff)',
            color: '#041a20', fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700,
            letterSpacing: '.08em', transition: 'all .15s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
            onMouseEnter={e => e.currentTarget.style.filter = 'brightness(1.1)'}
            onMouseLeave={e => e.currentTarget.style.filter = 'none'}
          >
            {loading ? <><Loader2 size={14} style={{ animation: 'gg-spin 1s linear infinite' }} /> Authenticating…</> : authType === 'signin' ? 'Authenticate →' : 'Create Account →'}
          </button>
        </form>

        <div style={{ borderTop: '1px solid rgba(255,255,255,.06)', paddingTop: 16, textAlign: 'center' }}>
          <button onClick={() => { setAuthType(authType === 'signin' ? 'signup' : 'signin'); setError(null) }}
            style={{ background: 'transparent', border: 'none', color: 'rgba(0,229,255,.7)', fontFamily: 'var(--font-mono)', fontSize: '11px', cursor: 'pointer', letterSpacing: '.04em', transition: 'color .15s' }}
            onMouseEnter={e => e.currentTarget.style.color = '#00e5ff'}
            onMouseLeave={e => e.currentTarget.style.color = 'rgba(0,229,255,.7)'}
          >
            {authType === 'signin' ? 'New here? Create an account' : 'Have an account? Sign in'}
          </button>
        </div>
      </div>
    </div>
  )
}
