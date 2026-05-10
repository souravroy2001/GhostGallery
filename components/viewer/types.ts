export interface GalleryImage {
  id: string
  pathname: string
  filename: string
}

export interface GalleryData {
  id: string
  title: string
  watermarkText: string
  targetUrl: string | null
  images: GalleryImage[]
}
