import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url')
  
  if (!url) {
    return NextResponse.json({ error: 'No URL provided' }, { status: 400 })
  }

  try {
    // Only allow HTTP and HTTPS urls
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return NextResponse.json({ error: 'Invalid URL scheme' }, { status: 400 })
    }

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; GhostGallery/1.0)',
      }
    })
    
    if (!res.ok) {
      throw new Error(`Failed to fetch image: ${res.statusText}`)
    }
    
    const arrayBuffer = await res.arrayBuffer()
    const contentType = res.headers.get('content-type') || 'image/jpeg'
    
    // Validate that it's actually an image
    if (!contentType.startsWith('image/')) {
      return NextResponse.json({ error: 'URL does not point to a valid image' }, { status: 400 })
    }
    
    return new NextResponse(arrayBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
      }
    })
  } catch (error) {
    console.error('Image proxy error:', error)
    return NextResponse.json({ error: 'Failed to fetch external image' }, { status: 500 })
  }
}
