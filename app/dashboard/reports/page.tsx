'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'

export const dynamic = 'force-dynamic'

interface DailyStat {
  id: string
  user_id: string
  stat_date: string
  evidence_processed: number
  evidence_completed: number
  fp_mail_total: number
  fp_walk_in_total: number
  fp_unsigned_mail_back: number
  fbi_results: number
  fbi_e_requests: number
  notes: string | null
}

interface EvidenceStats {
  total_mail: number
  total_walk_in: number
  total_evidence: number
  medical_exams: number
}

interface WeeklyTotals {
  evidence_processed: number
  evidence_completed: number
  fp_mail_total: number
  fp_walk_in_total: number
  fp_unsigned_mail_back: number
  fbi_results: number
  fbi_e_requests: number
  total_mail: number
  total_walk_in: number
  total_evidence: number
  medical_exams: number
}

export default function ReportsPage() {
  const router = useRouter()
  const [userEmail, setUserEmail] = useState('')
  const [userId, setUserId] = useState('')
  const [loading, setLoading] = useState(false)
  const [viewMode, setViewMode] = useState<'user' | 'org'>('user')

  // Date range state
  const [startDate, setStartDate] = useState(() => {
    const today = new Date()
    const monday = new Date(today)
    monday.setDate(today.getDate() - today.getDay() + 1) // Get Monday of current week
    return monday.toISOString().split('T')[0]
  })
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0])

  // Data state
  const [dailyStats, setDailyStats] = useState<DailyStat[]>([])
  const [evidenceStats, setEvidenceStats] = useState<{ [key: string]: EvidenceStats }>({})
  const [weeklyTotals, setWeeklyTotals] = useState<WeeklyTotals>({
    evidence_processed: 0,
    evidence_completed: 0,
    fp_mail_total: 0,
    fp_walk_in_total: 0,
    fp_unsigned_mail_back: 0,
    fbi_results: 0,
    fbi_e_requests: 0,
    total_mail: 0,
    total_walk_in: 0,
    total_evidence: 0,
    medical_exams: 0,
  })

  useEffect(() => {
    checkUser()
  }, [])

  useEffect(() => {
    if (userId) {
      loadReportData()
    }
  }, [userId, startDate, endDate, viewMode])

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

  const loadReportData = async () => {
    setLoading(true)
    try {
      // Load daily stats
      let statsQuery = supabase
        .from('daily_stats')
        .select('*')
        .gte('stat_date', startDate)
        .lte('stat_date', endDate)
        .order('stat_date', { ascending: true })

      if (viewMode === 'user') {
        statsQuery = statsQuery.eq('user_id', userId)
      }

      const { data: statsData, error: statsError } = await statsQuery

      if (statsError) throw statsError

      setDailyStats(statsData || [])

      // Load evidence log stats (auto-generated from evidence_logs)
      let evidenceQuery = supabase
        .from('evidence_logs')
        .select('date_received, source, evidence_type')
        .gte('date_received', startDate)
        .lte('date_received', endDate)

      if (viewMode === 'user') {
        evidenceQuery = evidenceQuery.eq('user_id', userId)
      }

      const { data: evidenceData, error: evidenceError } = await evidenceQuery

      if (evidenceError) throw evidenceError

      // Group evidence by date
      const evidenceByDate: { [key: string]: EvidenceStats } = {}

      evidenceData?.forEach(log => {
        const date = log.date_received
        if (!evidenceByDate[date]) {
          evidenceByDate[date] = {
            total_mail: 0,
            total_walk_in: 0,
            total_evidence: 0,
            medical_exams: 0,
          }
        }

        evidenceByDate[date].total_evidence += 1

        if (log.source === 'Mail' || log.source === 'Email') {
          evidenceByDate[date].total_mail += 1
        } else if (log.source === 'In-Person') {
          evidenceByDate[date].total_walk_in += 1
        }

        // Check if it's a medical exam (you might need to adjust this logic)
        if (log.evidence_type && log.evidence_type.toLowerCase().includes('medical')) {
          evidenceByDate[date].medical_exams += 1
        }
      })

      setEvidenceStats(evidenceByDate)

      // Calculate weekly totals
      const totals: WeeklyTotals = {
        evidence_processed: 0,
        evidence_completed: 0,
        fp_mail_total: 0,
        fp_walk_in_total: 0,
        fp_unsigned_mail_back: 0,
        fbi_results: 0,
        fbi_e_requests: 0,
        total_mail: 0,
        total_walk_in: 0,
        total_evidence: 0,
        medical_exams: 0,
      }

      statsData?.forEach(stat => {
        totals.evidence_processed += stat.evidence_processed || 0
        totals.evidence_completed += stat.evidence_completed || 0
        totals.fp_mail_total += stat.fp_mail_total || 0
        totals.fp_walk_in_total += stat.fp_walk_in_total || 0
        totals.fp_unsigned_mail_back += stat.fp_unsigned_mail_back || 0
        totals.fbi_results += stat.fbi_results || 0
        totals.fbi_e_requests += stat.fbi_e_requests || 0
      })

      Object.values(evidenceByDate).forEach(stats => {
        totals.total_mail += stats.total_mail
        totals.total_walk_in += stats.total_walk_in
        totals.total_evidence += stats.total_evidence
        totals.medical_exams += stats.medical_exams
      })

      setWeeklyTotals(totals)

    } catch (error: any) {
      console.error('Error loading report data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getDatesInRange = () => {
    const dates = []
    const start = new Date(startDate)
    const end = new Date(endDate)

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dates.push(new Date(d).toISOString().split('T')[0])
    }

    return dates
  }

  const getStatForDate = (date: string) => {
    return dailyStats.find(stat => stat.stat_date === date)
  }

  const getEvidenceForDate = (date: string) => {
    return evidenceStats[date] || {
      total_mail: 0,
      total_walk_in: 0,
      total_evidence: 0,
      medical_exams: 0,
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString + 'T00:00:00')
    return date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' })
  }

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Weekly Reports</h1>
            <p className="text-gray-600 mt-1">View and generate weekly performance reports</p>
          </div>
          <button
            onClick={() => router.push('/dashboard/reports/entry')}
            className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition shadow-md"
          >
            Enter Daily Stats
          </button>
        </div>
        {/* Controls */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                View Mode
              </label>
              <select
                value={viewMode}
                onChange={(e) => setViewMode(e.target.value as 'user' | 'org')}
                className="px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="user">My Stats</option>
                <option value="org">Organization-Wide</option>
              </select>
            </div>
            <button
              onClick={loadReportData}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
            >
              {loading ? 'Loading...' : 'Refresh'}
            </button>
            <button
              onClick={() => router.push('/reports/entry')}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
            >
              Enter Daily Stats
            </button>
          </div>
        </div>

        {/* Evidence Received Table */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Evidence Received</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Mail</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Walk In</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Evidence</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Medical Exam</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {getDatesInRange().map(date => {
                  const evidence = getEvidenceForDate(date)
                  return (
                    <tr key={date}>
                      <td className="px-3 py-2 text-sm text-gray-900">{formatDate(date)}</td>
                      <td className="px-3 py-2 text-sm text-gray-900">{evidence.total_mail}</td>
                      <td className="px-3 py-2 text-sm text-gray-900">{evidence.total_walk_in}</td>
                      <td className="px-3 py-2 text-sm text-gray-900">{evidence.total_evidence}</td>
                      <td className="px-3 py-2 text-sm text-gray-900">{evidence.medical_exams}</td>
                    </tr>
                  )
                })}
                <tr className="bg-blue-50 font-semibold">
                  <td className="px-3 py-2 text-sm text-gray-900">WEEKLY TOTAL</td>
                  <td className="px-3 py-2 text-sm text-gray-900">{weeklyTotals.total_mail}</td>
                  <td className="px-3 py-2 text-sm text-gray-900">{weeklyTotals.total_walk_in}</td>
                  <td className="px-3 py-2 text-sm text-gray-900">{weeklyTotals.total_evidence}</td>
                  <td className="px-3 py-2 text-sm text-gray-900">{weeklyTotals.medical_exams}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Evidence Processed Table */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Evidence Processed</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Evidence Processed</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Case Completed</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {getDatesInRange().map(date => {
                  const stat = getStatForDate(date)
                  return (
                    <tr key={date}>
                      <td className="px-3 py-2 text-sm text-gray-900">{formatDate(date)}</td>
                      <td className="px-3 py-2 text-sm text-gray-900">{stat?.evidence_processed || 0}</td>
                      <td className="px-3 py-2 text-sm text-gray-900">{stat?.evidence_completed || 0}</td>
                    </tr>
                  )
                })}
                <tr className="bg-blue-50 font-semibold">
                  <td className="px-3 py-2 text-sm text-gray-900">WEEKLY TOTAL</td>
                  <td className="px-3 py-2 text-sm text-gray-900">{weeklyTotals.evidence_processed}</td>
                  <td className="px-3 py-2 text-sm text-gray-900">{weeklyTotals.evidence_completed}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Fingerprinting Table */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Fingerprinting</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total FP Mail</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total FP Walk In</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unsigned + FP Mail Back</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">FBI Results</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">FBI E-Requests</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {getDatesInRange().map(date => {
                  const stat = getStatForDate(date)
                  return (
                    <tr key={date}>
                      <td className="px-3 py-2 text-sm text-gray-900">{formatDate(date)}</td>
                      <td className="px-3 py-2 text-sm text-gray-900">{stat?.fp_mail_total || 0}</td>
                      <td className="px-3 py-2 text-sm text-gray-900">{stat?.fp_walk_in_total || 0}</td>
                      <td className="px-3 py-2 text-sm text-gray-900">{stat?.fp_unsigned_mail_back || 0}</td>
                      <td className="px-3 py-2 text-sm text-gray-900">{stat?.fbi_results || 0}</td>
                      <td className="px-3 py-2 text-sm text-gray-900">{stat?.fbi_e_requests || 0}</td>
                    </tr>
                  )
                })}
                <tr className="bg-blue-50 font-semibold">
                  <td className="px-3 py-2 text-sm text-gray-900">WEEKLY TOTAL</td>
                  <td className="px-3 py-2 text-sm text-gray-900">{weeklyTotals.fp_mail_total}</td>
                  <td className="px-3 py-2 text-sm text-gray-900">{weeklyTotals.fp_walk_in_total}</td>
                  <td className="px-3 py-2 text-sm text-gray-900">{weeklyTotals.fp_unsigned_mail_back}</td>
                  <td className="px-3 py-2 text-sm text-gray-900">{weeklyTotals.fbi_results}</td>
                  <td className="px-3 py-2 text-sm text-gray-900">{weeklyTotals.fbi_e_requests}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
