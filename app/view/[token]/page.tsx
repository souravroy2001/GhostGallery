import { ImageViewer } from '@/components/image-viewer'

interface ViewPageProps {
  params: Promise<{ token: string }>
}

export default async function ViewPage({ params }: ViewPageProps) {
  const { token } = await params

  return <ImageViewer token={token} />
}

export const metadata = {
  title: 'View Shared Photos - Ghost Gallery',
  description: 'Secure photo viewing with time-limited access',
}
