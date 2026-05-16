'use client'

import React from 'react'
import { Layers, RefreshCw, Loader2, Trash2, AlertOctagon, Link2, Link2Off, Eye, Copy, Check, Clock, ShieldCheck, Plus } from 'lucide-react'
import { EXPIRY_OPTIONS } from './types'

interface DashboardTabProps {
  fetchMyGalleries: () => Promise<void>;
  dashboardLoading: boolean;
  myGalleries: any[];
  deletingGalleryId: string | null;
  handleDeleteGallery: (id: string) => void;
  copiedLinkId: string | null;
  copyToClipboard: (text: string, id: string) => void;
  handleRevokeLink: (token: string, shortToken: string) => void;
  generatingLinkFor: string | null;
  setGeneratingLinkFor: (id: string | null) => void;
  newLinkResult: any | null;
  setNewLinkResult: (res: any | null) => void;
  newLinkHours: number;
  setNewLinkHours: (h: number) => void;
  newLinkOneTime: boolean;
  setNewLinkOneTime: (b: boolean) => void;
  newLinkLoading: boolean;
  handleCreateNewLink: (galleryId: string) => Promise<void>;
  isAddingMore: boolean;
  addingToGalleryId: string | null;
  setAddingToGalleryId: (id: string | null) => void;
  addMoreFileInputRef: React.RefObject<HTMLInputElement | null>;
  handleAddMoreFiles: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
}

export function DashboardTab({
  fetchMyGalleries, dashboardLoading, myGalleries, deletingGalleryId, handleDeleteGallery, copiedLinkId,
  copyToClipboard, handleRevokeLink, generatingLinkFor, setGeneratingLinkFor, newLinkResult, setNewLinkResult,
  newLinkHours, setNewLinkHours, newLinkOneTime, setNewLinkOneTime, newLinkLoading, handleCreateNewLink,
  isAddingMore, addingToGalleryId, setAddingToGalleryId, addMoreFileInputRef, handleAddMoreFiles
}: DashboardTabProps) {

  return (
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
                {!(gal.targetUrl || gal.target_url) && (
                  <span style={{ padding: '4px 10px', borderRadius: '100px', background: 'rgba(0,229,255,.07)', border: '1px solid rgba(0,229,255,.18)', fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#00e5ff' }}>
                    {gal.images?.length || gal.imageCount || 0} photo{(gal.images?.length || gal.imageCount) !== 1 ? 's' : ''}
                  </span>
                )}
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
                        {[
                          { label: 'One-time', val: true },
                          { label: 'Multi-use', val: false }
                        ].map(o => (
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
                      {!(gal.targetUrl || gal.target_url) && (
                        <button className="gg-dashed-btn" disabled={isAddingMore} onClick={() => { setAddingToGalleryId(gal.id); addMoreFileInputRef.current?.click() }}>
                          {isAddingMore && addingToGalleryId === gal.id
                            ? <><Loader2 size={13} style={{ animation: 'gg-spin 1s linear infinite' }} /> Adding…</>
                            : <><Plus size={13} /> Add Images</>
                          }
                        </button>
                      )}
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
  )
}
