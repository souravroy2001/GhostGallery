import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params
    console.log(`Redirecting short code: ${code}`);

    const supabase = await createClient()

    // Find the short link record
    const { data: shortLink, error: shortLinkError } = await supabase
      .from('share_links')
      .select('gallery_id, expires_at')
      .eq('token', code)
      .single()

    if (shortLinkError || !shortLink) {
      console.error(`Short code not found: ${code}`, shortLinkError);
      return NextResponse.redirect(new URL('/', request.nextUrl.origin))
    }

    // Find the long link record (32 chars) for the same gallery with the exact paired expiration
    const { data: longLinks, error: longLinkError } = await supabase
      .from('share_links')
      .select('token')
      .eq('gallery_id', shortLink.gallery_id)
      .eq('expires_at', shortLink.expires_at)

    if (longLinkError || !longLinks || longLinks.length === 0) {
      console.error(`Long token not found for gallery: ${shortLink.gallery_id}`);
      return NextResponse.redirect(new URL('/', request.nextUrl.origin))
    }

    // Find the token with length 32
    const longLink = longLinks.find(link => link.token.length === 32)
    if (!longLink) {
      console.error(`No 32-character token found for gallery: ${shortLink.gallery_id}`);
      return NextResponse.redirect(new URL('/', request.nextUrl.origin))
    }

    // Perform direct, immediate 302 redirection to the secure viewer, forwarding any query params (e.g. preview=true)
    const destinationUrl = new URL(`/view/${longLink.token}`, request.nextUrl.origin)
    destinationUrl.search = request.nextUrl.search
    console.log(`Redirecting directly to secure viewer: ${destinationUrl.toString()}`);
    return NextResponse.redirect(destinationUrl)
  } catch (err) {
    console.error('Built-in shortener redirect error:', err);
    return NextResponse.redirect(new URL('/', request.nextUrl.origin))
  }
}
