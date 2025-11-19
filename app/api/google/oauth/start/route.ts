import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const redirectUri = process.env.GOOGLE_REDIRECT_URI

  if (!clientId || !redirectUri) {
    return NextResponse.json(
      { error: 'Google OAuth not configured' },
      { status: 500 }
    )
  }

  // Get user from cookies
  const cookieStore = request.cookies
  const allCookies = cookieStore.getAll()

  // Find the auth token cookie
  const authTokenCookie = allCookies.find(cookie =>
    cookie.name.startsWith('sb-') && cookie.name.endsWith('-auth-token')
  )

  if (!authTokenCookie) {
    console.error('[Google OAuth Start] No auth token cookie found')
    return NextResponse.redirect(
      new URL('/login?error=not_logged_in', request.url)
    )
  }

  // Parse JWT to get user ID
  let userId: string
  try {
    const tokenParts = authTokenCookie.value.split('.')
    const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString())
    userId = payload.sub

    if (!userId) {
      throw new Error('No user ID in token')
    }
  } catch (error) {
    console.error('[Google OAuth Start] Error parsing token:', error)
    return NextResponse.redirect(
      new URL('/login?error=invalid_session', request.url)
    )
  }

  console.log('[Google OAuth Start] User ID:', userId)

  // Google OAuth authorization URL with state parameter containing user ID
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  authUrl.searchParams.set('client_id', clientId)
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('scope', 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.readonly')
  authUrl.searchParams.set('access_type', 'offline')
  authUrl.searchParams.set('prompt', 'consent')
  authUrl.searchParams.set('state', userId) // Pass user ID in state parameter

  return NextResponse.redirect(authUrl.toString())
}
