import { NextRequest, NextResponse } from 'next/server'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

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
    const response = await fetch('https://api.mycase.com/oauth/token', {
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

    // TODO: Save updated tokens
    return newTokens
  }

  return tokens
}

export async function GET(request: NextRequest) {
  try {
    // Read tokens from mycase_tokens.json (from parent mycase-document-downloader project)
    const tokensPath = join(process.cwd(), '..', 'mycase-document-downloader', 'mycase_tokens.json')

    if (!existsSync(tokensPath)) {
      return NextResponse.json(
        { error: 'MyCase tokens not found. Please complete OAuth flow first.' },
        { status: 404 }
      )
    }

    const tokensData = readFileSync(tokensPath, 'utf-8')
    let tokens: MyCaseTokens = JSON.parse(tokensData)

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
      throw new Error(`MyCase API error: ${response.statusText}`)
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
