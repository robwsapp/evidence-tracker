import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const clientId = process.env.MYCASE_CLIENT_ID
  const redirectUri = process.env.MYCASE_REDIRECT_URI || `${request.nextUrl.origin}/api/mycase/oauth/callback`

  if (!clientId) {
    return NextResponse.json(
      { error: 'MyCase client ID not configured' },
      { status: 500 }
    )
  }

  const authUrl = new URL('https://api.mycase.com/oauth/authorize')
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('client_id', clientId)
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('scope', 'read write')

  return NextResponse.redirect(authUrl.toString())
}
