import { createClient } from '@/lib/supabase/server'
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

    // Verify preview permission (only the creator can use preview=true)
    let isPreview = preview
    if (isPreview) {
      const { data: { user } } = await supabase.auth.getUser()
      
      const createdGalleriesCookie = cookieStore.get('created_galleries')?.value || ''
      const createdGalleries = createdGalleriesCookie ? createdGalleriesCookie.split(',') : []
      
      const isOwnerByAuth = user && shareLink.galleries.user_id === user.id
      const isOwnerByCookie = createdGalleries.includes(shareLink.galleries.id)
      
      if (!isOwnerByAuth && !isOwnerByCookie) {
        isPreview = false
      }
    }

    // Check if link has expired (allow creator preview regardless)
    if (!isPreview && new Date(shareLink.expires_at) < new Date()) {
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

    // Create response with session cookie
    const response = NextResponse.json({
      valid: true,
      gallery: {
        id: shareLink.galleries.id,
        title: shareLink.galleries.title,
        watermarkText: shareLink.galleries.watermark_text,
        images: shareLink.galleries.gallery_images.map((img: {
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
