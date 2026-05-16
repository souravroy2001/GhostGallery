import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  try {
    const { slug } = await params
    if (!slug || slug.length === 0) {
      return new NextResponse('Missing parameters', { status: 400 })
    }

    const token = slug[0]

    // Parse the path directly from the raw encoded request pathname to preserve URL spaces (%20) and encoding
    const pathnameEncoded = request.nextUrl.pathname
    const prefix = `/api/proxy-site/${token}`
    const path = pathnameEncoded.startsWith(prefix) ? pathnameEncoded.slice(prefix.length) : ''

    const supabase = await createClient()
    const cookieStore = await cookies()

    // 1. Fetch share link
    const { data: shareLink, error: shareLinkError } = await supabase
      .from('share_links')
      .select('*, galleries(*)')
      .eq('token', token)
      .single()

    if (shareLinkError || !shareLink) {
      return new NextResponse('Unauthorized or invalid link', { status: 403 })
    }

    // 2. Validate session and access rules
    const sessionId = cookieStore.get('session_id')?.value
    const isCreatorCookie = (cookieStore.get('created_galleries')?.value || '').split(',').includes(shareLink.galleries.id)

    const isAuthorized = (sessionId && shareLink.session_id === sessionId) || isCreatorCookie

    // If one-time use and already burned, block access
    if (shareLink.one_time_use && shareLink.access_count > 0 && !isAuthorized) {
      return new NextResponse('This secure link has already been accessed.', { status: 403 })
    }

    // Check expiry
    if (new Date(shareLink.expires_at) < new Date() && !isCreatorCookie) {
      return new NextResponse('Link has expired', { status: 403 })
    }

    const targetUrl = shareLink.galleries.target_url
    if (!targetUrl) {
      return new NextResponse('No target URL found for this share link', { status: 404 })
    }

    // 3. Resolve exact URL to fetch securely without losing any target subpaths
    let urlToFetch = targetUrl
    if (path) {
      try {
        const targetUrlObj = new URL(targetUrl)
        const baseHref = targetUrlObj.origin + targetUrlObj.pathname
        const baseHrefNormalized = baseHref.endsWith('/') ? baseHref.slice(0, -1) : baseHref
        urlToFetch = `${baseHrefNormalized}${path}`
      } catch (err) {
        console.error('Failed to resolve path URL:', err)
      }
    }

    // Append any search parameters to the proxied request
    const searchParams = request.nextUrl.searchParams.toString()
    if (searchParams) {
      urlToFetch += (urlToFetch.includes('?') ? '&' : '?') + searchParams
    }

    // 4. Fetch the target URL
    const fetchHeaders: HeadersInit = {
      'User-Agent': request.headers.get('user-agent') || 'Mozilla/5.0 (compatible; GhostGallery/1.0)',
      'Referer': targetUrl,
    }

    const accept = request.headers.get('accept')
    if (accept) fetchHeaders['Accept'] = accept

    const fetchResponse = await fetch(urlToFetch, {
      headers: fetchHeaders,
      redirect: 'follow',
    })

    if (!fetchResponse.ok) {
      console.warn(`Target responded with ${fetchResponse.status}: ${fetchResponse.statusText}`)
    }

    // Ensure status is valid for NextResponse (200-599)
    const safeStatus = fetchResponse.status >= 200 && fetchResponse.status <= 599 ? fetchResponse.status : (fetchResponse.status > 599 ? 500 : 200)

    const contentType = fetchResponse.headers.get('content-type') || 'text/html'
    const parsedUrl = new URL(urlToFetch)

    // 5. If it's a CSS file, rewrite sub-resources (like url(...) fonts and backgrounds) to go through our proxy
    if (contentType.includes('text/css')) {
      let css = await fetchResponse.text()

      // Rewrite absolute references to the target origin
      const targetOrigin = parsedUrl.origin
      const originEscaped = targetOrigin.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')
      const originRegex = new RegExp(originEscaped, 'g')
      css = css.replace(originRegex, `${request.nextUrl.origin}/api/proxy-site/${token}`)

      // Rewrite root-relative url("/...") references
      css = css.replace(/url\s*\(\s*["']?\/([^\/\s"'][^"'\)]*)["']?\s*\)/g, (match, relPath) => {
        return `url("${request.nextUrl.origin}/api/proxy-site/${token}/${relPath}")`
      })

      // Rewrite relative url("...") references
      css = css.replace(/url\s*\(\s*["']?((?!https?:\/\/|\/|data:)[^"'\)]+)["']?\s*\)/g, (match, relPath) => {
        const currentPath = parsedUrl.pathname
        const dirPath = currentPath.substring(0, currentPath.lastIndexOf('/') + 1)
        const resolvedPath = (dirPath + relPath).replace(/\/+/g, '/')
        return `url("${request.nextUrl.origin}/api/proxy-site/${token}${resolvedPath}")`
      })

      return new NextResponse(css, {
        status: safeStatus,
        headers: {
          'Content-Type': 'text/css; charset=utf-8',
          'Cache-Control': 'public, max-age=3600',
        },
      })
    }

    // 6. If it's an HTML page, rewrite it to proxy assets/links securely
    if (contentType.includes('text/html')) {
      let html = await fetchResponse.text()

      // Rewrite absolute references to the target origin into proxy links to prevent leaking
      const targetOrigin = parsedUrl.origin
      const originEscaped = targetOrigin.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')
      const originRegex = new RegExp(originEscaped, 'g')
      html = html.replace(originRegex, `${request.nextUrl.origin}/api/proxy-site/${token}`)

      // Rewrite case-insensitive and space-tolerant root-relative paths starting with / (but not starting with //)
      // e.g. src = "/_next/..." -> src="/api/proxy-site/TOKEN/_next/..."
      html = html.replace(/(href|src|action|poster)\s*=\s*["']\/([^\/\s"'][^"']*)["']/gi, (match, attr, relPath) => {
        return `${attr}="${request.nextUrl.origin}/api/proxy-site/${token}/${relPath}"`
      })

      // Rewrite case-insensitive and space-tolerant relative paths that do NOT start with / or protocols
      // e.g. src = "logo.png" -> src="/api/proxy-site/TOKEN/logo.png"
      html = html.replace(/(href|src|action|poster)\s*=\s*["']((?!https?:\/\/|\/|mailto:|tel:|javascript:|#|data:)[^"']+)["']/gi, (match, attr, relPath) => {
        const currentPath = parsedUrl.pathname
        const dirPath = currentPath.substring(0, currentPath.lastIndexOf('/') + 1)
        const resolvedPath = (dirPath + relPath).replace(/\/+/g, '/')
        return `${attr}="${request.nextUrl.origin}/api/proxy-site/${token}${resolvedPath}"`
      })

      // Rewrite responsive image srcset attributes (e.g., srcset="/images/logo.png 1x, ...")
      html = html.replace(/(srcset)\s*=\s*["']([^"']+)["']/gi, (match, attr, srcsetVal) => {
        const rewrittenSegments = srcsetVal.split(',').map((segment: string) => {
          const trimmed = segment.trim()
          if (!trimmed) return ''
          const parts = trimmed.split(/\s+/)
          const urlPart = parts[0]
          const descriptorPart = parts.slice(1).join(' ')

          let rewrittenUrl = urlPart
          if (urlPart.startsWith('/')) {
            rewrittenUrl = `${request.nextUrl.origin}/api/proxy-site/${token}${urlPart}`
          } else if (!urlPart.startsWith('http://') && !urlPart.startsWith('https://') && !urlPart.startsWith('data:')) {
            const currentPath = parsedUrl.pathname
            const dirPath = currentPath.substring(0, currentPath.lastIndexOf('/') + 1)
            const resolvedPath = (dirPath + urlPart).replace(/\/+/g, '/')
            rewrittenUrl = `${request.nextUrl.origin}/api/proxy-site/${token}${resolvedPath}`
          } else if (urlPart.startsWith(targetOrigin)) {
            rewrittenUrl = urlPart.replace(targetOrigin, `${request.nextUrl.origin}/api/proxy-site/${token}`)
          }
          return `${rewrittenUrl} ${descriptorPart}`.trim()
        })
        return `${attr}="${rewrittenSegments.join(', ')}"`
      })

      // Rewrite inline styles & CSS blocks url(...) references
      html = html.replace(/url\s*\(\s*["']?\/([^\/\s"'][^"'\)]*)["']?\s*\)/gi, (match, relPath) => {
        return `url("${request.nextUrl.origin}/api/proxy-site/${token}/${relPath}")`
      })
      html = html.replace(/url\s*\(\s*["']?((?!https?:\/\/|\/|data:)[^"'\)]+)["']?\s*\)/gi, (match, relPath) => {
        const currentPath = parsedUrl.pathname
        const dirPath = currentPath.substring(0, currentPath.lastIndexOf('/') + 1)
        const resolvedPath = (dirPath + relPath).replace(/\/+/g, '/')
        return `url("${request.nextUrl.origin}/api/proxy-site/${token}${resolvedPath}")`
      })

      // Return rewritten HTML
      return new NextResponse(html, {
        status: safeStatus,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
        },
      })
    }

    // 7. Otherwise, return the raw assets (JS, Images, Fonts) directly
    const responseHeaders = new Headers()

    responseHeaders.set('Content-Type', contentType)
    responseHeaders.set('Cache-Control', 'public, max-age=3600')

    // Strip security frame constraints & CSP to ensure rendering in iframe
    responseHeaders.delete('X-Frame-Options')
    responseHeaders.delete('Content-Security-Policy')

    // Stream the body directly for high performance and 100% accurate binary preservation
    if (fetchResponse.body) {
      return new NextResponse(fetchResponse.body, {
        status: safeStatus,
        headers: responseHeaders,
      })
    }

    const rawBuffer = await fetchResponse.arrayBuffer()
    return new NextResponse(new Uint8Array(rawBuffer), {
      status: safeStatus,
      headers: responseHeaders,
    })
  } catch (error) {
    console.error('Proxy Error:', error)
    return new NextResponse('Internal server proxy error', { status: 500 })
  }
}
