'use client'

import React from 'react'
import { Clock, AlertTriangle } from 'lucide-react'

export function LoadingScreen() {
  return (
    <div className="iv-loading">
      <div className="iv-scanline" />
      <div className="iv-spinner" />
      <p className="iv-loading-text">Verifying secure link</p>
      <p className="iv-loading-sub">Decrypting cryptographic token…</p>
    </div>
  )
}

export function UsedScreen() {
  return (
    <div className="iv-status">
      <div className="iv-scanline" />
      <div className="iv-card" style={{ borderColor: 'rgba(239,68,68,.2)', animation: 'iv-glow-red 3s ease-in-out infinite, iv-popin .4s cubic-bezier(.16,1,.3,1) both' }}>
        <div className="iv-icon-ring" style={{ background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', color: '#ef4444', boxShadow: '0 0 30px rgba(239,68,68,.2)' }}>
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
        </div>

        <div className="iv-chip" style={{ background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.25)', color: '#ef4444' }}>
          <span className="iv-chip-dot" style={{ background: '#ef4444', boxShadow: '0 0 5px #ef4444' }} />
          ACCESS DENIED
        </div>

        <h2 style={{ fontFamily: 'var(--font-display, var(--font-mono))', fontSize: '28px', color: '#e8f0f8', margin: '0 0 12px', letterSpacing: '.04em' }}>Link Already Used</h2>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'rgba(136,146,164,.7)', lineHeight: 1.7, margin: 0 }}>
          This secure Ghost Gallery link was already accessed and is permanently destroyed. Single-use tokens cannot be replayed.
        </p>

        <div className="iv-table">
          <div className="iv-table-row">
            <span>STATUS</span>
            <span style={{ color: '#ef4444', fontWeight: 700 }}>REVOKED — 403</span>
          </div>
          <div className="iv-table-row">
            <span>POLICY</span>
            <span style={{ color: '#e8f0f8' }}>SINGLE-USE TOKEN</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export function ExpiredScreen() {
  return (
    <div className="iv-status">
      <div className="iv-scanline" />
      <div className="iv-card" style={{ borderColor: 'rgba(245,158,11,.2)', animation: 'iv-glow-amber 3s ease-in-out infinite, iv-popin .4s cubic-bezier(.16,1,.3,1) both' }}>
        <div className="iv-icon-ring" style={{ background: 'rgba(245,158,11,.1)', border: '1px solid rgba(245,158,11,.3)', color: '#f59e0b', boxShadow: '0 0 30px rgba(245,158,11,.2)' }}>
          <Clock size={30} strokeWidth={1.8} />
        </div>

        <div className="iv-chip" style={{ background: 'rgba(245,158,11,.1)', border: '1px solid rgba(245,158,11,.25)', color: '#f59e0b' }}>
          <span className="iv-chip-dot" style={{ background: '#f59e0b', boxShadow: '0 0 5px #f59e0b' }} />
          TIME EXPIRED
        </div>

        <h2 style={{ fontFamily: 'var(--font-display, var(--font-mono))', fontSize: '28px', color: '#e8f0f8', margin: '0 0 12px', letterSpacing: '.04em' }}>Link Expired</h2>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'rgba(136,146,164,.7)', lineHeight: 1.7, margin: 0 }}>
          This Ghost Gallery link exceeded its validity window and was automatically deactivated. Contact the sender for a new link.
        </p>

        <div className="iv-table">
          <div className="iv-table-row">
            <span>STATUS</span>
            <span style={{ color: '#f59e0b', fontWeight: 700 }}>EXPIRED — 410</span>
          </div>
          <div className="iv-table-row">
            <span>RETENTION</span>
            <span style={{ color: '#e8f0f8' }}>AUTO-DESTRUCT ACTIVE</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export function InvalidScreen() {
  return (
    <div className="iv-status">
      <div className="iv-scanline" />
      <div className="iv-card" style={{ borderColor: 'rgba(239,68,68,.15)', animation: 'iv-popin .4s cubic-bezier(.16,1,.3,1) both' }}>
        <div className="iv-icon-ring" style={{ background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.25)', color: '#ef4444', boxShadow: '0 0 20px rgba(239,68,68,.15)' }}>
          <AlertTriangle size={30} strokeWidth={1.8} />
        </div>

        <div className="iv-chip" style={{ background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)', color: 'rgba(239,68,68,.85)' }}>
          <span className="iv-chip-dot" style={{ background: '#ef4444' }} />
          LINK UNVERIFIED
        </div>

        <h2 style={{ fontFamily: 'var(--font-display, var(--font-mono))', fontSize: '28px', color: '#e8f0f8', margin: '0 0 12px', letterSpacing: '.04em' }}>Invalid Link</h2>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'rgba(136,146,164,.7)', lineHeight: 1.7, margin: 0 }}>
          The cryptographic token is invalid, tampered with, or does not exist on our servers. Verify you have the correct URL.
        </p>

        <div className="iv-table">
          <div className="iv-table-row">
            <span>STATUS</span>
            <span style={{ color: '#ef4444', fontWeight: 700 }}>NOT FOUND — 404</span>
          </div>
          <div className="iv-table-row">
            <span>SECURITY</span>
            <span style={{ color: '#e8f0f8' }}>CRYPTO-TOKEN FAILURE</span>
          </div>
        </div>
      </div>
    </div>
  )
}
