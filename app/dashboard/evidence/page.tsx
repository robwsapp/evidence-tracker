'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

interface EvidenceLog {
  id: string
  created_at: string
  client_name: string
  case_number: string
  date_received: string
  num_pieces: number
  evidence_type: string
  source: string
  notes: string | null
  staff_email: string
  files?: EvidenceFile[]
}

interface EvidenceFile {
  id: string
  file_name: string
  file_path: string
  file_size: number
}

interface ActivityLog {
  id: string
  created_at: string
  client_name: string
  case_number: string
  case_type: string
  date_received: string
  date_processed: string | null
  source: string
  handler: string
  description: string
  activity_type: string
  flag: boolean
  notes: string | null
}

export default function AdminDashboard() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'evidence' | 'activity'>('evidence')
  const [logs, setLogs] = useState<EvidenceLog[]>([])
  const [filteredLogs, setFilteredLogs] = useState<EvidenceLog[]>([])
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([])
  const [filteredActivityLogs, setFilteredActivityLogs] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(true)
  const [downloadingFolder, setDownloadingFolder] = useState<string | null>(null)

  // Filter states
  const [searchClient, setSearchClient] = useState('')
  const [searchCaseNumber, setSearchCaseNumber] = useState('')
  const [filterEvidenceType, setFilterEvidenceType] = useState('')
  const [filterSource, setFilterSource] = useState('')
  const [filterStaff, setFilterStaff] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  // Sort state
  const [sortBy, setSortBy] = useState<keyof EvidenceLog>('date_received')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  // Statistics
  const [totalPieces, setTotalPieces] = useState(0)
  const [totalClients, setTotalClients] = useState(0)

  useEffect(() => {
    checkUser()
    fetchLogs()
  }, [])

  useEffect(() => {
    applyFilters()
  }, [logs, searchClient, searchCaseNumber, filterEvidenceType, filterSource, filterStaff, startDate, endDate, sortBy, sortOrder])

  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      router.push('/login')
    }
  }

  const fetchLogs = async () => {
    setLoading(true)
    try {
      const { data: logsData, error: logsError } = await supabase
        .from('evidence_logs')
        .select('*')
        .order('date_received', { ascending: false })

      if (logsError) throw logsError

      // Fetch files for each log
      const logsWithFiles = await Promise.all(
        (logsData || []).map(async (log) => {
          const { data: filesData } = await supabase
            .from('evidence_files')
            .select('*')
            .eq('evidence_log_id', log.id)

          return {
            ...log,
            files: filesData || []
          }
        })
      )

      setLogs(logsWithFiles)
    } catch (error) {
      console.error('Error fetching logs:', error)
    } finally {
      setLoading(false)
    }
  }

  const applyFilters = () => {
    let filtered = [...logs]

    // Apply filters
    if (searchClient) {
      filtered = filtered.filter(log =>
        log.client_name.toLowerCase().includes(searchClient.toLowerCase())
      )
    }

    if (searchCaseNumber) {
      filtered = filtered.filter(log =>
        log.case_number.includes(searchCaseNumber)
      )
    }

    if (filterEvidenceType) {
      filtered = filtered.filter(log => log.evidence_type === filterEvidenceType)
    }

    if (filterSource) {
      filtered = filtered.filter(log => log.source === filterSource)
    }

    if (filterStaff) {
      filtered = filtered.filter(log => log.staff_email === filterStaff)
    }

    if (startDate) {
      filtered = filtered.filter(log => log.date_received >= startDate)
    }

    if (endDate) {
      filtered = filtered.filter(log => log.date_received <= endDate)
    }

    // Apply sorting
    filtered.sort((a, b) => {
      const aVal = a[sortBy]
      const bVal = b[sortBy]

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortOrder === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal)
      }

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortOrder === 'asc' ? aVal - bVal : bVal - aVal
      }

      return 0
    })

    setFilteredLogs(filtered)

    // Calculate statistics
    const total = filtered.reduce((sum, log) => sum + log.num_pieces, 0)
    const uniqueClients = new Set(filtered.map(log => `${log.client_name}-${log.case_number}`))

    setTotalPieces(total)
    setTotalClients(uniqueClients.size)
  }

  const downloadFolder = async (clientName: string, caseNumber: string) => {
    const folderId = `${clientName}-${caseNumber}`
    setDownloadingFolder(folderId)

    try {
      // Get all files for this client/case
      const clientLogs = logs.filter(
        log => log.client_name === clientName && log.case_number === caseNumber
      )

      const allFiles: EvidenceFile[] = []
      clientLogs.forEach(log => {
        if (log.files) {
          allFiles.push(...log.files)
        }
      })

      if (allFiles.length === 0) {
        alert('No files found for this client')
        return
      }

      // Download each file
      for (const file of allFiles) {
        const { data, error } = await supabase.storage
          .from('evidence-files')
          .download(file.file_path)

        if (error) {
          console.error('Error downloading file:', error)
          continue
        }

        // Create download link
        const url = URL.createObjectURL(data)
        const link = document.createElement('a')
        link.href = url
        link.download = file.file_name
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)

        // Small delay between downloads
        await new Promise(resolve => setTimeout(resolve, 500))
      }

      alert(`Downloaded ${allFiles.length} files`)
    } catch (error) {
      console.error('Error downloading folder:', error)
      alert('Failed to download files')
    } finally {
      setDownloadingFolder(null)
    }
  }

  const exportToCSV = () => {
    const headers = [
      'Date Received',
      'Client Name',
      'Case Number',
      'Evidence Type',
      'Number of Pieces',
      'Source',
      'Staff',
      'Notes'
    ]

    const rows = filteredLogs.map(log => [
      log.date_received,
      log.client_name,
      log.case_number,
      log.evidence_type,
      log.num_pieces,
      log.source,
      log.staff_email,
      log.notes || ''
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `evidence-report-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const uniqueEvidenceTypes = Array.from(new Set(logs.map(log => log.evidence_type)))
  const uniqueSources = Array.from(new Set(logs.map(log => log.source)))
  const uniqueStaff = Array.from(new Set(logs.map(log => log.staff_email)))

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="bg-white shadow-lg border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-2xl shadow-lg">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
                <p className="text-sm text-gray-600">Elizabeth Rosario Law</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => router.push('/admin/activity')}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition shadow-md"
              >
                Activity Log
              </button>
              <button
                onClick={() => router.push('/dashboard')}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition shadow-sm"
              >
                Back to Dashboard
              </button>
              <button
                onClick={async () => {
                  await supabase.auth.signOut()
                  router.push('/login')
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-xl hover:bg-red-700 transition shadow-md"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white shadow-xl rounded-2xl p-6 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-gray-600 mb-2">Total Evidence Logs</h3>
                <p className="text-3xl font-bold text-emerald-600">{filteredLogs.length}</p>
              </div>
              <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>
          </div>
          <div className="bg-white shadow-xl rounded-2xl p-6 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-gray-600 mb-2">Total Pieces</h3>
                <p className="text-3xl font-bold text-emerald-600">{totalPieces}</p>
              </div>
              <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                </svg>
              </div>
            </div>
          </div>
          <div className="bg-white shadow-xl rounded-2xl p-6 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-gray-600 mb-2">Unique Clients</h3>
                <p className="text-3xl font-bold text-emerald-600">{totalClients}</p>
              </div>
              <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white shadow-xl rounded-2xl p-6 mb-8 border border-gray-100">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-semibold text-gray-900">Filters & Search</h2>
            <div className="flex gap-3">
              <button
                onClick={exportToCSV}
                className="px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 text-sm font-medium shadow-md transition"
              >
                Export to CSV
              </button>
              <button
                onClick={() => {
                  setSearchClient('')
                  setSearchCaseNumber('')
                  setFilterEvidenceType('')
                  setFilterSource('')
                  setFilterStaff('')
                  setStartDate('')
                  setEndDate('')
                }}
                className="px-4 py-2 bg-gray-600 text-white rounded-xl hover:bg-gray-700 text-sm font-medium shadow-md transition"
              >
                Clear Filters
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input
              type="text"
              placeholder="Search client name..."
              value={searchClient}
              onChange={(e) => setSearchClient(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition text-sm"
            />

            <input
              type="text"
              placeholder="Search case number..."
              value={searchCaseNumber}
              onChange={(e) => setSearchCaseNumber(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition text-sm"
            />

            <select
              value={filterEvidenceType}
              onChange={(e) => setFilterEvidenceType(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition text-sm"
            >
              <option value="">All Evidence Types</option>
              {uniqueEvidenceTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>

            <select
              value={filterSource}
              onChange={(e) => setFilterSource(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition text-sm"
            >
              <option value="">All Sources</option>
              {uniqueSources.map(source => (
                <option key={source} value={source}>{source}</option>
              ))}
            </select>

            <select
              value={filterStaff}
              onChange={(e) => setFilterStaff(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition text-sm"
            >
              <option value="">All Staff</option>
              {uniqueStaff.map(staff => (
                <option key={staff} value={staff}>{staff}</option>
              ))}
            </select>

            <div className="flex gap-2">
              <input
                type="date"
                placeholder="Start Date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition text-sm"
              />
              <input
                type="date"
                placeholder="End Date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition text-sm"
              />
            </div>
          </div>
        </div>

        {/* Evidence Logs Table */}
        <div className="bg-white shadow-xl rounded-2xl overflow-hidden border border-gray-100">
          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-8 text-center text-gray-500">Loading...</div>
            ) : filteredLogs.length === 0 ? (
              <div className="p-8 text-center text-gray-500">No evidence logs found</div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-emerald-50">
                  <tr>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-emerald-800 uppercase tracking-wider cursor-pointer hover:bg-emerald-100 transition"
                      onClick={() => {
                        setSortBy('date_received')
                        setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
                      }}
                    >
                      Date Received {sortBy === 'date_received' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-emerald-800 uppercase tracking-wider cursor-pointer hover:bg-emerald-100 transition"
                      onClick={() => {
                        setSortBy('client_name')
                        setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
                      }}
                    >
                      Client {sortBy === 'client_name' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-emerald-800 uppercase tracking-wider">
                      Case Number
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-emerald-800 uppercase tracking-wider">
                      Evidence Type
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-emerald-800 uppercase tracking-wider cursor-pointer hover:bg-emerald-100 transition"
                      onClick={() => {
                        setSortBy('num_pieces')
                        setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
                      }}
                    >
                      Pieces {sortBy === 'num_pieces' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-emerald-800 uppercase tracking-wider">
                      Source
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-emerald-800 uppercase tracking-wider">
                      Staff
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-emerald-800 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50 transition">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {log.date_received}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {log.client_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {log.case_number}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {log.evidence_type}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {log.num_pieces}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {log.source}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {log.staff_email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={() => downloadFolder(log.client_name, log.case_number)}
                          disabled={downloadingFolder === `${log.client_name}-${log.case_number}`}
                          className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                        >
                          {downloadingFolder === `${log.client_name}-${log.case_number}`
                            ? 'Downloading...'
                            : `Download (${log.files?.length || 0})`}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
