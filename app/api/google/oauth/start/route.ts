import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const redirectUri = process.env.GOOGLE_REDIRECT_URI

  if (!clientId || !redirectUri) {
    return NextResponse.json(
      { error: 'Google OAuth not configured' },
      { status: 500 }
    )
  }

  // Get user ID from query parameter (passed from client)
  const searchParams = request.nextUrl.searchParams
  const userId = searchParams.get('userId')

  if (!userId) {
    console.error('[Google OAuth Start] No userId provided in query parameter')
    return NextResponse.redirect(
      new URL('/login?error=no_user_id', request.url)
    )
  }

  console.log('[Google OAuth Start] User ID from query:', userId)

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
