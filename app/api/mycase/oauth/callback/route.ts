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

  if (error) {
    return new NextResponse(
      `<html><body><h1>OAuth Error</h1><p>${error}</p></body></html>`,
      { headers: { 'Content-Type': 'text/html' } }
    )
  }

  if (!code) {
    return new NextResponse(
      '<html><body><h1>Error</h1><p>No authorization code received</p></body></html>',
      { headers: { 'Content-Type': 'text/html' } }
    )
  }

  try {
    const clientId = process.env.MYCASE_CLIENT_ID
    const clientSecret = process.env.MYCASE_CLIENT_SECRET
    const redirectUri = process.env.MYCASE_REDIRECT_URI || `${request.nextUrl.origin}/api/mycase/oauth/callback`

    if (!clientId || !clientSecret) {
      throw new Error('MyCase credentials not configured')
    }

    // Exchange code for tokens
    const tokenResponse = await fetch('https://auth.mycase.com/tokens', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    })

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      throw new Error(`Token exchange failed: ${errorText}`)
    }

    const tokenData = await tokenResponse.json()

    // Calculate expiration timestamp
    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString()

    // Save tokens to Supabase (upsert to keep only one row)
    const { error: dbError } = await supabase
      .from('mycase_oauth_tokens')
      .upsert({
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'id',
        ignoreDuplicates: false
      })

    if (dbError) {
      // Try insert if upsert fails
      const { error: insertError } = await supabase
        .from('mycase_oauth_tokens')
        .insert({
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          expires_at: expiresAt,
        })

      if (insertError) {
        throw new Error(`Failed to save tokens: ${insertError.message}`)
      }
    }

    return new NextResponse(
      `<html>
        <body style="font-family: system-ui; max-width: 600px; margin: 100px auto; text-align: center;">
          <div style="background: #10b981; color: white; padding: 20px; border-radius: 10px; margin-bottom: 20px;">
            <h1 style="margin: 0;">✓ MyCase Connected Successfully!</h1>
          </div>
          <p style="color: #666; margin-bottom: 30px;">You can now close this window and return to the Evidence Tracker.</p>
          <a href="/dashboard" style="background: #10b981; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; display: inline-block;">
            Go to Dashboard
          </a>
        </body>
      </html>`,
      { headers: { 'Content-Type': 'text/html' } }
    )

  } catch (error: any) {
    console.error('OAuth callback error:', error)
    return new NextResponse(
      `<html>
        <body style="font-family: system-ui; max-width: 600px; margin: 100px auto; text-align: center;">
          <div style="background: #ef4444; color: white; padding: 20px; border-radius: 10px; margin-bottom: 20px;">
            <h1 style="margin: 0;">OAuth Error</h1>
          </div>
          <p style="color: #666;">${error.message}</p>
          <a href="/dashboard" style="background: #6b7280; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; display: inline-block; margin-top: 20px;">
            Back to Dashboard
          </a>
        </body>
      </html>`,
      { headers: { 'Content-Type': 'text/html' } }
    )
  }
}
