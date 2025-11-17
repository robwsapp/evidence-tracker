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
}

interface MyCaseCase {
  id: number
  case_number: string
  name: string
  clients: MyCaseClient[]
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

    // Fetch ALL cases from MyCase API with Link header pagination
    // Use MyCase external integrations API (NOT self-hosted URL)
    let allCases: MyCaseCase[] = []
    let nextPageToken: string | null = null
    let pageCount = 0

    console.log('[MyCase API] Starting to fetch all cases...')

    do {
      pageCount++
      const mycaseApiUrl = new URL('https://external-integrations.mycase.com/v1/cases')
      mycaseApiUrl.searchParams.set('page_size', '100')
      // Request client fields explicitly (API only returns id by default)
      mycaseApiUrl.searchParams.set('field[client]', 'id,first_name,last_name')
      if (nextPageToken) {
        mycaseApiUrl.searchParams.set('page_token', nextPageToken)
      }

      console.log(`[MyCase API] Fetching page ${pageCount} from:`, mycaseApiUrl.toString())

      const response = await fetch(mycaseApiUrl.toString(), {
        headers: {
          'Authorization': `Bearer ${tokens.access_token}`,
          'Accept': 'application/json',
        },
      })

      console.log(`[MyCase API] Page ${pageCount} response status:`, response.status)
      const itemCount = response.headers.get('Item-Count')
      const linkHeader = response.headers.get('Link')
      console.log(`[MyCase API] Item-Count header: ${itemCount}`)
      console.log(`[MyCase API] Link header: ${linkHeader}`)

      if (!response.ok) {
        const errorText = await response.text()
        console.error('[MyCase API] Error response:', errorText)
        throw new Error(`MyCase API error: ${response.status} - ${errorText}`)
      }

      const cases: MyCaseCase[] = await response.json()
      allCases = allCases.concat(cases)

      // Parse Link header to get next page_token
      // Format: <https://...?page_token=abc>; rel="next"
      nextPageToken = null
      if (linkHeader) {
        const linkMatch = linkHeader.match(/<[^>]*[?&]page_token=([^&>]+)[^>]*>;\s*rel="next"/)
        if (linkMatch) {
          nextPageToken = linkMatch[1]
        }
      }

      console.log(`[MyCase API] Page ${pageCount}: Fetched ${cases.length} cases, Total: ${allCases.length}, Next page token: ${nextPageToken ? 'exists' : 'none'}`)

    } while (nextPageToken)

    console.log(`[MyCase API] Finished fetching all cases. Total: ${allCases.length} cases across ${pageCount} pages`)

    // Format clients for frontend, sorted by newest first
    const clients = allCases
      .map(caseItem => {
        // Get primary client from the clients array (not contacts)
        const primaryClient = caseItem.clients?.[0]
        const clientName = primaryClient
          ? `${primaryClient.first_name || ''} ${primaryClient.last_name || ''}`.trim()
          : 'Unknown Client'

        return {
          id: caseItem.id,
          name: clientName,
          case_number: caseItem.case_number || 'No Case Number',
          case_name: caseItem.name, // Keep case name for search
          updated_at: caseItem.updated_at,
        }
      })
      // Sort by most recently updated first
      .sort((a, b) => {
        const dateA = new Date(a.updated_at || 0).getTime()
        const dateB = new Date(b.updated_at || 0).getTime()
        return dateB - dateA
      })

    return NextResponse.json({ clients })

  } catch (error: any) {
    console.error('Error fetching MyCase clients:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch clients' },
      { status: 500 }
    )
  }
}
