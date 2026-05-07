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

    const formData = await request.formData()
    const files = formData.getAll('files') as File[]
    const title = formData.get('title') as string | null
    const watermarkText = formData.get('watermarkText') as string | null
    const expiryHours = parseInt(formData.get('expiryHours') as string) || 24

    console.log(`Processing ${files.length} files for gallery: ${title}`);

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 })
    }

    // Validate file types
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    for (const file of files) {
      if (!allowedTypes.includes(file.type)) {
        console.warn(`Invalid file type: ${file.type}`);
        return NextResponse.json(
          { error: `Invalid file type: ${file.type}. Only images are allowed.` },
          { status: 400 }
        )
      }
      // Max 10MB per file
      if (file.size > 10 * 1024 * 1024) {
        console.warn(`File too large: ${file.name} (${file.size} bytes)`);
        return NextResponse.json(
          { error: `File ${file.name} is too large. Maximum size is 10MB.` },
          { status: 400 }
        )
      }
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

    // Upload files to Vercel Blob in parallel to prevent 504 Gateway Timeout on Hobby plan
    const uploadPromises = files.map(async (file) => {
      console.log(`Uploading file to Vercel Blob: ${file.name}...`);
      const uniqueId = nanoid()
      const extension = file.name.split('.').pop() || 'jpg'
      const pathname = `galleries/${gallery.id}/${uniqueId}.${extension}`

      try {
        const blob = await put(pathname, file, {
          access: 'private',
        })
        console.log(`File uploaded to Blob: ${blob.url}`);

        // Store image metadata in database
        console.log(`Storing image metadata in Supabase: ${file.name}...`);
        const { data: imageData, error: imageError } = await supabase
          .from('gallery_images')
          .insert({
            gallery_id: gallery.id,
            blob_pathname: blob.pathname,
            original_filename: file.name,
            content_type: file.type,
            size_bytes: file.size,
          })
          .select()
          .single()

        if (imageError) {
          console.error('Image record error:', imageError)
          return null;
        }

        return imageData;
      } catch (blobError) {
        console.error(`Vercel Blob upload error for ${file.name}:`, blobError);
        return null;
      }
    });

    const results = await Promise.all(uploadPromises);
    const uploadedImages = results.filter(img => img !== null);

    if (uploadedImages.length === 0) {
      console.error('No images were successfully uploaded');
      return NextResponse.json({ error: 'Failed to upload any images' }, { status: 500 })
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
