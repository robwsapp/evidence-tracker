import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface MyCaseTokens {
  access_token: string
  refresh_token: string
  expires_at: string
}

interface MyCaseContact {
  id: number
  first_name: string
  last_name: string
}

interface MyCaseCase {
  id: number
  case_number: string
  name: string
  contacts: MyCaseContact[]
}

// Helper to refresh token if needed
async function refreshTokenIfNeeded(tokens: MyCaseTokens): Promise<MyCaseTokens> {
  const expiresAt = new Date(tokens.expires_at)
  const now = new Date()

  // Refresh if token expires in less than 5 minutes
  if (expiresAt.getTime() - now.getTime() < 5 * 60 * 1000) {
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

    // Fetch cases from MyCase API
    const response = await fetch('https://api.mycase.com/v1/cases', {
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`,
        'Accept': 'application/json',
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`MyCase API error: ${response.status} - ${errorText}`)
    }

    const cases: MyCaseCase[] = await response.json()

    // Format clients for frontend
    const clients = cases.map(caseItem => {
      const primaryContact = caseItem.contacts?.[0]
      const clientName = primaryContact
        ? `${primaryContact.first_name} ${primaryContact.last_name}`
        : caseItem.name || 'Unknown Client'

      return {
        id: caseItem.id,
        name: clientName,
        case_number: caseItem.case_number,
      }
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
