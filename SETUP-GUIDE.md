# Evidence Tracker - Quick Setup Guide

## What You Have

A complete evidence tracking web application that's ready to deploy! Here's what's been built:

### Features
- Staff login system
- Load clients from MyCase
- Log evidence with file uploads
- Automatic file naming: `ClientName-CaseNumber-EvidenceType-Date.pdf`
- Admin dashboard with filtering, sorting, and reporting
- Export to CSV
- Download all files for a client

### Repository
Your code is now on GitHub: https://github.com/robwsapp/evidence-tracker

## Next Steps to Get Running

### Step 1: Set Up Supabase Database (5 minutes)

1. Go to your Supabase project: https://humvvanizmkssuzsueet.supabase.co
2. Click on **SQL Editor** in the left sidebar
3. Open the file `supabase-schema.sql` from your project
4. Copy the entire contents and paste into the SQL Editor
5. Click **Run** to create all tables and storage

### Step 2: Create Staff User Accounts (2 minutes)

1. In Supabase Dashboard, go to **Authentication** → **Users**
2. Click **Add User** → **Create new user**
3. Enter email and password for each staff member (2 users)
4. These credentials will be used to log into the Evidence Tracker

### Step 3: Update Environment Variables (2 minutes)

The `.env.local` file already has your Supabase credentials. You just need to add MyCase credentials:

```env
MYCASE_CLIENT_ID=your_actual_mycase_client_id
MYCASE_CLIENT_SECRET=your_actual_mycase_secret
```

Get these from your MyCase API settings or the existing `mycase-document-downloader` project.

### Step 4: Test Locally (5 minutes)

```bash
cd "C:\Users\erluser\OneDrive\Desktop\Mycase Downloader\evidence-tracker"
npm run dev
```

Visit http://localhost:3000 and:
1. Log in with one of the staff accounts you created
2. Click "Load Clients" to test MyCase integration
3. Try logging a piece of evidence
4. Check the Admin Dashboard

### Step 5: Deploy to Vercel (10 minutes)

1. Go to https://vercel.com and log in
2. Click **New Project**
3. Import from GitHub: `robwsapp/evidence-tracker`
4. Configure:
   - Framework: Next.js (auto-detected)
   - Root Directory: `./`
   - Build Command: `npm run build`
5. Add Environment Variables:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://humvvanizmkssuzsueet.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1bXZ2YW5pem1rc3N1enN1ZWV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMzOTUwNTIsImV4cCI6MjA3ODk3MTA1Mn0.kfOSDK1nOc-hWkXuZizAWCbvoX9cgHOfMBWlmiJeKUg
   MYCASE_CLIENT_ID=your_mycase_client_id
   MYCASE_CLIENT_SECRET=your_mycase_client_secret
   MYCASE_REDIRECT_URI=https://your-app.vercel.app/api/mycase/callback
   ```
6. Click **Deploy**

### Step 6: Update MyCase Redirect URI

After Vercel deploys, you'll get a URL like `https://evidence-tracker-xyz.vercel.app`

1. Go to MyCase Settings → API & Integrations
2. Update OAuth Redirect URI to: `https://your-vercel-url.vercel.app/api/mycase/callback`
3. Save

## Usage

### For Staff (Evidence Logging)

1. Log in at https://your-app.vercel.app
2. Click "Load Clients" to fetch from MyCase
3. Select a client from dropdown
4. Fill out the form:
   - Date received
   - Number of pieces
   - Evidence type
   - Source (Mail/Email/etc.)
   - Notes
5. Upload files (will auto-suggest names)
6. Edit file names if needed
7. Click "Log Evidence"

### For Admin (Reporting)

1. Log in and click "Admin Dashboard"
2. View statistics at the top
3. Use filters to search:
   - Client name
   - Case number
   - Evidence type
   - Source
   - Date range
4. Click column headers to sort
5. Click "Export to CSV" for reports
6. Click "Download" to get all files for a client

## Folder Structure

Files are organized in Supabase Storage:
```
evidence-files/
  ├── Maria-Gonzalez-12345/
  │   ├── Maria-Gonzalez-12345-Birth-Certificate-20251117.pdf
  │   └── Maria-Gonzalez-12345-Passport-20251117.pdf
  └── John-Smith-67890/
      └── John-Smith-67890-Photos-20251117.pdf
```

## Troubleshooting

### Can't load clients from MyCase
- Make sure MyCase OAuth is set up in `mycase-document-downloader`
- Check that `mycase_tokens.json` exists
- Verify MyCase credentials in `.env.local`

### Files not uploading
- Check Supabase storage bucket exists (run SQL schema)
- Verify storage policies are enabled
- Check user is logged in

### Can't log in
- Verify users exist in Supabase Auth
- Check Supabase credentials in `.env.local`

## What's Next?

You're ready to go! Once you complete the setup steps above, your team can start using the Evidence Tracker immediately.

### Optional Enhancements
- Add more evidence types to the dropdown
- Customize the file naming pattern
- Add email notifications
- Create automated reports
- Add more admin users

Need help? Check the full README.md or reach out to your development team.
