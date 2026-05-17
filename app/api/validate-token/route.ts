import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { del } from '@vercel/blob'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { nanoid } from 'nanoid'

export async function POST(request: NextRequest) {
  try {
    const { token, preview } = await request.json()

    if (!token) {
      return NextResponse.json({ error: 'Missing token' }, { status: 400 })
    }

    const supabase = await createClient()
    const cookieStore = await cookies()
    
    // Get or create session ID
    let sessionId = cookieStore.get('session_id')?.value
    if (!sessionId) {
      sessionId = nanoid(32)
    }

    // Validate token and check expiry
    const { data: shareLink, error: shareLinkError } = await supabase
      .from('share_links')
      .select('*, galleries(*, gallery_images(*))')
      .eq('token', token)
      .single()

    if (shareLinkError || !shareLink) {
      return NextResponse.json({ error: 'Invalid link', valid: false }, { status: 403 })
    }

    // Check if current user is the gallery creator
    const { data: { user } } = await supabase.auth.getUser()
    const createdGalleriesCookie = cookieStore.get('created_galleries')?.value || ''
    const createdGalleries = createdGalleriesCookie ? createdGalleriesCookie.split(',') : []
    const isOwnerByAuth = user && shareLink.galleries.user_id === user.id
    const isOwnerByCookie = createdGalleries.includes(shareLink.galleries.id)
    const isCreator = !!(isOwnerByAuth || isOwnerByCookie)

    // Verify preview permission (only the creator can use preview=true)
    let isPreview = preview && isCreator

    // Check if link has expired (allow creator preview regardless)
    if (!isPreview && new Date(shareLink.expires_at) < new Date()) {
      // If the gallery belongs to an anonymous user (user_id is null/undefined), self-destruct completely!
      if (!shareLink.galleries.user_id) {
        console.log(`Anonymous gallery ${shareLink.galleries.id} has expired. Triggering automated physical self-destruct...`)
        try {
          let adminSupabase = supabase
          const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
          if (serviceRoleKey) {
            adminSupabase = createAdminClient(
              process.env.NEXT_PUBLIC_SUPABASE_URL!,
              serviceRoleKey
            ) as any
          }

          // 1. Cleanup all visual assets in Vercel Blob storage
          const images = shareLink.galleries.gallery_images
          if (images && images.length > 0) {
            const pathnames = images.map((img: any) => img.blob_pathname)
            await del(pathnames)
            console.log(`Self-destruct: Cleaned up ${pathnames.length} blobs.`)
          }

          // 2. Delete the gallery from Supabase (cascades database-wide)
          const { error: deleteError } = await adminSupabase
            .from('galleries')
            .delete()
            .eq('id', shareLink.galleries.id)

          if (deleteError) {
            console.error('Self-destruct database deletion failed:', deleteError)
          } else {
            console.log(`Self-destruct: Successfully purged gallery ${shareLink.galleries.id} from database.`)
          }
        } catch (selfDestructError) {
          console.error('Self-destruct runtime error:', selfDestructError)
        }
      }

      return NextResponse.json({ error: 'Link has expired', valid: false }, { status: 403 })
    }

    // For one-time use links, check if already accessed (allow creator preview regardless)
    if (!isPreview && shareLink.one_time_use && shareLink.access_count > 0) {
      return NextResponse.json({ 
        error: 'This link has already been used and cannot be accessed again.', 
        valid: false 
      }, { status: 403 })
    }

    // Increment access count on first access (skip if previewing)
    if (!isPreview) {
      const { error: updateError } = await supabase
        .from('share_links')
        .update({
          session_id: sessionId,
          first_accessed_at: new Date().toISOString(),
          access_count: (shareLink.access_count || 0) + 1,
        })
        .eq('id', shareLink.id)

      if (updateError) {
        console.error('Failed to update share link access:', updateError)
      }
    }

    let iframeBlocked = false
    if (shareLink.galleries.target_url) {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 3000)
        const headRes = await fetch(shareLink.galleries.target_url, {
          method: 'HEAD',
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GhostGallery/1.0)' },
          signal: controller.signal,
        })
        clearTimeout(timeoutId)
        
        const xFrameOptions = headRes.headers.get('x-frame-options')
        const csp = headRes.headers.get('content-security-policy')
        
        if (
          headRes.status >= 400 ||
          (xFrameOptions && ['DENY', 'SAMEORIGIN'].includes(xFrameOptions.toUpperCase())) ||
          (csp && csp.toLowerCase().includes('frame-ancestors'))
        ) {
          iframeBlocked = true
        }
      } catch (e) {
        // Fallback to true if fetch fails (CORS, network error, etc)
        iframeBlocked = true
      }
    }

    // Create response with session cookie
    const response = NextResponse.json({
      valid: true,
      gallery: {
        id: shareLink.galleries.id,
        title: shareLink.galleries.title,
        watermarkText: shareLink.galleries.watermark_text,
        targetUrl: shareLink.galleries.target_url || null,
        iframeBlocked,
        images: (shareLink.galleries.gallery_images || []).map((img: {
          id: string
          blob_pathname: string
          original_filename: string
        }) => ({
          id: img.id,
          pathname: img.blob_pathname,
          filename: img.original_filename,
        })),
      },
      expiresAt: shareLink.expires_at,
      sessionId: sessionId,
    })

    // Set session cookie
    response.cookies.set('session_id', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24, // 24 hours
    })

    return response
  } catch (error) {
    console.error('Token validation error:', error)
    return NextResponse.json({ error: 'Validation failed', valid: false }, { status: 500 })
  }
}
