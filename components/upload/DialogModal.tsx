'use client'

import { ShieldCheck, AlertOctagon, Lock } from 'lucide-react'
import React from 'react'

interface DialogModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: {
    type: 'alert' | 'confirm'
    title: string
    message: string
    icon: 'info' | 'success' | 'warning' | 'danger'
    onConfirm?: () => void
  } | null;
}

export function DialogModal({ isOpen, onClose, config }: DialogModalProps) {
  if (!isOpen || !config) return null;

  const iconColor = (icon: string) =>
    icon === 'success' ? '#10b981' : icon === 'warning' ? '#f59e0b' : icon === 'danger' ? '#ef4444' : '#00e5ff'
  
  const iconBg = (icon: string) =>
    icon === 'success' ? 'rgba(16,185,129,.12)' : icon === 'warning' ? 'rgba(245,158,11,.12)' : icon === 'danger' ? 'rgba(239,68,68,.12)' : 'rgba(0,229,255,.12)'

  return (
    <div className="gg-backdrop">
      <div className="gg-modal" style={{ maxWidth: 420, border: `1px solid ${iconColor(config.icon)}22`, boxShadow: `0 24px 64px rgba(0,0,0,.7), 0 0 40px ${iconColor(config.icon)}18` }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, textAlign: 'center' }}>
          <div style={{ width: 60, height: 60, borderRadius: '50%', background: iconBg(config.icon), border: `1px solid ${iconColor(config.icon)}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 20px ${iconColor(config.icon)}20` }}>
            {config.icon === 'success' && <ShieldCheck size={28} style={{ color: iconColor('success') }} />}
            {(config.icon === 'warning' || config.icon === 'danger') && <AlertOctagon size={28} style={{ color: iconColor(config.icon) }} />}
            {config.icon === 'info' && <Lock size={28} style={{ color: iconColor('info') }} />}
          </div>
          <div>
            <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', letterSpacing: '.1em', color: '#e8f0f8', margin: '0 0 10px', textTransform: 'uppercase' }}>{config.title}</h3>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'rgba(136,146,164,.7)', lineHeight: 1.7, margin: 0 }}>{config.message}</p>
          </div>
          <div style={{ display: 'flex', gap: 10, width: '100%' }}>
            {config.type === 'confirm' ? (
              <>
                <button onClick={onClose} style={{
                  flex: 1, padding: '12px', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8,
                  background: 'rgba(255,255,255,.04)', color: 'rgba(200,216,232,.7)',
                  fontFamily: 'var(--font-mono)', fontSize: '12px', cursor: 'pointer', letterSpacing: '.05em',
                  transition: 'all .15s',
                }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,.2)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,.1)'}
                >Cancel</button>
                <button onClick={() => { onClose(); config.onConfirm?.() }} style={{
                  flex: 1, padding: '12px', border: 'none', borderRadius: 8, cursor: 'pointer',
                  background: config.icon === 'danger' ? '#ef4444' : 'linear-gradient(135deg, #00c8e6, #00e5ff)',
                  color: config.icon === 'danger' ? '#fff' : '#041a20',
                  fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700, letterSpacing: '.06em', transition: 'all .15s',
                }}
                  onMouseEnter={e => e.currentTarget.style.filter = 'brightness(1.1)'}
                  onMouseLeave={e => e.currentTarget.style.filter = 'none'}
                >Confirm</button>
              </>
            ) : (
              <button onClick={onClose} style={{
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
  )
}
