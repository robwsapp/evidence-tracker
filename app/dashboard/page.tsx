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

    } catch (err: any) {
      setError(err.message || 'Failed to log evidence')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">Evidence Tracker</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{userEmail}</span>
            <button
              onClick={() => router.push('/admin')}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
            >
              Admin Dashboard
            </button>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white shadow-md rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-6">Log Evidence</h2>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Client Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Client from MyCase
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={fetchMyCaseClients}
                  disabled={loadingClients}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {loadingClients ? 'Loading...' : 'Load Clients'}
                </button>

                {selectedClient && (
                  <div className="flex-1 px-4 py-2 bg-green-50 border border-green-200 rounded-md">
                    <span className="font-medium">{selectedClient.name}</span>
                    <span className="text-gray-600 ml-2">Case #{selectedClient.case_number}</span>
                  </div>
                )}
              </div>

              {mycaseClients.length > 0 && !selectedClient && (
                <select
                  onChange={(e) => {
                    const client = mycaseClients.find(c => c.id === parseInt(e.target.value))
                    if (client) setSelectedClient(client)
                  }}
                  className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-md"
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

            {/* Date Received */}
            <div>
              <label htmlFor="dateReceived" className="block text-sm font-medium text-gray-700 mb-2">
                Date Received
              </label>
              <input
                id="dateReceived"
                type="date"
                value={dateReceived}
                onChange={(e) => setDateReceived(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>

            {/* Number of Pieces */}
            <div>
              <label htmlFor="numPieces" className="block text-sm font-medium text-gray-700 mb-2">
                Number of Pieces
              </label>
              <input
                id="numPieces"
                type="number"
                min="1"
                value={numPieces}
                onChange={(e) => setNumPieces(parseInt(e.target.value))}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>

            {/* Evidence Type */}
            <div>
              <label htmlFor="evidenceType" className="block text-sm font-medium text-gray-700 mb-2">
                Evidence Type
              </label>
              <select
                id="evidenceType"
                value={evidenceType}
                onChange={(e) => setEvidenceType(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
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
                  className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              )}
            </div>

            {/* Source */}
            <div>
              <label htmlFor="source" className="block text-sm font-medium text-gray-700 mb-2">
                Source
              </label>
              <select
                id="source"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                {SOURCES.map(src => (
                  <option key={src} value={src}>{src}</option>
                ))}
              </select>
            </div>

            {/* Notes */}
            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
                Notes (Optional)
              </label>
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Additional notes..."
              />
            </div>

            {/* File Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Upload Evidence Files
              </label>
              <input
                type="file"
                multiple
                onChange={handleFileSelect}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />

              {files.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-sm font-medium text-gray-700">Files to Upload:</p>
                  {files.map((file, index) => (
                    <div key={index} className="flex gap-2 items-center">
                      <input
                        type="text"
                        value={file.customName}
                        onChange={(e) => updateFileName(index, e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => removeFile(index)}
                        className="px-3 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 text-sm"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Messages */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
                {error}
              </div>
            )}

            {success && (
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md text-sm">
                {success}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 font-medium"
            >
              {loading ? 'Submitting...' : 'Log Evidence'}
            </button>
          </form>
        </div>
      </main>
    </div>
  )
}
