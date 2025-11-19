'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'

export const dynamic = 'force-dynamic'

interface EvidenceLog {
  id: string
  date_received: string
  evidence_type: string
  source: string
  num_pieces: number
}

interface ActivityLog {
  id: string
  date_received: string
  activity_type: string
}

export default function OverviewPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [evidenceLogs, setEvidenceLogs] = useState<EvidenceLog[]>([])
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([])

  // Stats
  const [totalEvidence, setTotalEvidence] = useState(0)
  const [totalPieces, setTotalPieces] = useState(0)
  const [totalActivities, setTotalActivities] = useState(0)
  const [thisWeekEvidence, setThisWeekEvidence] = useState(0)

  useEffect(() => {
    checkUser()
    fetchData()
  }, [])

  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      router.push('/login')
    }
  }

  const fetchData = async () => {
    setLoading(true)
    try {
      // Fetch evidence logs
      const { data: evidenceData, error: evidenceError } = await supabase
        .from('evidence_logs')
        .select('id, date_received, evidence_type, source, num_pieces')
        .order('date_received', { ascending: true })

      if (evidenceError) throw evidenceError

      // Fetch activity logs
      const { data: activityData, error: activityError } = await supabase
        .from('activity_log')
        .select('id, date_received, activity_type')
        .order('date_received', { ascending: true })

      if (activityError) throw activityError

      setEvidenceLogs(evidenceData || [])
      setActivityLogs(activityData || [])

      // Calculate stats
      const totalEv = evidenceData?.length || 0
      const totalP = evidenceData?.reduce((sum, log) => sum + log.num_pieces, 0) || 0
      const totalAct = activityData?.length || 0

      // This week evidence
      const today = new Date()
      const monday = new Date(today)
      monday.setDate(today.getDate() - today.getDay() + 1)
      const mondayStr = monday.toISOString().split('T')[0]

      const thisWeek = evidenceData?.filter(log => log.date_received >= mondayStr).length || 0

      setTotalEvidence(totalEv)
      setTotalPieces(totalP)
      setTotalActivities(totalAct)
      setThisWeekEvidence(thisWeek)

    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Prepare data for Evidence Growth chart (last 30 days)
  const getEvidenceGrowthData = () => {
    const last30Days = []
    const today = new Date()

    for (let i = 29; i >= 0; i--) {
      const date = new Date(today)
      date.setDate(today.getDate() - i)
      const dateStr = date.toISOString().split('T')[0]

      const count = evidenceLogs.filter(log => log.date_received === dateStr).length
      const pieces = evidenceLogs
        .filter(log => log.date_received === dateStr)
        .reduce((sum, log) => sum + log.num_pieces, 0)

      last30Days.push({
        date: `${date.getMonth() + 1}/${date.getDate()}`,
        evidence: count,
        pieces
      })
    }

    return last30Days
  }

  // Prepare data for Evidence by Type chart
  const getEvidenceByTypeData = () => {
    const typeCounts: { [key: string]: number } = {}

    evidenceLogs.forEach(log => {
      typeCounts[log.evidence_type] = (typeCounts[log.evidence_type] || 0) + 1
    })

    return Object.entries(typeCounts)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10) // Top 10
  }

  // Prepare data for Evidence by Source chart
  const getEvidenceBySourceData = () => {
    const sourceCounts: { [key: string]: number } = {}

    evidenceLogs.forEach(log => {
      sourceCounts[log.source] = (sourceCounts[log.source] || 0) + 1
    })

    return Object.entries(sourceCounts).map(([source, count]) => ({ source, count }))
  }

  // Prepare data for Activity Types pie chart
  const getActivityTypeData = () => {
    const activityCounts: { [key: string]: number } = {}

    activityLogs.forEach(log => {
      activityCounts[log.activity_type] = (activityCounts[log.activity_type] || 0) + 1
    })

    return Object.entries(activityCounts).map(([type, count]) => ({ name: type, value: count }))
  }

  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Dashboard Overview</h1>
          <p className="text-gray-600 mt-1">Evidence tracking and analytics</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-500">Loading...</div>
          </div>
        ) : (
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Evidence Logs</p>
                    <p className="text-3xl font-bold text-emerald-600 mt-2">{totalEvidence}</p>
                  </div>
                  <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                    <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Pieces</p>
                    <p className="text-3xl font-bold text-blue-600 mt-2">{totalPieces}</p>
                  </div>
                  <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">This Week</p>
                    <p className="text-3xl font-bold text-purple-600 mt-2">{thisWeekEvidence}</p>
                  </div>
                  <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                    <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Activities</p>
                    <p className="text-3xl font-bold text-orange-600 mt-2">{totalActivities}</p>
                  </div>
                  <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                    <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Evidence Growth Chart */}
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Evidence Growth (Last 30 Days)</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={getEvidenceGrowthData()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="evidence" stroke="#10b981" strokeWidth={2} name="Evidence Logs" />
                    <Line type="monotone" dataKey="pieces" stroke="#3b82f6" strokeWidth={2} name="Total Pieces" />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Evidence by Type Chart */}
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Evidence Types</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={getEvidenceByTypeData()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="type" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={100} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#10b981" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Evidence by Source Chart */}
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Evidence by Source</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={getEvidenceBySourceData()}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ source, percent }) => `${source}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="count"
                    >
                      {getEvidenceBySourceData().map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Activity Types Chart */}
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Activity Types</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={getActivityTypeData()}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {getActivityTypeData().map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <button
                  onClick={() => router.push('/dashboard/log')}
                  className="flex flex-col items-center justify-center p-6 border-2 border-gray-200 rounded-xl hover:border-emerald-500 hover:bg-emerald-50 transition"
                >
                  <svg className="w-8 h-8 text-emerald-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span className="text-sm font-medium text-gray-900">Log Evidence</span>
                </button>

                <button
                  onClick={() => router.push('/dashboard/activity/entry')}
                  className="flex flex-col items-center justify-center p-6 border-2 border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition"
                >
                  <svg className="w-8 h-8 text-blue-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <span className="text-sm font-medium text-gray-900">Add Activity</span>
                </button>

                <button
                  onClick={() => router.push('/dashboard/reports')}
                  className="flex flex-col items-center justify-center p-6 border-2 border-gray-200 rounded-xl hover:border-purple-500 hover:bg-purple-50 transition"
                >
                  <svg className="w-8 h-8 text-purple-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="text-sm font-medium text-gray-900">View Reports</span>
                </button>

                <button
                  onClick={() => router.push('/dashboard/reports/entry')}
                  className="flex flex-col items-center justify-center p-6 border-2 border-gray-200 rounded-xl hover:border-orange-500 hover:bg-orange-50 transition"
                >
                  <svg className="w-8 h-8 text-orange-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  <span className="text-sm font-medium text-gray-900">Daily Stats</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  )
}
