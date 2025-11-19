'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'

export const dynamic = 'force-dynamic'

interface DailyStat {
  stat_date: string
  evidence_processed: number
  evidence_completed: number
  fp_mail_total: number
  fp_walk_in_total: number
  fp_unsigned_mail_back: number
  fbi_results: number
  fbi_e_requests: number
  notes: string
}

export default function DailyStatsEntryPage() {
  const router = useRouter()
  const [userEmail, setUserEmail] = useState('')
  const [userId, setUserId] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  const [stat, setStat] = useState<DailyStat>({
    stat_date: new Date().toISOString().split('T')[0],
    evidence_processed: 0,
    evidence_completed: 0,
    fp_mail_total: 0,
    fp_walk_in_total: 0,
    fp_unsigned_mail_back: 0,
    fbi_results: 0,
    fbi_e_requests: 0,
    notes: '',
  })

  useEffect(() => {
    checkUser()
  }, [])

  useEffect(() => {
    if (userId && stat.stat_date) {
      loadExistingStats()
    }
  }, [userId, stat.stat_date])

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

  const loadExistingStats = async () => {
    try {
      const { data, error } = await supabase
        .from('daily_stats')
        .select('*')
        .eq('user_id', userId)
        .eq('stat_date', stat.stat_date)
        .single()

      if (data) {
        setStat({
          stat_date: data.stat_date,
          evidence_processed: data.evidence_processed || 0,
          evidence_completed: data.evidence_completed || 0,
          fp_mail_total: data.fp_mail_total || 0,
          fp_walk_in_total: data.fp_walk_in_total || 0,
          fp_unsigned_mail_back: data.fp_unsigned_mail_back || 0,
          fbi_results: data.fbi_results || 0,
          fbi_e_requests: data.fbi_e_requests || 0,
          notes: data.notes || '',
        })
      }
    } catch (err) {
      // No existing stats for this date, that's okay
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const { error: upsertError } = await supabase
        .from('daily_stats')
        .upsert({
          user_id: userId,
          stat_date: stat.stat_date,
          evidence_processed: stat.evidence_processed,
          evidence_completed: stat.evidence_completed,
          fp_mail_total: stat.fp_mail_total,
          fp_walk_in_total: stat.fp_walk_in_total,
          fp_unsigned_mail_back: stat.fp_unsigned_mail_back,
          fbi_results: stat.fbi_results,
          fbi_e_requests: stat.fbi_e_requests,
          notes: stat.notes,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,stat_date'
        })

      if (upsertError) throw upsertError

      setSuccess('Daily stats saved successfully!')
      setTimeout(() => {
        router.push('/reports')
      }, 1500)

    } catch (err: any) {
      console.error('Error saving daily stats:', err)
      setError(err.message || 'Failed to save daily stats')
    } finally {
      setLoading(false)
    }
  }

  const handleNumberChange = (field: keyof DailyStat, value: string) => {
    const numValue = parseInt(value) || 0
    setStat({ ...stat, [field]: numValue })
  }

  return (
    <DashboardLayout>
      <div className="p-4">
        <div className="mb-3">
          <h1 className="text-2xl font-bold text-gray-900">Daily Stats Entry</h1>
          <p className="text-sm text-gray-600">Enter daily statistics for reporting</p>
        </div>

        <div className="max-w-6xl mx-auto">
          <div className="bg-white rounded-lg shadow-sm p-4">
          {success && (
            <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-800">{success}</p>
            </div>
          )}

          {error && (
            <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Date */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">
                Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={stat.stat_date}
                onChange={(e) => setStat({ ...stat, stat_date: e.target.value })}
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            {/* Evidence Processing Section */}
            <div className="border-t pt-3">
              <h3 className="text-sm font-medium text-gray-900 mb-2">Evidence Processing</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-0.5">
                    Evidence Processed
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={stat.evidence_processed}
                    onChange={(e) => handleNumberChange('evidence_processed', e.target.value)}
                    className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-0.5">
                    Cases Completed
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={stat.evidence_completed}
                    onChange={(e) => handleNumberChange('evidence_completed', e.target.value)}
                    className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Fingerprinting Section */}
            <div className="border-t pt-3">
              <h3 className="text-sm font-medium text-gray-900 mb-2">Fingerprinting</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-0.5">
                    Total FP Mail
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={stat.fp_mail_total}
                    onChange={(e) => handleNumberChange('fp_mail_total', e.target.value)}
                    className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-0.5">
                    Total FP Walk In
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={stat.fp_walk_in_total}
                    onChange={(e) => handleNumberChange('fp_walk_in_total', e.target.value)}
                    className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-0.5">
                    Unsigned + FP Mail Back
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={stat.fp_unsigned_mail_back}
                    onChange={(e) => handleNumberChange('fp_unsigned_mail_back', e.target.value)}
                    className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-0.5">
                    FBI Results
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={stat.fbi_results}
                    onChange={(e) => handleNumberChange('fbi_results', e.target.value)}
                    className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-0.5">
                    FBI E-Requests
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={stat.fbi_e_requests}
                    onChange={(e) => handleNumberChange('fbi_e_requests', e.target.value)}
                    className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="border-t pt-3">
              <label className="block text-xs font-medium text-gray-700 mb-0.5">
                Notes
              </label>
              <textarea
                value={stat.notes}
                onChange={(e) => setStat({ ...stat, notes: e.target.value })}
                rows={2}
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Add any notes about today's work..."
              />
            </div>

            {/* Submit Button */}
            <div className="flex space-x-3 pt-2">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {loading ? 'Saving...' : 'Save Daily Stats'}
              </button>
              <button
                type="button"
                onClick={() => router.push('/reports')}
                className="px-4 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
              >
                Cancel
              </button>
            </div>
          </form>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
