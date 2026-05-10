'use client'

import React from 'react'
import { Lock, AlertTriangle } from 'lucide-react'

export function BlurOverlay() {
  return (
    <div className="iv-blur-overlay">
      <div className="iv-blur-card">
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(0,229,255,.08)', border: '1px solid rgba(0,229,255,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 24px rgba(0,229,255,.15)' }}>
          <Lock size={22} style={{ color: '#00e5ff' }} />
        </div>
        <p style={{ fontFamily: 'var(--font-display, var(--font-mono))', fontSize: '16px', color: '#e8f0f8', margin: 0, letterSpacing: '.04em' }}>Content Hidden</p>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'rgba(136,146,164,.55)', margin: 0, letterSpacing: '.06em', textTransform: 'uppercase' }}>Return to this tab to resume viewing</p>
      </div>
    </div>
  )
}

interface ReloadModalProps {
  onClose: () => void
}

export function ReloadModal({ onClose }: ReloadModalProps) {
  return (
    <div className="iv-reload-modal">
      <div style={{
        width: '90%', maxWidth: 440,
        background: 'linear-gradient(160deg, rgba(12,18,28,.98), rgba(8,12,20,.96))',
        border: '1px solid rgba(239,68,68,.3)',
        borderRadius: 20, padding: '44px 36px',
        textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0,
        boxShadow: '0 32px 80px rgba(0,0,0,.8), 0 0 60px rgba(239,68,68,.12)',
        animation: 'iv-popin .3s cubic-bezier(.16,1,.3,1)',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(90deg, transparent, rgba(239,68,68,.4), transparent)' }} />

        <div style={{
          width: 72, height: 72, borderRadius: '50%', marginBottom: 24,
          background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 30px rgba(239,68,68,.2)', color: '#ef4444',
          animation: 'iv-glow-red 2s ease-in-out infinite',
        }}>
          <AlertTriangle size={30} strokeWidth={1.8} />
        </div>

        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 100, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.25)', marginBottom: 16 }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 5px #ef4444', display: 'inline-block', animation: 'iv-blink 1s ease-in-out infinite' }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#ef4444', letterSpacing: '.1em' }}>SECURE WARNING</span>
        </div>

        <h3 style={{ fontFamily: 'var(--font-display, var(--font-mono))', fontSize: '22px', color: '#e8f0f8', margin: '0 0 14px', letterSpacing: '.04em' }}>Confirm Reload?</h3>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'rgba(136,146,164,.7)', lineHeight: 1.7, margin: '0 0 28px' }}>
          This is a <strong style={{ color: '#e8f0f8' }}>single-use</strong> gallery. Reloading or closing will permanently destroy this cryptographic token and revoke your access forever.
        </p>

        <div style={{ display: 'flex', gap: 12, width: '100%' }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '13px', borderRadius: 10, cursor: 'pointer',
            background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)',
            color: 'rgba(200,216,232,.8)', fontFamily: 'var(--font-mono)', fontSize: '12px',
            fontWeight: 700, letterSpacing: '.06em', transition: 'all .15s',
          }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,.09)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,.2)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,.05)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,.1)' }}
          >
            Cancel — Stay
          </button>
          <button onClick={() => window.location.reload()} style={{
            flex: 1, padding: '13px', borderRadius: 10, cursor: 'pointer',
            background: '#ef4444', border: 'none',
            color: '#fff', fontFamily: 'var(--font-mono)', fontSize: '12px',
            fontWeight: 700, letterSpacing: '.06em',
            boxShadow: '0 4px 20px rgba(239,68,68,.4)', transition: 'all .15s',
          }}
            onMouseEnter={e => { e.currentTarget.style.filter = 'brightness(1.1)'; e.currentTarget.style.boxShadow = '0 6px 28px rgba(239,68,68,.55)' }}
            onMouseLeave={e => { e.currentTarget.style.filter = 'none'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(239,68,68,.4)' }}
          >
            Confirm Reload
          </button>
        </div>
      </div>
    </div>
  )
}
