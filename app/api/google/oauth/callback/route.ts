import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Use service role key for server-side operations (bypasses RLS)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const error = searchParams.get('error')
  const state = searchParams.get('state') // User ID passed from start endpoint

  if (error) {
    return NextResponse.redirect(
      new URL(`/dashboard?google_error=${encodeURIComponent(error)}`, request.url)
    )
  }

  if (!code) {
    return NextResponse.redirect(
      new URL('/dashboard?google_error=no_code', request.url)
    )
  }

  if (!state) {
    console.error('[Google OAuth] No state parameter (user ID) found')
    return NextResponse.redirect(
      new URL('/login?google_error=no_user_id', request.url)
    )
  }

  const userId = state
  console.log('[Google OAuth] Received user ID from state:', userId)

  try {
    // Exchange authorization code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
        grant_type: 'authorization_code',
      }),
    })

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text()
      console.error('[Google OAuth] Token exchange failed:', errorData)
      throw new Error('Failed to exchange code for tokens')
    }

    const tokens = await tokenResponse.json()

    // Calculate expiration time
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

    // Save tokens to database (upsert based on user_id) using service role to bypass RLS
    const { error: dbError } = await supabase
      .from('google_oauth_tokens')
      .upsert({
        user_id: userId,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: expiresAt,
        scope: tokens.scope,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id'
      })

    if (dbError) {
      console.error('[Google OAuth] Database error:', dbError)
      throw new Error('Failed to save tokens')
    }

    console.log('[Google OAuth] Successfully connected Google Drive for user:', userId)

    // Redirect back to dashboard with success
    return NextResponse.redirect(
      new URL('/dashboard?google_connected=true', request.url)
    )

  } catch (err: any) {
    console.error('[Google OAuth] Error:', err)
    return NextResponse.redirect(
      new URL(`/dashboard?google_error=${encodeURIComponent(err.message)}`, request.url)
    )
  }
}
