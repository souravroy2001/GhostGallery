'use client'

import { useState, useCallback } from 'react'
import { Upload, X, ImageIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FileWithPreview extends File {
  preview: string
}

interface DropzoneProps {
  files: FileWithPreview[]
  setFiles: (files: FileWithPreview[]) => void
  maxFiles?: number
  maxSizeBytes?: number
}

export function Dropzone({ files, setFiles, maxFiles = 50, maxSizeBytes = 10 * 1024 * 1024 }: DropzoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const validateFiles = useCallback((newFiles: File[]): FileWithPreview[] => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    const validFiles: FileWithPreview[] = []

    for (const file of newFiles) {
      if (!allowedTypes.includes(file.type)) {
        setError(`${file.name}: Invalid file type. Only images are allowed.`)
        continue
      }
      if (file.size > maxSizeBytes) {
        setError(`${file.name}: File too large. Maximum size is ${Math.round(maxSizeBytes / 1024 / 1024)}MB.`)
        continue
      }
      const fileWithPreview = Object.assign(file, {
        preview: URL.createObjectURL(file),
      }) as FileWithPreview
      validFiles.push(fileWithPreview)
    }

    return validFiles
  }, [maxSizeBytes])

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    setError(null)

    const droppedFiles = Array.from(e.dataTransfer.files)
    const validFiles = validateFiles(droppedFiles)
    
    const totalFiles = files.length + validFiles.length
    if (totalFiles > maxFiles) {
      setError(`Maximum ${maxFiles} files allowed.`)
      return
    }

    setFiles([...files, ...validFiles])
  }, [files, setFiles, validateFiles, maxFiles])

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null)
    const selectedFiles = e.target.files ? Array.from(e.target.files) : []
    const validFiles = validateFiles(selectedFiles)
    
    const totalFiles = files.length + validFiles.length
    if (totalFiles > maxFiles) {
      setError(`Maximum ${maxFiles} files allowed.`)
      return
    }

    setFiles([...files, ...validFiles])
    e.target.value = ''
  }, [files, setFiles, validateFiles, maxFiles])

  const removeFile = useCallback((index: number) => {
    URL.revokeObjectURL(files[index].preview)
    setFiles(files.filter((_, i) => i !== index))
  }, [files, setFiles])

  return (
    <div className="space-y-4">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={cn(
          'relative rounded-lg border-2 border-dashed p-8 transition-colors',
          isDragging 
            ? 'border-primary bg-primary/5' 
            : 'border-muted-foreground/25 hover:border-muted-foreground/50',
        )}
      >
        <input
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          multiple
          onChange={handleFileSelect}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
        <div className="flex flex-col items-center justify-center gap-3 text-center">
          <div className="rounded-full bg-muted p-4">
            <Upload className="size-6 text-muted-foreground" />
          </div>
          <div>
            <p className="font-medium">Drop images here or click to browse</p>
            <p className="text-sm text-muted-foreground">
              JPEG, PNG, GIF, WebP up to 10MB each
            </p>
          </div>
        </div>
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {files.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">{files.length} file{files.length !== 1 ? 's' : ''} selected</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {files.map((file, index) => (
              <div
                key={`${file.name}-${index}`}
                className="group relative aspect-square overflow-hidden rounded-lg border bg-muted"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={file.preview}
                  alt={file.name}
                  className="size-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeFile(index)}
                  className="absolute right-1 top-1 rounded-full bg-background/80 p-1 opacity-0 transition-opacity hover:bg-background group-hover:opacity-100"
                >
                  <X className="size-4" />
                  <span className="sr-only">Remove {file.name}</span>
                </button>
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                  <p className="truncate text-xs text-white">{file.name}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {files.length === 0 && (
        <div className="flex items-center justify-center gap-2 rounded-lg border bg-muted/50 p-4">
          <ImageIcon className="size-5 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No images selected yet</p>
        </div>
      )}
    </div>
  )
}
