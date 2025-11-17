import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Use service role key for server-side operations (bypasses RLS)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface MyCaseTokens {
  access_token: string
  refresh_token: string
  expires_at: string
}

interface MyCaseClient {
  id: number
  first_name: string
  last_name: string
  email: string
}

interface MyCaseCase {
  id: number
  case_number: string
  name: string
  updated_at: string
}

// Helper to refresh token if needed
async function refreshTokenIfNeeded(tokens: MyCaseTokens): Promise<MyCaseTokens> {
  const expiresAt = new Date(tokens.expires_at)
  const now = new Date()

  // Refresh if token expires in less than 5 minutes
  if (expiresAt.getTime() - now.getTime() < 5 * 60 * 1000) {
    // Use centralized auth server for token refresh
    const response = await fetch('https://auth.mycase.com/tokens', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        refresh_token: tokens.refresh_token,
        client_id: process.env.MYCASE_CLIENT_ID,
        client_secret: process.env.MYCASE_CLIENT_SECRET,
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to refresh token')
    }

    const data = await response.json()
    const newTokens: MyCaseTokens = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    }

    // Save updated tokens to Supabase
    await supabase
      .from('mycase_oauth_tokens')
      .update({
        access_token: newTokens.access_token,
        refresh_token: newTokens.refresh_token,
        expires_at: newTokens.expires_at,
        updated_at: new Date().toISOString(),
      })
      .eq('id', (await supabase.from('mycase_oauth_tokens').select('id').single()).data?.id)

    return newTokens
  }

  return tokens
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get('query') || ''

    if (!query || query.trim().length === 0) {
      return NextResponse.json({ clients: [] })
    }

    // Read tokens from Supabase
    const { data: tokenData, error: tokenError } = await supabase
      .from('mycase_oauth_tokens')
      .select('*')
      .single()

    if (tokenError || !tokenData) {
      return NextResponse.json(
        {
          error: 'MyCase not connected. Please connect your MyCase account first.',
          needsOAuth: true,
          oauthUrl: '/api/mycase/oauth/start'
        },
        { status: 401 }
      )
    }

    let tokens: MyCaseTokens = {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: tokenData.expires_at,
    }

    // Refresh token if needed
    tokens = await refreshTokenIfNeeded(tokens)

    console.log('[MyCase Search] Searching for:', query)

    // Search for clients by name (split query into first/last name)
    const queryParts = query.trim().split(/\s+/)
    const firstName = queryParts[0]
    const lastName = queryParts.length > 1 ? queryParts[queryParts.length - 1] : ''

    // Build search URLs for different combinations
    const searchUrls: string[] = []

    // Search by first name only
    if (firstName) {
      const url = new URL('https://external-integrations.mycase.com/v1/clients')
      url.searchParams.set('filter[first_name]', firstName)
      url.searchParams.set('page_size', '50')
      searchUrls.push(url.toString())
    }

    // Search by last name only if provided
    if (lastName) {
      const url = new URL('https://external-integrations.mycase.com/v1/clients')
      url.searchParams.set('filter[last_name]', lastName)
      url.searchParams.set('page_size', '50')
      searchUrls.push(url.toString())
    }

    // Fetch clients from all search queries
    const allClients: MyCaseClient[] = []
    const clientIds = new Set<number>()

    for (const searchUrl of searchUrls) {
      console.log('[MyCase Search] Fetching:', searchUrl)

      const response = await fetch(searchUrl, {
        headers: {
          'Authorization': `Bearer ${tokens.access_token}`,
          'Accept': 'application/json',
        },
      })

      if (!response.ok) {
        console.error('[MyCase Search] Error:', response.status)
        continue
      }

      const clients: MyCaseClient[] = await response.json()

      // Deduplicate clients by ID
      for (const client of clients) {
        if (!clientIds.has(client.id)) {
          clientIds.add(client.id)
          allClients.push(client)
        }
      }
    }

    console.log('[MyCase Search] Found', allClients.length, 'unique clients')

    // For each client, fetch their cases
    const results = []

    for (const client of allClients) {
      // Fetch all cases for this client
      const casesUrl = new URL(`https://external-integrations.mycase.com/v1/clients/${client.id}/cases`)
      casesUrl.searchParams.set('page_size', '100')
      casesUrl.searchParams.set('field[client]', 'id,first_name,last_name')

      const casesResponse = await fetch(casesUrl.toString(), {
        headers: {
          'Authorization': `Bearer ${tokens.access_token}`,
          'Accept': 'application/json',
        },
      })

      if (!casesResponse.ok) {
        console.error(`[MyCase Search] Error fetching cases for client ${client.id}:`, casesResponse.status)
        continue
      }

      const cases: MyCaseCase[] = await casesResponse.json()

      // Create an entry for each case
      for (const caseItem of cases) {
        results.push({
          id: caseItem.id,
          name: `${client.first_name} ${client.last_name}`.trim(),
          case_number: caseItem.case_number || 'No Case Number',
          case_name: caseItem.name,
          updated_at: caseItem.updated_at,
        })
      }
    }

    // Sort by most recently updated first
    results.sort((a, b) => {
      const dateA = new Date(a.updated_at || 0).getTime()
      const dateB = new Date(b.updated_at || 0).getTime()
      return dateB - dateA
    })

    console.log('[MyCase Search] Returning', results.length, 'results')

    return NextResponse.json({ clients: results })

  } catch (error: any) {
    console.error('Error searching MyCase clients:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to search clients' },
      { status: 500 }
    )
  }
}
