'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const CASE_TYPES = [
  'I-360 + AOS-Parent',
  'I-360 + AOS-Marriage',
  'T-visa',
  'U Visa',
  'Other'
]

const ACTIVITY_TYPES = [
  'RESULTS',
  'SUBMISSION',
  'FOLLOW-UP',
  'OTHER'
]

const SOURCES = [
  'FBI Email',
  'Mail',
  'Email',
  'In-Person',
  'Fax'
]

export default function ActivityEntryPage() {
  const router = useRouter()
  const [userId, setUserId] = useState('')
  const [userEmail, setUserEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  const [formData, setFormData] = useState({
    client_name: '',
    case_number: '',
    case_type: 'I-360 + AOS-Parent',
    date_received: new Date().toISOString().split('T')[0],
    date_processed: '',
    source: 'FBI Email',
    handler: '',
    description: '',
    activity_type: 'RESULTS',
    flag: false,
    notes: ''
  })

  useEffect(() => {
    checkUser()
  }, [])

  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      router.push('/login')
      return
    }

    setUserId(session.user.id)
    setUserEmail(session.user.email || '')
    // Pre-fill handler with user's name from email
    const handlerName = session.user.email?.split('@')[0].replace('.', ' ')
    setFormData(prev => ({...prev, handler: handlerName || ''}))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const { error: insertError } = await supabase
        .from('activity_log')
        .insert({
          user_id: userId,
          client_name: formData.client_name,
          case_number: formData.case_number,
          case_type: formData.case_type,
          date_received: formData.date_received,
          date_processed: formData.date_processed || null,
          source: formData.source,
          handler: formData.handler,
          description: formData.description,
          activity_type: formData.activity_type,
          flag: formData.flag,
          notes: formData.notes || null
        })

      if (insertError) throw insertError

      setSuccess('Activity log entry added successfully!')

      // Reset form
      setFormData({
        client_name: '',
        case_number: '',
        case_type: 'I-360 + AOS-Parent',
        date_received: new Date().toISOString().split('T')[0],
        date_processed: '',
        source: 'FBI Email',
        handler: formData.handler, // Keep handler
        description: '',
        activity_type: 'RESULTS',
        flag: false,
        notes: ''
      })

      setTimeout(() => setSuccess(''), 3000)

    } catch (err: any) {
      console.error('Error adding activity log:', err)
      setError(err.message || 'Failed to add activity log')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <h1 className="text-xl font-semibold text-gray-900">Add Activity Log Entry</h1>
              <button
                onClick={() => router.push('/admin/activity')}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                ← Back to Activity Log
              </button>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700">{userEmail}</span>
              <button
                onClick={async () => {
                  await supabase.auth.signOut()
                  router.push('/login')
                }}
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-sm p-6">
          {success && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-md">
              <p className="text-sm text-green-800">{success}</p>
            </div>
          )}

          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Client and Case Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Client Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.client_name}
                  onChange={(e) => setFormData({...formData, client_name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., ESTRADA CASTILLO, Maria"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Case Number
                </label>
                <input
                  type="text"
                  value={formData.case_number}
                  onChange={(e) => setFormData({...formData, case_number: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., 25-1595"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Case Type <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={formData.case_type}
                onChange={(e) => setFormData({...formData, case_type: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {CASE_TYPES.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date Received <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={formData.date_received}
                  onChange={(e) => setFormData({...formData, date_received: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date Processed
                </label>
                <input
                  type="date"
                  value={formData.date_processed}
                  onChange={(e) => setFormData({...formData, date_processed: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Source and Handler */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Source <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={formData.source}
                  onChange={(e) => setFormData({...formData, source: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {SOURCES.map(source => (
                    <option key={source} value={source}>{source}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Handler <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.handler}
                  onChange={(e) => setFormData({...formData, handler: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Astrid"
                />
              </div>
            </div>

            {/* Description and Activity Type */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., FBI Results - No Prior Arrest"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Activity Type <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={formData.activity_type}
                  onChange={(e) => setFormData({...formData, activity_type: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {ACTIVITY_TYPES.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Flag */}
            <div className="flex items-center">
              <input
                type="checkbox"
                id="flag"
                checked={formData.flag}
                onChange={(e) => setFormData({...formData, flag: e.target.checked})}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="flag" className="ml-2 block text-sm text-gray-900">
                Flag this entry for follow-up
              </label>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Additional notes..."
              />
            </div>

            {/* Submit Buttons */}
            <div className="flex space-x-4 pt-4">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-6 py-3 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {loading ? 'Adding...' : 'Add Activity'}
              </button>
              <button
                type="button"
                onClick={() => router.push('/admin/activity')}
                className="px-6 py-3 bg-gray-200 text-gray-700 font-medium rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}
