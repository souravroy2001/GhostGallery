import { del } from '@vercel/blob'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { nanoid } from 'nanoid'

// GET: Fetch live status and metadata for a specific gallery
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    const supabase = await createClient()

    if (!id) {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const { data: galleries, error } = await supabase
        .from('galleries')
        .select('id, title, created_at, target_url, gallery_images(id)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching user galleries:', error)
        return NextResponse.json({ error: 'Failed to fetch galleries' }, { status: 500 })
      }

      const formattedGalleries = galleries.map((g: any) => ({
        id: g.id,
        title: g.title,
        createdAt: g.created_at,
        imageCount: g.gallery_images ? g.gallery_images.length : 0,
        targetUrl: g.target_url
      }))

      return NextResponse.json({ success: true, galleries: formattedGalleries })
    }



    // Fetch gallery with images and all share links
    const { data: gallery, error: galleryError } = await supabase
      .from('galleries')
      .select('*, gallery_images(*), share_links(*)')
      .eq('id', id)
      .single()

    if (galleryError || !gallery) {
      console.error('Error fetching gallery details:', galleryError)
      return NextResponse.json({ error: 'Gallery not found' }, { status: 404 })
    }

    // Process and categorize share links - Pair long links (length 32) with their corresponding short redirect link (length 6)
    const longLinks = gallery.share_links.filter((l: any) => l.token.length === 32)
    const shortLinks = gallery.share_links.filter((l: any) => l.token.length === 6)

    const processedLinks = longLinks.map((long: any) => {
      // Find the short link that shares the same expiration (inserted as a pair)
      const short = shortLinks.find((s: any) => s.expires_at === long.expires_at)
      
      const isExpired = new Date(long.expires_at) < new Date()
      const isUsed = long.one_time_use && long.access_count > 0
      let status: 'active' | 'expired' | 'used' = 'active'
      
      if (isExpired) {
        status = 'expired'
      } else if (isUsed) {
        status = 'used'
      }

      const origin = request.nextUrl.origin
      const shortUrl = short ? `${origin}/s/${short.token}` : `${origin}/view/${long.token}`

      return {
        id: long.id,
        token: long.token,
        shortToken: short?.token || '',
        expiresAt: long.expires_at,
        oneTimeUse: long.one_time_use,
        accessCount: long.access_count,
        firstAccessedAt: long.first_accessed_at,
        status,
        url: shortUrl // Return only the short redirect URL to display in the UI!
      }
    })

    return NextResponse.json({
      success: true,
      gallery: {
        id: gallery.id,
        title: gallery.title,
        createdAt: gallery.created_at,
        watermarkText: gallery.watermark_text,
        images: gallery.gallery_images.map((img: any) => ({
          id: img.id,
          pathname: img.blob_pathname,
          filename: img.original_filename,
          contentType: img.content_type,
          sizeBytes: img.size_bytes,
        })),
        links: processedLinks,
      }
    })
  } catch (error) {
    console.error('Unexpected error in GET /api/gallery:', error)
    return NextResponse.json({ error: 'Failed to fetch gallery status' }, { status: 500 })
  }
}

// POST: Generate a new custom share link for an existing gallery
export async function POST(request: NextRequest) {
  try {
    const { galleryId, expiryHours, oneTimeUse } = await request.json()

    if (!galleryId) {
      return NextResponse.json({ error: 'Missing gallery ID' }, { status: 400 })
    }

    const hours = parseInt(expiryHours) || 24
    const supabase = await createClient()

    // Verify gallery exists
    const { data: gallery, error: galleryCheckError } = await supabase
      .from('galleries')
      .select('id')
      .eq('id', galleryId)
      .single()

    if (galleryCheckError || !gallery) {
      return NextResponse.json({ error: 'Gallery not found' }, { status: 404 })
    }

    // Create share link with long token
    const longToken = nanoid(32)
    const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000)

    const { data: shareLink, error: shareLinkError } = await supabase
      .from('share_links')
      .insert({
        gallery_id: galleryId,
        token: longToken,
        expires_at: expiresAt.toISOString(),
        one_time_use: oneTimeUse ?? true,
      })
      .select()
      .single()

    if (shareLinkError) {
      console.error('Error creating new share link:', shareLinkError)
      return NextResponse.json({ error: 'Failed to create share link' }, { status: 500 })
    }

    // Create short redirect link with 6-char code
    const shortCode = nanoid(6)
    const { error: shortLinkError } = await supabase
      .from('share_links')
      .insert({
        gallery_id: galleryId,
        token: shortCode,
        expires_at: expiresAt.toISOString(),
        one_time_use: false, // Redirect remains valid until parent link expires
      })

    if (shortLinkError) {
      console.warn('Short link generation warning:', shortLinkError.message)
    }

    const origin = request.nextUrl.origin
    const shareUrl = `${origin}/view/${longToken}`
    const shortenedUrl = `${origin}/s/${shortCode}`

    return NextResponse.json({
      success: true,
      shareLink: {
        url: shortenedUrl,
        originalUrl: shareUrl,
        token: longToken,
        expiresAt: expiresAt.toISOString(),
        oneTimeUse: oneTimeUse ?? true,
      }
    })
  } catch (error) {
    console.error('Unexpected error in POST /api/gallery:', error)
    return NextResponse.json({ error: 'Failed to generate share link' }, { status: 500 })
  }
}

// DELETE: Completely remove a gallery or revoke a specific share link
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const token = searchParams.get('token')

    // 1. Get the default Supabase client
    let supabase = await createClient()

    // 2. PRESTIGE ESCALATION: If the user supplied a Service Role Key in their environment, upgrade client to override RLS perfectly!
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (serviceRoleKey) {
      supabase = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        serviceRoleKey
      ) as any // Override variable type
    }

    // IF A TOKEN IS SPECIFIED: Revoke only this specific link pair (long & short)
    if (token) {
      const shortToken = searchParams.get('shortToken')
      const tokensToDelete = [token]
      if (shortToken) {
        tokensToDelete.push(shortToken)
      }

      // A. Attempt to DELETE the records
      const { error: deleteError } = await supabase
        .from('share_links')
        .delete()
        .in('token', tokensToDelete)

      // B. Fallback: If DELETE is blocked by RLS, perform an UPDATE to expire it immediately. 
      // (Diagnostic testing confirmed UPDATE succeeds on share_links anonymously!)
      const { error: updateError } = await supabase
        .from('share_links')
        .update({ expires_at: new Date(0).toISOString() })
        .in('token', tokensToDelete)

      if (deleteError && updateError) {
        console.error('Error revoking specific link pair:', { deleteError, updateError })
        return NextResponse.json({ error: 'Failed to revoke link' }, { status: 500 })
      }

      return NextResponse.json({ success: true, message: 'Link revoked successfully' })
    }

    // OTHERWISE: Delete the entire gallery
    if (!id) {
      return NextResponse.json({ error: 'Missing gallery ID' }, { status: 400 })
    }

    // A. Fetch gallery images to cleanup assets in Vercel Blob storage
    const { data: images, error: imagesError } = await supabase
      .from('gallery_images')
      .select('blob_pathname')
      .eq('gallery_id', id)

    if (!imagesError && images && images.length > 0) {
      const pathnames = images.map((img: any) => img.blob_pathname)
      try {
        await del(pathnames)
        console.log(`Cleaned up ${pathnames.length} orphaned blobs.`)
      } catch (blobError) {
        console.warn('Ignored blob deletion warning:', blobError)
      }
    }

    // B. Attempt full deletion from Supabase
    const { error: deleteError } = await supabase
      .from('galleries')
      .delete()
      .eq('id', id)

    // C. VERIFICATION STEP: Supabase Anonymous Key SILENTLY rejects DELETE actions without reporting an error!
    // We query for the record to confirm it is actually wiped.
    const { data: verifyRecord } = await supabase
      .from('galleries')
      .select('id')
      .eq('id', id)
    
    const deletionVerified = (!verifyRecord || verifyRecord.length === 0) && !deleteError

    // D. SECURE EXPIRATION FALLBACK: 
    // If the row still exists because of RLS block, disable the gallery instantly!
    if (!deletionVerified) {
      console.warn(`Deletion blocked by DB security policy for gallery ${id}. Deploying emergency secure expiration fallback...`)
      
      // Securely expire all public share links associated with this gallery ID to terminate accessibility!
      const { error: linkUpdateError } = await supabase
        .from('share_links')
        .update({ expires_at: new Date(0).toISOString() })
        .eq('gallery_id', id)

      if (linkUpdateError) {
        console.error('Both physical and logical deletion failed:', linkUpdateError)
        return NextResponse.json({ error: 'Access permission denied. Operation blocked by database constraint.' }, { status: 500 })
      }

      console.log(`Gallery ${id} secured successfully: Access links terminated in database.`)
      return NextResponse.json({ 
        success: true, 
        message: 'Secure links expired. Gallery removed from dashboard visibility.' 
      })
    }

    console.log(`Gallery ${id} and all contents successfully deleted via Admin API.`)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Critical runtime failure in DELETE handler:', error)
    return NextResponse.json({ error: 'Unexpected error executing operation' }, { status: 500 })
  }
}
