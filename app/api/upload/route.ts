import { put } from '@vercel/blob'
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { nanoid } from 'nanoid'

export async function POST(request: NextRequest) {
  console.log('Upload request received');
  try {
    // Check environment variables
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      console.error('Missing Supabase environment variables');
      return NextResponse.json({ error: 'Server configuration error: Supabase variables missing' }, { status: 500 });
    }
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      console.error('Missing BLOB_READ_WRITE_TOKEN');
      return NextResponse.json({ error: 'Server configuration error: Blob token missing' }, { status: 500 });
    }

    const contentType = request.headers.get('content-type') || ''

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      const file = formData.get('file') as File | null

      if (!file) {
        return NextResponse.json({ error: 'No file provided' }, { status: 400 })
      }

      console.log(`Server uploading single file to Vercel Blob: ${file.name}`)
      const uniqueId = nanoid()
      const extension = file.name.split('.').pop() || 'jpg'
      const pathname = `galleries/temp/${uniqueId}.${extension}`

      const sanitizedToken = process.env.BLOB_READ_WRITE_TOKEN.replace(/^["']|["']$/g, '')

      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      try {
        const blob = await put(pathname, buffer, {
          access: 'private',
          token: sanitizedToken,
          contentType: file.type || 'image/jpeg',
        })
        return NextResponse.json({
          url: blob.url,
          pathname: blob.pathname,
          size: file.size,
          contentType: file.type || 'image/jpeg',
          filename: file.name
        })
      } catch (blobError) {
        console.error('Server side Vercel Blob upload error:', blobError)
        return NextResponse.json({ 
          error: 'Failed to upload image to storage',
          details: blobError instanceof Error ? blobError.message : String(blobError)
        }, { status: 500 })
      }
    }

    // JSON Gallery Creation Mode
    const body = await request.json()
    const { title, watermarkText, expiryHours, images } = body

    console.log(`Processing ${images?.length} files for gallery: ${title}`);

    if (!images || images.length === 0) {
      return NextResponse.json({ error: 'No images provided' }, { status: 400 })
    }

    const supabase = await createClient()

    // Create gallery
    console.log('Creating gallery in Supabase...');
    const { data: gallery, error: galleryError } = await supabase
      .from('galleries')
      .insert({
        title: title || 'Untitled Gallery',
        watermark_text: watermarkText || 'Confidential',
      })
      .select()
      .single()

    if (galleryError) {
      console.error('Gallery creation error:', galleryError)
      return NextResponse.json({ error: `Failed to create gallery: ${galleryError.message}` }, { status: 500 })
    }
    console.log(`Gallery created with ID: ${gallery.id}`);

    // Store image metadata in database using client-provided blob data
    const uploadedImages = []
    for (const image of images) {
      console.log(`Storing image metadata in Supabase: ${image.filename}...`);
      const { data: imageData, error: imageError } = await supabase
        .from('gallery_images')
        .insert({
          gallery_id: gallery.id,
          blob_pathname: image.pathname,
          original_filename: image.filename,
          content_type: image.contentType,
          size_bytes: image.size,
        })
        .select()
        .single()

      if (imageError) {
        console.error('Image record error:', imageError)
        continue
      }
      uploadedImages.push(imageData)
    }

    if (uploadedImages.length === 0) {
      console.error('No images were successfully stored');
      return NextResponse.json({ error: 'Failed to store image metadata' }, { status: 500 })
    }

    // Create share link with long token
    console.log('Creating long secure share link...');
    const longToken = nanoid(32)
    const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000)

    const { data: shareLink, error: shareLinkError } = await supabase
      .from('share_links')
      .insert({
        gallery_id: gallery.id,
        token: longToken,
        expires_at: expiresAt.toISOString(),
        one_time_use: true,
      })
      .select()
      .single()

    if (shareLinkError) {
      console.error('Share link error:', shareLinkError)
      return NextResponse.json({ error: `Failed to create share link: ${shareLinkError.message}` }, { status: 500 })
    }

    // Create short redirect link with 6-char code
    console.log('Creating short redirect link...');
    const shortCode = nanoid(6)
    const { error: shortLinkError } = await supabase
      .from('share_links')
      .insert({
        gallery_id: gallery.id,
        token: shortCode,
        expires_at: expiresAt.toISOString(),
        one_time_use: false, // short redirect code remains valid until parent link expires
      })

    if (shortLinkError) {
      console.warn('Short link creation warning:', shortLinkError.message)
    }

    const shareUrl = `${request.nextUrl.origin}/view/${longToken}`
    const shortenedUrl = `${request.nextUrl.origin}/s/${shortCode}`
    console.log(`Upload complete. Original: ${shareUrl} | Shortened: ${shortenedUrl}`);

    return NextResponse.json({
      success: true,
      gallery: {
        id: gallery.id,
        title: gallery.title,
        imageCount: uploadedImages.length,
      },
      shareLink: {
        url: shortenedUrl,
        originalUrl: shareUrl,
        token: longToken,
        expiresAt: expiresAt.toISOString(),
      },
    })
  } catch (error) {
    console.error('Unexpected upload error:', error)
    return NextResponse.json({
      error: 'Upload failed due to an unexpected error',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}
