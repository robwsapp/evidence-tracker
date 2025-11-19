import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface GoogleTokens {
  access_token: string
  refresh_token: string
  expires_at: string
  user_id: string
}

// Helper to refresh token if needed
async function refreshTokenIfNeeded(tokens: GoogleTokens): Promise<GoogleTokens> {
  const expiresAt = new Date(tokens.expires_at)
  const now = new Date()

  // Refresh if token expires in less than 5 minutes
  if (expiresAt.getTime() - now.getTime() < 5 * 60 * 1000) {
    console.log('[Google Drive] Refreshing expired token...')

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        refresh_token: tokens.refresh_token,
        grant_type: 'refresh_token',
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to refresh token')
    }

    const data = await response.json()
    const newExpiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString()

    // Update tokens in database
    await supabase
      .from('google_oauth_tokens')
      .update({
        access_token: data.access_token,
        expires_at: newExpiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', tokens.user_id)

    return {
      ...tokens,
      access_token: data.access_token,
      expires_at: newExpiresAt,
    }
  }

  return tokens
}

export async function GET(request: NextRequest) {
  try {
    // Get current user from cookie
    const cookieStore = request.cookies
    const accessToken = cookieStore.get('sb-humvvanizmkssuzsueet-auth-token')

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(accessToken.value)

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    // Get Google tokens from database
    const { data: tokenData, error: tokenError } = await supabase
      .from('google_oauth_tokens')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (tokenError || !tokenData) {
      return NextResponse.json(
        {
          error: 'Google Drive not connected',
          needsOAuth: true,
          oauthUrl: '/api/google/oauth/start'
        },
        { status: 401 }
      )
    }

    let tokens: GoogleTokens = {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: tokenData.expires_at,
      user_id: tokenData.user_id,
    }

    // Refresh token if needed
    tokens = await refreshTokenIfNeeded(tokens)

    const searchParams = request.nextUrl.searchParams
    const parentId = searchParams.get('parent') || 'root'

    // List folders in the specified parent folder
    const driveUrl = new URL('https://www.googleapis.com/drive/v3/files')
    driveUrl.searchParams.set('q', `'${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`)
    driveUrl.searchParams.set('fields', 'files(id, name, modifiedTime, iconLink), nextPageToken')
    driveUrl.searchParams.set('pageSize', '100')
    driveUrl.searchParams.set('orderBy', 'name')

    const response = await fetch(driveUrl.toString(), {
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`,
        'Accept': 'application/json',
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[Google Drive] API error:', errorText)
      throw new Error(`Google Drive API error: ${response.status}`)
    }

    const data = await response.json()

    return NextResponse.json({
      folders: data.files || [],
      parentId,
    })

  } catch (error: any) {
    console.error('[Google Drive] Error fetching folders:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch folders' },
      { status: 500 }
    )
  }
}
