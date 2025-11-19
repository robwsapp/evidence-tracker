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

export async function POST(request: NextRequest) {
  try {
    // Parse multipart form data first to get userId
    const formData = await request.formData()
    const userId = formData.get('userId') as string

    if (!userId) {
      console.error('[Google Drive] No userId provided')
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    console.log('[Google Drive] Uploading file for user:', userId)

    // Get Google tokens from database using service role (bypasses RLS)
    const { data: tokenData, error: tokenError } = await supabase
      .from('google_oauth_tokens')
      .select('*')
      .eq('user_id', userId)
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

    // Get file data from form (already parsed above)
    const file = formData.get('file') as File
    const folderId = formData.get('folderId') as string
    const fileName = formData.get('fileName') as string

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    if (!folderId) {
      return NextResponse.json(
        { error: 'No folder ID provided' },
        { status: 400 }
      )
    }

    console.log(`[Google Drive] Uploading file: ${fileName} to folder: ${folderId}`)

    // Get file buffer
    const fileBuffer = await file.arrayBuffer()

    // Step 1: Create file metadata
    const metadata = {
      name: fileName || file.name,
      parents: [folderId],
    }

    // Step 2: Upload using multipart upload
    const boundary = '-------314159265358979323846'
    const delimiter = `\r\n--${boundary}\r\n`
    const closeDelimiter = `\r\n--${boundary}--`

    const metadataPart = delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata)

    const filePart = delimiter +
      `Content-Type: ${file.type}\r\n\r\n`

    const multipartBody = new Blob([
      metadataPart,
      filePart,
      fileBuffer,
      closeDelimiter
    ])

    const uploadResponse = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartBody,
    })

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text()
      console.error('[Google Drive] Upload error:', errorText)
      throw new Error(`Failed to upload file: ${uploadResponse.status}`)
    }

    const uploadedFile = await uploadResponse.json()

    console.log(`[Google Drive] Successfully uploaded file: ${uploadedFile.name} (${uploadedFile.id})`)

    return NextResponse.json({
      success: true,
      file: uploadedFile,
    })

  } catch (error: any) {
    console.error('[Google Drive] Error uploading file:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to upload file' },
      { status: 500 }
    )
  }
}
