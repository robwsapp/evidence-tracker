'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'

export const dynamic = 'force-dynamic'

interface User {
  id: string
  email: string
  created_at: string
  last_sign_in_at: string | null
  user_metadata?: any
}

export default function SettingsPage() {
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddUser, setShowAddUser] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Form state
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newName, setNewName] = useState('')

  useEffect(() => {
    checkAuth()
    fetchUsers()
  }, [])

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      router.push('/login')
    }
  }

  const fetchUsers = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/users')
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch users')
      }

      setUsers(data.users || [])
    } catch (err: any) {
      console.error('Error:', err)
      setError('Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: newEmail,
          password: newPassword,
          name: newName
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to add user')
      }

      setSuccess('User added successfully!')
      setNewEmail('')
      setNewPassword('')
      setNewName('')
      setShowAddUser(false)

      // Refresh user list
      setTimeout(() => {
        fetchUsers()
        setSuccess('')
      }, 2000)
    } catch (err: any) {
      console.error('Error adding user:', err)
      setError(err.message || 'Failed to add user')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingUser) return

    setError('')
    setSuccess('')
    setLoading(true)

    try {
      const response = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: editingUser.id,
          email: newEmail || editingUser.email,
          name: newName || editingUser.user_metadata?.name,
          password: newPassword || undefined
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update user')
      }

      setSuccess('User updated successfully!')
      setNewEmail('')
      setNewPassword('')
      setNewName('')
      setEditingUser(null)

      // Refresh user list
      setTimeout(() => {
        fetchUsers()
        setSuccess('')
      }, 2000)
    } catch (err: any) {
      console.error('Error updating user:', err)
      setError(err.message || 'Failed to update user')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return
    }

    try {
      setLoading(true)
      setError('')

      const response = await fetch(`/api/admin/users?userId=${userId}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete user')
      }

      setSuccess('User deleted successfully!')

      // Refresh user list
      setTimeout(() => {
        fetchUsers()
        setSuccess('')
      }, 2000)
    } catch (err: any) {
      setError(err.message || 'Failed to delete user')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never'
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <DashboardLayout>
      <div className="p-4">
        <div className="mb-3 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
            <p className="text-sm text-gray-600">Manage users and system settings</p>
          </div>
          <button
            onClick={() => setShowAddUser(!showAddUser)}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
          >
            {showAddUser ? 'Cancel' : 'Add User'}
          </button>
        </div>

        {/* Success/Error Messages */}
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

        <div className="bg-white rounded-lg shadow-sm">
          {/* Add User Form */}
          {showAddUser && (
            <div className="p-4 border-b border-gray-200 bg-gray-50">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Add New User</h2>
              <form onSubmit={handleAddUser} className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-0.5">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      required
                      className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="John Doe"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-0.5">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      required
                      className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="user@example.com"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-0.5">
                      Initial Password
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      minLength={6}
                      className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Min 6 characters"
                    />
                  </div>
                </div>
                <div className="flex space-x-3">
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
                  >
                    {loading ? 'Adding...' : 'Add User'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddUser(false)}
                    className="px-4 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Users Table */}
          <div className="p-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">User Management</h2>

            {loading && users.length === 0 ? (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent"></div>
                <p className="mt-2 text-sm text-gray-600">Loading users...</p>
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 rounded-lg">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                <p className="mt-2 text-sm text-gray-600">No users found</p>
                <p className="text-xs text-gray-500 mt-1">Note: User list requires profiles table setup</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Email
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Created
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Last Sign In
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {users.map((user) => (
                      <tr key={user.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {user.email}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {user.user_metadata?.name || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {formatDate(user.created_at)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {formatDate(user.last_sign_in_at)}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <div className="flex space-x-2">
                            <button
                              onClick={() => {
                                setEditingUser(user)
                                setNewEmail(user.email)
                                setNewName(user.user_metadata?.name || '')
                                setNewPassword('')
                              }}
                              className="text-blue-600 hover:text-blue-800 font-medium"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteUser(user.id)}
                              className="text-red-600 hover:text-red-800 font-medium"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Edit User Modal */}
        {editingUser && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-900">Edit User</h2>
                <button
                  onClick={() => {
                    setEditingUser(null)
                    setNewEmail('')
                    setNewName('')
                    setNewPassword('')
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleUpdateUser} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="John Doe"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="user@example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    New Password <span className="text-gray-500 text-xs">(leave blank to keep current)</span>
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    minLength={6}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Min 6 characters"
                  />
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
                  >
                    {loading ? 'Updating...' : 'Update User'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingUser(null)
                      setNewEmail('')
                      setNewName('')
                      setNewPassword('')
                    }}
                    className="px-4 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
