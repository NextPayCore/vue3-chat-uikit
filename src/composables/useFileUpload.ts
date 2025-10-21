import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useApi } from './useApi'

export interface UploadedFileInfo {
  id: string
  url: string
  filename: string
  originalName: string
  size: number
  mimeType: string
  type: 'image' | 'video' | 'audio' | 'document' | 'file'
}

export interface UploadProgress {
  fileId: string
  filename: string
  progress: number
  status: 'pending' | 'uploading' | 'success' | 'error'
  error?: string
}

export interface SupportedFileTypes {
  images: string[]
  videos: string[]
  audios: string[]
  documents: string[]
}

const uploadProgressMap = ref<Map<string, UploadProgress>>(new Map())
const isUploading = ref(false)

export function useFileUpload() {
  const api = useApi()

  // Get supported file types from server
  const getSupportedTypes = async (): Promise<SupportedFileTypes | null> => {
    try {
      const data = await api.get<SupportedFileTypes>('/api/upload/supported-types')
      return data
    } catch (error: any) {
      console.error('Failed to get supported types:', error)
      return null
    }
  }

  // Determine file category based on MIME type
  const getFileCategory = (mimeType: string): 'image' | 'video' | 'audio' | 'document' | 'file' => {
    if (mimeType.startsWith('image/')) return 'image'
    if (mimeType.startsWith('video/')) return 'video'
    if (mimeType.startsWith('audio/')) return 'audio'
    if (
      mimeType.includes('pdf') ||
      mimeType.includes('document') ||
      mimeType.includes('word') ||
      mimeType.includes('excel') ||
      mimeType.includes('spreadsheet') ||
      mimeType.includes('text')
    ) {
      return 'document'
    }
    return 'file'
  }

  // Get upload endpoint based on file type
  const getUploadEndpoint = (category: string): string => {
    const endpoints: Record<string, string> = {
      image: '/api/upload/image',
      video: '/api/upload/video',
      audio: '/api/upload/audio',
      document: '/api/upload/document',
      file: '/api/upload/file'
    }
    return endpoints[category] || '/api/upload/file'
  }

  // Upload a single file with progress tracking
  const uploadFile = async (
    file: File,
    options: {
      onProgress?: (progress: number) => void
      category?: 'image' | 'video' | 'audio' | 'document' | 'file'
    } = {}
  ): Promise<UploadedFileInfo> => {
    const fileId = `${Date.now()}-${Math.random().toString(36).substring(7)}`
    const category = options.category || getFileCategory(file.type)
    const endpoint = getUploadEndpoint(category)

    // Initialize progress tracking
    uploadProgressMap.value.set(fileId, {
      fileId,
      filename: file.name,
      progress: 0,
      status: 'pending'
    })

    try {
      isUploading.value = true

      // Update status to uploading
      const progressData = uploadProgressMap.value.get(fileId)!
      progressData.status = 'uploading'

      // Create form data
      const formData = new FormData()
      formData.append('file', file)

      // Get auth token
      const token = localStorage.getItem('accessToken')
      const headers: Record<string, string> = {}
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      // Upload with XMLHttpRequest to track progress
      const uploadPromise = new Promise<UploadedFileInfo>((resolve, reject) => {
        const xhr = new XMLHttpRequest()

        // Track upload progress
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const progress = Math.round((e.loaded / e.total) * 100)
            progressData.progress = progress

            if (options.onProgress) {
              options.onProgress(progress)
            }
          }
        })

        // Handle completion
        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const response = JSON.parse(xhr.responseText)

              // Update progress
              progressData.status = 'success'
              progressData.progress = 100

              // Create UploadedFileInfo
              const uploadedFile: UploadedFileInfo = {
                id: fileId,
                url: response.url || response.fileUrl,
                filename: response.filename || response.fileName,
                originalName: file.name,
                size: response.size || file.size,
                mimeType: response.mimeType || file.type,
                type: category
              }

              resolve(uploadedFile)
            } catch (error) {
              reject(new Error('Failed to parse response'))
            }
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`))
          }
        })

        // Handle errors
        xhr.addEventListener('error', () => {
          reject(new Error('Network error during upload'))
        })

        xhr.addEventListener('abort', () => {
          reject(new Error('Upload cancelled'))
        })

        // Open connection and send
        const baseUrl = import.meta.env.VITE_API_BASE_URL || ''
        xhr.open('POST', `${baseUrl}${endpoint}`)

        // Set headers
        Object.entries(headers).forEach(([key, value]) => {
          xhr.setRequestHeader(key, value)
        })

        xhr.send(formData)
      })

      const result = await uploadPromise

      ElMessage.success(`${file.name} uploaded successfully`)
      return result

    } catch (error: any) {
      // Update progress with error
      const progressData = uploadProgressMap.value.get(fileId)
      if (progressData) {
        progressData.status = 'error'
        progressData.error = error.message
      }

      console.error('File upload error:', error)
      ElMessage.error(`Failed to upload ${file.name}: ${error.message}`)
      throw error
    } finally {
      isUploading.value = false

      // Clean up progress after delay
      setTimeout(() => {
        uploadProgressMap.value.delete(fileId)
      }, 3000)
    }
  }

  // Upload multiple files
  const uploadFiles = async (
    files: File[],
    options: {
      onProgress?: (fileId: string, progress: number) => void
      onFileComplete?: (file: UploadedFileInfo) => void
      category?: 'image' | 'video' | 'audio' | 'document' | 'file'
    } = {}
  ): Promise<UploadedFileInfo[]> => {
    const results: UploadedFileInfo[] = []

    for (const file of files) {
      try {
        const uploadedFile = await uploadFile(file, {
          category: options.category,
          onProgress: (progress) => {
            if (options.onProgress) {
              // We would need to track fileId mapping here
              options.onProgress(file.name, progress)
            }
          }
        })

        results.push(uploadedFile)

        if (options.onFileComplete) {
          options.onFileComplete(uploadedFile)
        }
      } catch (error) {
        console.error(`Failed to upload ${file.name}:`, error)
        // Continue with other files
      }
    }

    return results
  }

  // Get upload progress for a specific file
  const getUploadProgress = (fileId: string): UploadProgress | undefined => {
    return uploadProgressMap.value.get(fileId)
  }

  // Get all upload progress
  const getAllUploadProgress = (): UploadProgress[] => {
    return Array.from(uploadProgressMap.value.values())
  }

  // Cancel upload (if implemented)
  const cancelUpload = (fileId: string) => {
    const progressData = uploadProgressMap.value.get(fileId)
    if (progressData) {
      progressData.status = 'error'
      progressData.error = 'Cancelled by user'
      uploadProgressMap.value.delete(fileId)
    }
  }

  // Validate file before upload
  const validateFile = (
    file: File,
    options: {
      maxSize?: number // in MB
      allowedTypes?: string[]
    } = {}
  ): { valid: boolean; error?: string } => {
    const maxSize = options.maxSize || 100 // 100MB default
    const fileSizeMB = file.size / (1024 * 1024)

    if (fileSizeMB > maxSize) {
      return {
        valid: false,
        error: `File size (${fileSizeMB.toFixed(2)}MB) exceeds maximum allowed size (${maxSize}MB)`
      }
    }

    if (options.allowedTypes && options.allowedTypes.length > 0) {
      const fileExt = file.name.split('.').pop()?.toLowerCase()
      const isTypeAllowed = options.allowedTypes.some(type => {
        if (type.includes('/')) {
          // MIME type check
          return file.type === type || file.type.startsWith(type.split('/')[0] + '/')
        } else {
          // Extension check
          return fileExt === type.toLowerCase()
        }
      })

      if (!isTypeAllowed) {
        return {
          valid: false,
          error: `File type not allowed. Allowed types: ${options.allowedTypes.join(', ')}`
        }
      }
    }

    return { valid: true }
  }

  return {
    // State
    uploadProgressMap,
    isUploading,

    // Methods
    getSupportedTypes,
    uploadFile,
    uploadFiles,
    getUploadProgress,
    getAllUploadProgress,
    cancelUpload,
    validateFile,
    getFileCategory
  }
}
