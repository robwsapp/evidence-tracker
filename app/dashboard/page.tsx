'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

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
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  // Form state
  const [selectedClient, setSelectedClient] = useState<MyCaseClient | null>(null)
  const [mycaseClients, setMycaseClients] = useState<MyCaseClient[]>([])
  const [loadingClients, setLoadingClients] = useState(false)
  const [dateReceived, setDateReceived] = useState(new Date().toISOString().split('T')[0])
  const [numPieces, setNumPieces] = useState(1)
  const [evidenceType, setEvidenceType] = useState('Birth Certificate')
  const [customEvidenceType, setCustomEvidenceType] = useState('')
  const [source, setSource] = useState('Mail')
  const [notes, setNotes] = useState('')
  const [files, setFiles] = useState<UploadFile[]>([])

  useEffect(() => {
    checkUser()
  }, [])

  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      router.push('/login')
      return
    }

    setUserEmail(session.user.email || '')
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const fetchMyCaseClients = async () => {
    setLoadingClients(true)
    setError('')

    try {
      const response = await fetch('/api/mycase/clients')
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch clients')
      }

      setMycaseClients(data.clients)
    } catch (err: any) {
      setError(err.message || 'Failed to load MyCase clients')
    } finally {
      setLoadingClients(false)
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

      if (files.length === 0) {
        throw new Error('Please upload at least one file')
      }

      const finalEvidenceType = evidenceType === 'Other' ? customEvidenceType : evidenceType

      // Create evidence log
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

      // Upload files to Supabase Storage
      const folderPath = `${selectedClient.name}-${selectedClient.case_number}`

      for (const uploadFile of files) {
        const filePath = `${folderPath}/${uploadFile.customName}`

        const { error: uploadError } = await supabase.storage
          .from('evidence-files')
          .upload(filePath, uploadFile.file, {
            cacheControl: '3600',
            upsert: false
          })

        if (uploadError) throw uploadError

        // Save file record to database
        const { error: fileError } = await supabase
          .from('evidence_files')
          .insert({
            evidence_log_id: logData.id,
            file_name: uploadFile.customName,
            file_path: filePath,
            file_size: uploadFile.file.size,
            original_name: uploadFile.originalName
          })

        if (fileError) throw fileError
      }

      setSuccess('Evidence logged successfully!')

      // Reset form
      setSelectedClient(null)
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
              <div className="h-10 w-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center">
                <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Evidence Tracker</h1>
                <p className="text-sm text-gray-500">Log New Evidence</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <div className="text-right mr-4">
                <p className="text-sm font-medium text-gray-900">{userEmail}</p>
                <p className="text-xs text-gray-500">Staff Member</p>
              </div>
              <button
                onClick={() => router.push('/admin')}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition"
              >
                <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Admin Dashboard
              </button>
              <button
                onClick={handleLogout}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition"
              >
                <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Success/Error Messages */}
        {success && (
          <div className="mb-6 rounded-lg bg-green-50 border border-green-200 p-4 shadow-sm animate-in fade-in slide-in-from-top-5">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-green-800">{success}</p>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-6 rounded-lg bg-red-50 border border-red-200 p-4 shadow-sm animate-in fade-in slide-in-from-top-5">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-red-800">{error}</p>
              </div>
              <button onClick={() => setError('')} className="ml-auto">
                <svg className="h-5 w-5 text-red-400 hover:text-red-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        )}

        <div className="bg-white shadow-lg rounded-2xl border border-gray-200 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
            <h2 className="text-xl font-bold text-white">Log New Evidence</h2>
            <p className="text-blue-100 text-sm mt-1">Record evidence received from clients</p>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Client Selection */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100">
              <label className="block text-sm font-semibold text-gray-900 mb-3">
                <svg className="inline h-5 w-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Select Client from MyCase
              </label>

              {!selectedClient ? (
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={fetchMyCaseClients}
                    disabled={loadingClients}
                    className="w-full inline-flex items-center justify-center px-4 py-3 border border-transparent text-sm font-semibold rounded-lg text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition shadow-md hover:shadow-lg"
                  >
                    {loadingClients ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Loading Clients...
                      </>
                    ) : (
                      <>
                        <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Load Clients from MyCase
                      </>
                    )}
                  </button>

                  {mycaseClients.length > 0 && (
                    <select
                      onChange={(e) => {
                        const client = mycaseClients.find(c => c.id === parseInt(e.target.value))
                        if (client) setSelectedClient(client)
                      }}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white text-gray-900"
                    >
                      <option value="">Choose a client...</option>
                      {mycaseClients.map(client => (
                        <option key={client.id} value={client.id}>
                          {client.name} - Case #{client.case_number}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-between bg-white rounded-lg p-4 border-2 border-green-300 shadow-sm">
                  <div className="flex items-center space-x-3">
                    <div className="h-10 w-10 bg-green-100 rounded-full flex items-center justify-center">
                      <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{selectedClient.name}</p>
                      <p className="text-sm text-gray-600">Case #{selectedClient.case_number}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedClient(null)}
                    className="text-sm text-red-600 hover:text-red-800 font-medium"
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
                <label htmlFor="dateReceived" className="block text-sm font-semibold text-gray-700 mb-2">
                  Date Received
                </label>
                <input
                  id="dateReceived"
                  type="date"
                  value={dateReceived}
                  onChange={(e) => setDateReceived(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              {/* Number of Pieces */}
              <div>
                <label htmlFor="numPieces" className="block text-sm font-semibold text-gray-700 mb-2">
                  Number of Pieces
                </label>
                <input
                  id="numPieces"
                  type="number"
                  min="1"
                  value={numPieces}
                  onChange={(e) => setNumPieces(parseInt(e.target.value))}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              {/* Evidence Type */}
              <div>
                <label htmlFor="evidenceType" className="block text-sm font-semibold text-gray-700 mb-2">
                  Evidence Type
                </label>
                <select
                  id="evidenceType"
                  value={evidenceType}
                  onChange={(e) => setEvidenceType(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
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
                    className="mt-2 w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                )}
              </div>

              {/* Source */}
              <div>
                <label htmlFor="source" className="block text-sm font-semibold text-gray-700 mb-2">
                  Source
                </label>
                <select
                  id="source"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
                >
                  {SOURCES.map(src => (
                    <option key={src} value={src}>{src}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label htmlFor="notes" className="block text-sm font-semibold text-gray-700 mb-2">
                Notes (Optional)
              </label>
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                placeholder="Add any additional notes about this evidence..."
              />
            </div>

            {/* File Upload */}
            <div className="bg-gray-50 rounded-xl p-6 border-2 border-dashed border-gray-300">
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                <svg className="inline h-5 w-5 mr-2 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                Upload Evidence Files
              </label>
              <input
                type="file"
                multiple
                onChange={handleFileSelect}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-white text-gray-900 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
              />

              {files.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-sm font-semibold text-gray-700 mb-2">Files to Upload ({files.length}):</p>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {files.map((file, index) => (
                      <div key={index} className="flex gap-2 items-center bg-white p-3 rounded-lg border border-gray-200">
                        <svg className="h-5 w-5 text-indigo-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <input
                          type="text"
                          value={file.customName}
                          onChange={(e) => updateFileName(index, e.target.value)}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        />
                        <button
                          type="button"
                          onClick={() => removeFile(index)}
                          className="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 text-sm font-medium transition flex-shrink-0"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Submit Button */}
            <div className="pt-4">
              <button
                type="submit"
                disabled={loading}
                className="w-full inline-flex items-center justify-center px-6 py-4 border border-transparent text-base font-semibold rounded-xl text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-lg hover:shadow-xl"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Submitting Evidence...
                  </>
                ) : (
                  <>
                    <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Log Evidence
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}
