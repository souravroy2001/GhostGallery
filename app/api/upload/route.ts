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

    if (contentType.includes('multipart/form-data') || contentType.startsWith('image/')) {
      let fileBuffer: Buffer;
      let fileType: string;
      let fileName: string;
      const galleryId = request.nextUrl.searchParams.get('galleryId')

      if (!galleryId) {
        return NextResponse.json({ error: 'No gallery ID provided' }, { status: 400 })
      }

      if (contentType.includes('multipart/form-data')) {
        const formData = await request.formData()
        const file = formData.get('file') as File | null

        if (!file) {
          return NextResponse.json({ error: 'No file provided' }, { status: 400 })
        }
        
        fileType = file.type || 'image/jpeg'
        fileName = file.name || 'upload.jpg'
        const arrayBuffer = await file.arrayBuffer()
        fileBuffer = Buffer.from(arrayBuffer)
      } else {
        fileType = contentType
        fileName = request.headers.get('x-file-name') ? decodeURIComponent(request.headers.get('x-file-name')!) : 'upload.jpg'
        const arrayBuffer = await request.arrayBuffer()
        fileBuffer = Buffer.from(arrayBuffer)
      }

      console.log(`Server uploading single file to Vercel Blob for gallery ${galleryId}: ${fileName}`)
      const uniqueId = nanoid()
      const extension = fileName.split('.').pop() || 'jpg'
      const pathname = `galleries/${galleryId}/${uniqueId}.${extension}`

      const sanitizedToken = process.env.BLOB_READ_WRITE_TOKEN.replace(/^["']|["']$/g, '')

      try {
        const blob = await put(pathname, fileBuffer, {
          access: 'private',
          token: sanitizedToken,
          contentType: fileType,
        })
        return NextResponse.json({
          url: blob.url,
          pathname: blob.pathname,
          size: fileBuffer.length,
          contentType: fileType,
          filename: fileName
        })
      } catch (blobError) {
        console.error('Server side Vercel Blob upload error:', blobError)
        return NextResponse.json({ 
          error: 'Failed to upload image to storage',
          details: blobError instanceof Error ? blobError.message : String(blobError)
        }, { status: 500 })
      }
    }

    // JSON Gallery Modes (Init and Finalize)
    const body = await request.json()
    const { action, title, watermarkText, expiryHours, galleryId, images } = body

    const supabase = await createClient()

    if (action === 'init') {
      console.log('Initializing empty gallery in Supabase...');
      const { data: gallery, error: galleryError } = await supabase
        .from('galleries')
        .insert({
          title: title || 'Untitled Gallery',
          watermark_text: watermarkText || 'Confidential',
        })
        .select()
        .single()

      if (galleryError) {
        console.error('Gallery initialization error:', galleryError)
        return NextResponse.json({ error: `Failed to initialize gallery: ${galleryError.message}` }, { status: 500 })
      }

      console.log(`Gallery initialized with ID: ${gallery.id}`);
      return NextResponse.json({ success: true, galleryId: gallery.id })
    }

    if (action === 'add_images') {
      console.log(`Adding images to gallery ${galleryId} with ${images?.length} images`);

      if (!images || images.length === 0) {
        return NextResponse.json({ error: 'No images provided for addition' }, { status: 400 })
      }

      const uploadedImages = []
      for (const image of images) {
        console.log(`Storing image metadata in Supabase: ${image.filename}...`);
        const { data: imageData, error: imageError } = await supabase
          .from('gallery_images')
          .insert({
            gallery_id: galleryId,
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

      return NextResponse.json({
        success: true,
        gallery: {
          id: galleryId,
          addedCount: uploadedImages.length,
        }
      })
    }

    if (action === 'finalize') {
      console.log(`Finalizing gallery ${galleryId} with ${images?.length} images`);

      if (!images || images.length === 0) {
        return NextResponse.json({ error: 'No images provided for finalization' }, { status: 400 })
      }

      // Store image metadata in database using client-provided blob data
      const uploadedImages = []
      for (const image of images) {
        console.log(`Storing image metadata in Supabase: ${image.filename}...`);
        const { data: imageData, error: imageError } = await supabase
          .from('gallery_images')
          .insert({
            gallery_id: galleryId,
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
          gallery_id: galleryId,
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
          gallery_id: galleryId,
          token: shortCode,
          expires_at: expiresAt.toISOString(),
          one_time_use: false,
        })

      if (shortLinkError) {
        console.warn('Short link creation warning:', shortLinkError.message)
      }

      const shareUrl = `${request.nextUrl.origin}/view/${longToken}`
      const shortenedUrl = `${request.nextUrl.origin}/s/${shortCode}`
      console.log(`Gallery finalized successfully. Original: ${shareUrl} | Shortened: ${shortenedUrl}`);

      return NextResponse.json({
        success: true,
        gallery: {
          id: galleryId,
          imageCount: uploadedImages.length,
        },
        shareLink: {
          url: shortenedUrl,
          originalUrl: shareUrl,
          token: longToken,
          expiresAt: expiresAt.toISOString(),
        },
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Unexpected upload error:', error)
    return NextResponse.json({
      error: 'Upload failed due to an unexpected error',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}
