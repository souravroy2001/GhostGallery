import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { nanoid } from 'nanoid'

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json()

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

    // Check if link has expired
    if (new Date(shareLink.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Link has expired', valid: false }, { status: 403 })
    }

    // For one-time use links, check session binding
    if (shareLink.one_time_use) {
      if (shareLink.session_id && shareLink.session_id !== sessionId) {
        return NextResponse.json({ 
          error: 'This link has already been accessed from another device', 
          valid: false 
        }, { status: 403 })
      }

      // Bind session on first access
      if (!shareLink.session_id) {
        const { error: updateError } = await supabase
          .from('share_links')
          .update({
            session_id: sessionId,
            first_accessed_at: new Date().toISOString(),
            access_count: 1,
          })
          .eq('id', shareLink.id)

        if (updateError) {
          console.error('Failed to update share link:', updateError)
        }
      } else {
        // Increment access count for same session
        const { error: updateError } = await supabase
          .from('share_links')
          .update({
            access_count: (shareLink.access_count || 0) + 1,
          })
          .eq('id', shareLink.id)

        if (updateError) {
          console.error('Failed to update access count:', updateError)
        }
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
