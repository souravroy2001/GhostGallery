import { get } from '@vercel/blob'
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  try {
    const pathname = request.nextUrl.searchParams.get('pathname')
    const token = request.nextUrl.searchParams.get('token')

    if (!pathname || !token) {
      return NextResponse.json({ error: 'Missing pathname or token' }, { status: 400 })
    }

    const supabase = await createClient()
    const cookieStore = await cookies()
    const sessionId = cookieStore.get('session_id')?.value

    // Validate token and check expiry
    const { data: shareLink, error: shareLinkError } = await supabase
      .from('share_links')
      .select('*, galleries(*)')
      .eq('token', token)
      .single()

    if (shareLinkError || !shareLink) {
      return NextResponse.json({ error: 'Invalid or expired link' }, { status: 403 })
    }

    // Check if link has expired
    if (new Date(shareLink.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Link has expired' }, { status: 403 })
    }

    // For one-time use links, validate session binding
    if (shareLink.one_time_use && shareLink.session_id && shareLink.session_id !== sessionId) {
      return NextResponse.json({ error: 'This link has already been used by another device' }, { status: 403 })
    }

    // Verify the image belongs to the gallery
    const { data: image, error: imageError } = await supabase
      .from('gallery_images')
      .select('*')
      .eq('blob_pathname', pathname)
      .eq('gallery_id', shareLink.gallery_id)
      .single()

    if (imageError || !image) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 })
    }

    // Fetch the image from Vercel Blob
    const result = await get(pathname, {
      access: 'private',
      ifNoneMatch: request.headers.get('if-none-match') ?? undefined,
    })

    if (!result) {
      return NextResponse.json({ error: 'Image not found in storage' }, { status: 404 })
    }

    // Handle 304 Not Modified
    if (result.statusCode === 304) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          ETag: result.blob.etag,
          'Cache-Control': 'private, no-cache',
        },
      })
    }

    return new NextResponse(result.stream, {
      headers: {
        'Content-Type': result.blob.contentType,
        ETag: result.blob.etag,
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    console.error('Error serving image:', error)
    return NextResponse.json({ error: 'Failed to serve image' }, { status: 500 })
  }
}
