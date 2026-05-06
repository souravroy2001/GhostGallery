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

    // Fetch from Vercel Blob and validate database token concurrently in parallel!
    const [dbResult, blobResult] = await Promise.all([
      supabase
        .from('share_links')
        .select('*, galleries(*)')
        .eq('token', token)
        .single(),
      get(pathname, {
        access: 'private',
        ifNoneMatch: request.headers.get('if-none-match') ?? undefined,
      })
    ])

    const { data: shareLink, error: shareLinkError } = dbResult

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

    // Verify the image belongs to the gallery securely via pathname comparison (0ms latency, zero database overhead)
    if (!pathname.includes(shareLink.gallery_id)) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 })
    }

    const result = blobResult

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
        'Cache-Control': 'private, max-age=1800, stale-while-revalidate=60',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    console.error('Error serving image:', error)
    return NextResponse.json({ error: 'Failed to serve image' }, { status: 500 })
  }
}
