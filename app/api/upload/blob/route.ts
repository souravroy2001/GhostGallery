import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { NextResponse } from 'next/server'

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        return {
          // Allow larger files in case compression is bypassed (e.g., up to 50MB)
          maximumSizeInBytes: 50 * 1024 * 1024,
          allowedContentTypes: [
            'image/jpeg', 
            'image/png', 
            'image/gif', 
            'image/webp',
            'image/heic',
            'image/heif',
            'application/octet-stream' // Sometimes HEIC or unknown files from iOS get mapped to octet-stream
          ],
          tokenPayload: JSON.stringify({
            // any metadata if needed
          }),
        }
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        console.log('Blob upload completed:', blob.url)
      },
    })

    return NextResponse.json(jsonResponse)
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 }
    )
  }
}
