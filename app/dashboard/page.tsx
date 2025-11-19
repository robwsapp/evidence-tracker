'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import GoogleDriveFolderPicker from '@/components/GoogleDriveFolderPicker'

export const dynamic = 'force-dynamic'

interface MyCaseClient {
  id: number
  name: string
  case_number: string
}

interface UploadFile {
  file: File
  customName: string
  originalName: string
}

interface GoogleDriveFolder {
  id: string
  name: string
  modifiedTime: string
}

const EVIDENCE_TYPES = [
  'Birth Certificate',
  'Passport',
  'Photos',
  'Tax Returns',
  'Affidavits',
  'Marriage Certificate',
  'I-94',
  'Employment Letter',
  'Bank Statements',
  'Other'
]

const SOURCES = [
  'Mail',
  'Email',
  'In-Person',
  'Courier',
  'Fax'
]

export default function Dashboard() {
  const router = useRouter()
  const [userEmail, setUserEmail] = useState('')
  const [userId, setUserId] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  // Form state
  const [selectedClient, setSelectedClient] = useState<MyCaseClient | null>(null)
  const [mycaseClients, setMycaseClients] = useState<MyCaseClient[]>([])
  const [loadingClients, setLoadingClients] = useState(false)
  const [clientSearch, setClientSearch] = useState('')
  const [dateReceived, setDateReceived] = useState(new Date().toISOString().split('T')[0])
  const [numPieces, setNumPieces] = useState(1)
  const [evidenceType, setEvidenceType] = useState('Birth Certificate')
  const [customEvidenceType, setCustomEvidenceType] = useState('')
  const [source, setSource] = useState('Mail')
  const [notes, setNotes] = useState('')
  const [files, setFiles] = useState<UploadFile[]>([])

  // Cache for all cases (used for case number search)
  const [allCasesCache, setAllCasesCache] = useState<MyCaseClient[]>([])
  const [cacheLoaded, setCacheLoaded] = useState(false)

  // Google Drive state
  const [showFolderPicker, setShowFolderPicker] = useState(false)
  const [selectedFolder, setSelectedFolder] = useState<GoogleDriveFolder | null>(null)

  useEffect(() => {
    checkUser()
  }, [])

  // Helper to detect if query looks like a case number
  const isCaseNumberQuery = (query: string): boolean => {
    // Contains numbers, dashes, or common case patterns
    return /[\d-]/.test(query) || /^[A-Z]\d/.test(query)
  }

  // Debounced search effect
  useEffect(() => {
    // Don't search if query is empty
    if (!clientSearch || clientSearch.trim().length === 0) {
      setMycaseClients([])
      return
    }

    // Debounce search by 500ms
    const timeoutId = setTimeout(() => {
      const query = clientSearch.trim()

      // Detect search type
      if (isCaseNumberQuery(query)) {
        // Case number search - load all cases and search client-side
        searchByCaseNumber(query)
      } else {
        // Name search - use fast API endpoint
        searchByClientName(query)
      }
    }, 500)

    return () => clearTimeout(timeoutId)
  }, [clientSearch])

  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      router.push('/login')
      return
    }

    setUserEmail(session.user.email || '')
    setUserId(session.user.id)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  // Search by client name using fast API endpoint
  const searchByClientName = async (query: string) => {
    setLoadingClients(true)
    setError('')

    try {
      const response = await fetch(`/api/mycase/search-clients?query=${encodeURIComponent(query)}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to search clients')
      }

      // Fuzzy match: filter results to include query anywhere in name (case insensitive)
      const fuzzyResults = data.clients.filter((client: MyCaseClient) =>
        client.name.toLowerCase().includes(query.toLowerCase())
      )

      setMycaseClients(fuzzyResults)
    } catch (err: any) {
      setError(err.message || 'Failed to search MyCase clients')
      setMycaseClients([])
    } finally {
      setLoadingClients(false)
    }
  }

  // Search by case number - loads all cases and searches client-side
  const searchByCaseNumber = async (query: string) => {
    setLoadingClients(true)
    setError('')

    try {
      // Load all cases if not cached
      if (!cacheLoaded) {
        console.log('[Search] Loading all cases for case number search...')
        const response = await fetch('/api/mycase/clients')
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Failed to load cases')
        }

        setAllCasesCache(data.clients)
        setCacheLoaded(true)

        // Search in the newly loaded cache
        const results = data.clients.filter((client: MyCaseClient) =>
          client.case_number.toLowerCase().includes(query.toLowerCase())
        )
        setMycaseClients(results)
      } else {
        // Search in cached cases
        console.log('[Search] Searching cached cases...')
        const results = allCasesCache.filter((client: MyCaseClient) =>
          client.case_number.toLowerCase().includes(query.toLowerCase())
        )
        setMycaseClients(results)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to search by case number')
      setMycaseClients([])
    } finally {
      setLoadingClients(false)
    }
  }

  const fetchMyCaseClients = async () => {
    // Trigger search with current query
    if (clientSearch && clientSearch.trim().length > 0) {
      const query = clientSearch.trim()
      if (isCaseNumberQuery(query)) {
        await searchByCaseNumber(query)
      } else {
        await searchByClientName(query)
      }
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return

    const selectedFiles = Array.from(e.target.files)
    const date = dateReceived.replace(/-/g, '')

    const uploadFiles: UploadFile[] = selectedFiles.map((file) => {
      const fileExt = file.name.split('.').pop()
      const type = evidenceType === 'Other' ? customEvidenceType : evidenceType
      const suggestedName = selectedClient
        ? `${selectedClient.name.replace(/\s+/g, '-')}-${selectedClient.case_number}-${type.replace(/\s+/g, '-')}-${date}.${fileExt}`
        : `Evidence-${type.replace(/\s+/g, '-')}-${date}.${fileExt}`

      return {
        file,
        customName: suggestedName,
        originalName: file.name
      }
    })

    setFiles(prevFiles => [...prevFiles, ...uploadFiles])
  }

  const updateFileName = (index: number, newName: string) => {
    setFiles(prevFiles => {
      const updated = [...prevFiles]
      updated[index].customName = newName
      return updated
    })
  }

  const removeFile = (index: number) => {
    setFiles(prevFiles => prevFiles.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      if (!selectedClient) {
        throw new Error('Please select a client')
      }

      if (!selectedFolder) {
        throw new Error('Please select a Google Drive folder')
      }

      if (files.length === 0) {
        throw new Error('Please upload at least one file')
      }

      const finalEvidenceType = evidenceType === 'Other' ? customEvidenceType : evidenceType

      // Create evidence log in database
      const { data: logData, error: logError } = await supabase
        .from('evidence_logs')
        .insert({
          client_name: selectedClient.name,
          case_number: selectedClient.case_number,
          date_received: dateReceived,
          num_pieces: numPieces,
          evidence_type: finalEvidenceType,
          source,
          notes: notes || null,
          staff_email: userEmail,
          mycase_client_id: selectedClient.id.toString()
        })
        .select()
        .single()

      if (logError) throw logError

      // Upload files to Google Drive
      const uploadedFiles = []

      for (const uploadFile of files) {
        console.log(`Uploading ${uploadFile.customName} to Google Drive folder ${selectedFolder.name}...`)

        const formData = new FormData()
        formData.append('file', uploadFile.file)
        formData.append('folderId', selectedFolder.id)
        formData.append('fileName', uploadFile.customName)
        formData.append('userId', userId)

        const uploadResponse = await fetch('/api/google/drive/upload', {
          method: 'POST',
          body: formData,
        })

        if (!uploadResponse.ok) {
          const errorData = await uploadResponse.json()
          throw new Error(errorData.error || 'Failed to upload file to Google Drive')
        }

        const uploadResult = await uploadResponse.json()
        uploadedFiles.push(uploadResult.file)

        // Save file record to database (with Google Drive file ID and link)
        const { error: fileError } = await supabase
          .from('evidence_files')
          .insert({
            evidence_log_id: logData.id,
            file_name: uploadFile.customName,
            file_path: uploadResult.file.webViewLink || '',
            file_size: uploadFile.file.size,
            original_name: uploadFile.originalName
          })

        if (fileError) {
          console.error('Failed to save file record:', fileError)
          // Don't throw error - file was uploaded successfully to Drive
        }
      }

      setSuccess(`Evidence logged successfully! ${uploadedFiles.length} file(s) uploaded to ${selectedFolder.name}`)

      // Reset form
      setSelectedClient(null)
      setSelectedFolder(null)
      setDateReceived(new Date().toISOString().split('T')[0])
      setNumPieces(1)
      setEvidenceType('Birth Certificate')
      setCustomEvidenceType('')
      setSource('Mail')
      setNotes('')
      setFiles([])

      // Auto-dismiss success message
      setTimeout(() => setSuccess(''), 5000)

    } catch (err: any) {
      setError(err.message || 'Failed to log evidence')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-xl flex items-center justify-center shadow-md">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Evidence Tracker</h1>
                <p className="text-xs text-gray-600">Elizabeth Rosario Law</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-700">{userEmail}</span>
              <button
                onClick={() => router.push('/admin')}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition"
              >
                Admin
              </button>
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-xl hover:bg-red-700 transition"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Success/Error Messages */}
        {success && (
          <div className="mb-6 rounded-xl bg-green-50 border border-green-200 p-4">
            <p className="text-sm text-green-800 font-medium">{success}</p>
          </div>
        )}

        {error && (
          <div className="mb-6 rounded-xl bg-red-50 border border-red-200 p-4">
            <p className="text-sm text-red-800 font-medium">{error}</p>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-xl">
          <div className="border-b border-gray-200 px-6 py-5">
            <h2 className="text-xl font-bold text-gray-900">Log New Evidence</h2>
            <p className="text-sm text-gray-600 mt-1">Record evidence received from clients</p>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Client Selection */}
            <div className="bg-emerald-50 rounded-xl p-5 border border-emerald-200">
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium text-gray-700">
                  Select Client from MyCase
                </label>
                <button
                  type="button"
                  onClick={fetchMyCaseClients}
                  disabled={loadingClients}
                  className="px-3 py-1 text-xs font-medium text-emerald-700 bg-emerald-100 hover:bg-emerald-200 rounded-lg transition disabled:opacity-50"
                >
                  {loadingClients ? 'Refreshing...' : 'Refresh'}
                </button>
              </div>

              {!selectedClient ? (
                <div className="space-y-3">
                  <div>
                    <input
                      type="text"
                      placeholder="Search by name (maria) or case number (E20-043)..."
                      value={clientSearch}
                      onChange={(e) => setClientSearch(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                    {clientSearch.trim().length > 0 && (
                      <p className="mt-1 text-xs text-gray-500">
                        {isCaseNumberQuery(clientSearch) ? (
                          <>🔍 Searching by case number...</>
                        ) : (
                          <>🔍 Searching by client name...</>
                        )}
                      </p>
                    )}
                  </div>

                  {loadingClients ? (
                    <div className="text-center py-8 bg-white rounded-xl">
                      <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-emerald-600 border-t-transparent"></div>
                      <p className="mt-2 text-sm text-gray-600">
                        {!cacheLoaded && isCaseNumberQuery(clientSearch)
                          ? 'Loading all cases for case number search...'
                          : 'Searching...'}
                      </p>
                    </div>
                  ) : clientSearch.trim().length === 0 ? (
                    <div className="text-center py-8 bg-white rounded-xl">
                      <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      <p className="mt-2 text-sm text-gray-600">Start typing to search</p>
                      <p className="mt-1 text-xs text-gray-500">Try "maria" or "E20-043"</p>
                    </div>
                  ) : mycaseClients.length > 0 ? (
                    <div className="max-h-64 overflow-y-auto space-y-2 bg-white rounded-xl p-2">
                      {mycaseClients.map(client => (
                        <button
                          key={client.id}
                          type="button"
                          onClick={() => {
                            setSelectedClient(client)
                            setClientSearch('')
                          }}
                          className="w-full text-left px-4 py-3 rounded-lg hover:bg-emerald-50 border border-gray-200 hover:border-emerald-300 transition"
                        >
                          <p className="font-medium text-gray-900">{client.name}</p>
                          <p className="text-sm text-gray-600">Case #{client.case_number}</p>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 bg-white rounded-xl">
                      <p className="text-sm text-gray-500">No clients match your search</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-between bg-white rounded-xl p-4 border-2 border-emerald-300 shadow-sm">
                  <div>
                    <p className="font-semibold text-gray-900">{selectedClient.name}</p>
                    <p className="text-sm text-gray-600">Case #{selectedClient.case_number}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedClient(null)}
                    className="text-sm text-emerald-600 hover:text-emerald-800 font-medium"
                  >
                    Change
                  </button>
                </div>
              )}
            </div>

            {/* Evidence Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Date Received */}
              <div>
                <label htmlFor="dateReceived" className="block text-sm font-medium text-gray-700 mb-1">
                  Date Received
                </label>
                <input
                  id="dateReceived"
                  type="date"
                  value={dateReceived}
                  onChange={(e) => setDateReceived(e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>

              {/* Number of Pieces */}
              <div>
                <label htmlFor="numPieces" className="block text-sm font-medium text-gray-700 mb-1">
                  Number of Pieces
                </label>
                <input
                  id="numPieces"
                  type="number"
                  min="1"
                  value={numPieces}
                  onChange={(e) => setNumPieces(parseInt(e.target.value))}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>

              {/* Evidence Type */}
              <div>
                <label htmlFor="evidenceType" className="block text-sm font-medium text-gray-700 mb-1">
                  Evidence Type
                </label>
                <select
                  id="evidenceType"
                  value={evidenceType}
                  onChange={(e) => setEvidenceType(e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                >
                  {EVIDENCE_TYPES.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>

                {evidenceType === 'Other' && (
                  <input
                    type="text"
                    placeholder="Specify evidence type"
                    value={customEvidenceType}
                    onChange={(e) => setCustomEvidenceType(e.target.value)}
                    required
                    className="mt-2 w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                )}
              </div>

              {/* Source */}
              <div>
                <label htmlFor="source" className="block text-sm font-medium text-gray-700 mb-1">
                  Source
                </label>
                <select
                  id="source"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                >
                  {SOURCES.map(src => (
                    <option key={src} value={src}>{src}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
                Notes (Optional)
                </label>
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-none"
                placeholder="Add any additional notes..."
              />
            </div>

            {/* File Upload */}
            <div className="bg-gray-50 rounded-xl p-5 border border-gray-300">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Upload Evidence Files
              </label>
              <input
                type="file"
                multiple
                onChange={handleFileSelect}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl bg-white text-sm file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
              />

              {files.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-sm font-medium text-gray-700">Files to Upload ({files.length}):</p>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {files.map((file, index) => (
                      <div key={index} className="flex gap-2 items-center bg-white p-3 rounded-xl border border-gray-200 shadow-sm">
                        <input
                          type="text"
                          value={file.customName}
                          onChange={(e) => updateFileName(index, e.target.value)}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                        />
                        <button
                          type="button"
                          onClick={() => removeFile(index)}
                          className="px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 text-sm font-medium transition"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Google Drive Folder Selection */}
            <div className="bg-blue-50 rounded-xl p-5 border border-blue-200">
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium text-gray-700">
                  Select Google Drive Folder
                </label>
                <button
                  type="button"
                  onClick={() => setShowFolderPicker(true)}
                  className="px-3 py-1 text-xs font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 rounded-lg transition"
                >
                  Browse Drive
                </button>
              </div>

              {selectedFolder ? (
                <div className="flex items-center justify-between bg-white rounded-xl p-4 border-2 border-blue-300 shadow-sm">
                  <div className="flex items-center space-x-3">
                    <svg className="w-8 h-8 text-blue-500" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M7.71 3.5L1.15 15L4.58 21L11.14 9.5L7.71 3.5M8.29 3.5L11.71 9.5L18.29 9.5L14.86 3.5M8.29 20.5L11.71 14.5L18.29 14.5L14.86 20.5M14.86 3.5L18.29 9.5L21.71 15L18.29 20.5L14.86 14.5L11.43 20.5L7.71 15" />
                    </svg>
                    <div>
                      <p className="font-medium text-gray-900">{selectedFolder.name}</p>
                      <p className="text-xs text-gray-500">Selected folder</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedFolder(null)}
                    className="text-gray-400 hover:text-red-600 transition"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                <div className="text-center py-6 bg-white rounded-xl">
                  <svg className="mx-auto w-10 h-10 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                  <p className="text-sm text-gray-600">Click "Browse Drive" to select a folder</p>
                </div>
              )}
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl shadow-md transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Submitting Evidence...
                  </span>
                ) : (
                  'Log Evidence'
                )}
              </button>
            </div>
          </form>
        </div>
      </main>

      {/* Google Drive Folder Picker Modal */}
      <GoogleDriveFolderPicker
        isOpen={showFolderPicker}
        onClose={() => setShowFolderPicker(false)}
        onSelectFolder={(folder) => setSelectedFolder(folder)}
        selectedFolderId={selectedFolder?.id}
        initialFolderId={process.env.NEXT_PUBLIC_GDRIVE_FOLDER_ID}
        initialFolderName="Client Files"
      />
    </div>
  )
}
