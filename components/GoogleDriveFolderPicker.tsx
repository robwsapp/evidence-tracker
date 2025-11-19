'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface Folder {
  id: string
  name: string
  modifiedTime: string
  iconLink?: string
}

interface GoogleDriveFolderPickerProps {
  isOpen: boolean
  onClose: () => void
  onSelectFolder: (folder: Folder) => void
  selectedFolderId?: string
}

export default function GoogleDriveFolderPicker({
  isOpen,
  onClose,
  onSelectFolder,
  selectedFolderId,
}: GoogleDriveFolderPickerProps) {
  const [folders, setFolders] = useState<Folder[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [currentPath, setCurrentPath] = useState<{ id: string; name: string }[]>([
    { id: 'root', name: 'My Drive' }
  ])
  const [googleConnected, setGoogleConnected] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      checkGoogleConnection()
      // Get user ID from Supabase session
      const getUserId = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          setUserId(user.id)
        }
      }
      getUserId()
    }
  }, [isOpen])

  useEffect(() => {
    if (isOpen && googleConnected) {
      loadFolders(currentPath[currentPath.length - 1].id)
    }
  }, [currentPath, isOpen, googleConnected])

  const checkGoogleConnection = async () => {
    try {
      const response = await fetch('/api/google/drive/folders?parent=root')
      if (response.status === 401) {
        const data = await response.json()
        if (data.needsOAuth) {
          setGoogleConnected(false)
          setError('Please connect Google Drive first')
        }
      } else if (response.ok) {
        setGoogleConnected(true)
      }
    } catch (err) {
      console.error('Error checking Google connection:', err)
    }
  }

  const loadFolders = async (parentId: string) => {
    setLoading(true)
    setError('')

    try {
      const response = await fetch(`/api/google/drive/folders?parent=${parentId}`)

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to load folders')
      }

      const data = await response.json()
      setFolders(data.folders || [])
    } catch (err: any) {
      setError(err.message || 'Failed to load folders')
    } finally {
      setLoading(false)
    }
  }

  const handleFolderClick = (folder: Folder) => {
    setCurrentPath([...currentPath, { id: folder.id, name: folder.name }])
  }

  const handleBreadcrumbClick = (index: number) => {
    setCurrentPath(currentPath.slice(0, index + 1))
  }

  const handleConnectGoogle = () => {
    if (userId) {
      window.location.href = `/api/google/oauth/start?userId=${userId}`
    } else {
      setError('Could not get user session. Please refresh and try again.')
    }
  }

  const handleSelectCurrentFolder = () => {
    const currentFolder = currentPath[currentPath.length - 1]
    onSelectFolder({ ...currentFolder, modifiedTime: new Date().toISOString() })
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <svg className="w-8 h-8 text-blue-500" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7.71 3.5L1.15 15L4.58 21L11.14 9.5L7.71 3.5M8.29 3.5L11.71 9.5L18.29 9.5L14.86 3.5M8.29 20.5L11.71 14.5L18.29 14.5L14.86 20.5M14.86 3.5L18.29 9.5L21.71 15L18.29 20.5L14.86 14.5L11.43 20.5L7.71 15" />
            </svg>
            <h2 className="text-xl font-bold text-gray-900">Select Google Drive Folder</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {!googleConnected ? (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="text-center">
                <svg className="mx-auto w-16 h-16 text-gray-400 mb-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M7.71 3.5L1.15 15L4.58 21L11.14 9.5L7.71 3.5M8.29 3.5L11.71 9.5L18.29 9.5L14.86 3.5M8.29 20.5L11.71 14.5L18.29 14.5L14.86 20.5M14.86 3.5L18.29 9.5L21.71 15L18.29 20.5L14.86 14.5L11.43 20.5L7.71 15" />
                </svg>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Connect Google Drive</h3>
                <p className="text-sm text-gray-600 mb-4">
                  You need to connect your Google Drive account to upload files.
                </p>
                <button
                  onClick={handleConnectGoogle}
                  className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition font-medium"
                >
                  Connect Google Drive
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Breadcrumb */}
              <div className="px-6 py-3 border-b border-gray-200 bg-gray-50">
                <div className="flex items-center space-x-2 text-sm">
                  {currentPath.map((pathItem, index) => (
                    <div key={pathItem.id} className="flex items-center">
                      {index > 0 && (
                        <svg className="w-4 h-4 text-gray-400 mx-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      )}
                      <button
                        onClick={() => handleBreadcrumbClick(index)}
                        className={`px-2 py-1 rounded hover:bg-gray-200 transition ${
                          index === currentPath.length - 1
                            ? 'text-blue-600 font-medium'
                            : 'text-gray-700'
                        }`}
                      >
                        {pathItem.name}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Folder List */}
              <div className="flex-1 overflow-y-auto p-4">
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent"></div>
                  </div>
                ) : error ? (
                  <div className="text-center py-12">
                    <p className="text-red-600">{error}</p>
                  </div>
                ) : folders.length === 0 ? (
                  <div className="text-center py-12">
                    <svg className="mx-auto w-12 h-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                    <p className="text-gray-600">No folders in this location</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2">
                    {folders.map((folder) => (
                      <button
                        key={folder.id}
                        onClick={() => handleFolderClick(folder)}
                        className="flex items-center px-4 py-3 rounded-lg hover:bg-gray-100 border border-gray-200 hover:border-blue-300 transition text-left"
                      >
                        <svg className="w-6 h-6 text-blue-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                        </svg>
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{folder.name}</p>
                          <p className="text-xs text-gray-500">
                            {new Date(folder.modifiedTime).toLocaleDateString()}
                          </p>
                        </div>
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {googleConnected && (
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between bg-gray-50">
            <div className="text-sm text-gray-600">
              Current folder: <span className="font-medium text-gray-900">{currentPath[currentPath.length - 1].name}</span>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSelectCurrentFolder}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition"
              >
                Select This Folder
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
