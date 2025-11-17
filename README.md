# Evidence Tracker

A web-based evidence management system for immigration law firms. Track, organize, and report on evidence received from clients with integration to MyCase.

## Features

- **Evidence Logging** - Record evidence received with client info, date, type, source, and notes
- **MyCase Integration** - Pull client list directly from MyCase via OAuth
- **File Management** - Upload files to Supabase Storage with automatic naming: `ClientName-CaseNumber-EvidenceType-Date.pdf`
- **File Renaming** - Customize file names before uploading
- **Admin Dashboard** - View all evidence logs with powerful filtering and sorting
- **Reporting** - Export data to CSV, view statistics (total pieces, unique clients, etc.)
- **Folder Download** - Download all files for a specific client/case
- **Secure Authentication** - Supabase Auth for staff login

## Tech Stack

- **Frontend:** Next.js 14 (App Router) + React 19 + TypeScript
- **Styling:** Tailwind CSS
- **Database:** Supabase (PostgreSQL)
- **Storage:** Supabase Storage
- **Authentication:** Supabase Auth
- **Deployment:** Vercel
- **Integration:** MyCase API

## Prerequisites

- Node.js 18+
- Supabase account
- MyCase account with OAuth app configured
- Vercel account (for deployment)

## Setup Instructions

### 1. Supabase Setup

#### Create Supabase Project
1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Create a new project
3. Note your Project URL and anon/public API key

#### Run Database Schema
1. In Supabase Dashboard, go to SQL Editor
2. Open the file `supabase-schema.sql` from this project
3. Copy and paste the entire SQL script
4. Click "Run" to create tables, indexes, policies, and storage bucket

#### Create Staff Users
1. In Supabase Dashboard, go to Authentication → Users
2. Click "Add User" → "Create new user"
3. Enter email and password for each staff member
4. Users can now log in with these credentials

### 2. MyCase OAuth Setup

This project integrates with the existing MyCase OAuth tokens from `mycase-document-downloader`.

#### Option A: Use Existing Tokens
If you've already set up `mycase-document-downloader`:
1. Ensure `mycase_tokens.json` exists in the `../mycase-document-downloader/` directory
2. The Evidence Tracker will automatically use those tokens

#### Option B: Set Up Fresh OAuth
1. Complete the OAuth setup from `mycase-document-downloader` first
2. Visit the OAuth start endpoint to generate tokens
3. Tokens will be saved to `mycase_tokens.json`

### 3. Environment Variables

Create a `.env.local` file in the project root:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# MyCase OAuth Configuration
MYCASE_CLIENT_ID=your_mycase_client_id
MYCASE_CLIENT_SECRET=your_mycase_client_secret
MYCASE_REDIRECT_URI=http://localhost:3000/api/mycase/callback
```

### 4. Install Dependencies

```bash
npm install
```

### 5. Run Development Server

```bash
npm run dev
```

Visit `http://localhost:3000` to access the application.

## Usage Guide

### Logging Evidence

1. **Login** - Use credentials created in Supabase Auth
2. **Load Clients** - Click "Load Clients" to fetch from MyCase
3. **Select Client** - Choose client from dropdown
4. **Fill Form** - Enter:
   - Date received
   - Number of pieces
   - Evidence type (or "Other" with custom input)
   - Source (Mail, Email, In-Person, etc.)
   - Notes (optional)
5. **Upload Files** - Select files to upload
6. **Rename Files** - Edit suggested file names if needed
7. **Submit** - Click "Log Evidence" to save

Files are automatically organized in Supabase Storage by folder: `ClientName-CaseNumber/`

### Admin Dashboard

1. Click "Admin Dashboard" from main screen
2. View statistics:
   - Total evidence logs
   - Total pieces of evidence
   - Unique clients
3. **Filter & Search:**
   - Search by client name or case number
   - Filter by evidence type, source, or staff member
   - Filter by date range
4. **Sort:** Click column headers to sort
5. **Export:** Click "Export to CSV" for Excel-compatible report
6. **Download Files:** Click "Download" to get all files for a client

## Project Structure

```
evidence-tracker/
├── app/
│   ├── admin/              # Admin dashboard page
│   ├── api/
│   │   └── mycase/
│   │       └── clients/    # MyCase API integration
│   ├── dashboard/          # Evidence logging form
│   ├── login/              # Login page
│   ├── layout.tsx          # Root layout
│   ├── page.tsx            # Home (redirect)
│   └── globals.css         # Global styles
├── lib/
│   └── supabase.ts         # Supabase client & types
├── public/                 # Static assets
├── .env.local              # Environment variables
├── supabase-schema.sql     # Database schema
├── package.json
├── tsconfig.json
├── tailwind.config.js
└── README.md
```

## Database Schema

### Tables

**evidence_logs**
- `id` (UUID, primary key)
- `created_at` (timestamp)
- `client_name` (text)
- `case_number` (text)
- `date_received` (date)
- `num_pieces` (integer)
- `evidence_type` (text)
- `source` (text)
- `notes` (text, nullable)
- `staff_email` (text)
- `mycase_client_id` (text, nullable)

**evidence_files**
- `id` (UUID, primary key)
- `created_at` (timestamp)
- `evidence_log_id` (UUID, foreign key)
- `file_name` (text)
- `file_path` (text)
- `file_size` (bigint)
- `original_name` (text)

### Storage Bucket

**evidence-files** - Stores all uploaded evidence files organized by `ClientName-CaseNumber/` folders

## Deployment to Vercel

### 1. Push to GitHub

```bash
cd evidence-tracker
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/yourusername/evidence-tracker.git
git push -u origin main
```

### 2. Deploy to Vercel

1. Visit [Vercel Dashboard](https://vercel.com)
2. Click "New Project"
3. Import your GitHub repository
4. Configure:
   - **Framework Preset:** Next.js
   - **Root Directory:** `./`
   - **Build Command:** `npm run build`
   - **Output Directory:** `.next`
5. Add Environment Variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `MYCASE_CLIENT_ID`
   - `MYCASE_CLIENT_SECRET`
   - `MYCASE_REDIRECT_URI` (update to production URL)
6. Click "Deploy"

### 3. Update MyCase Redirect URI

1. Go to MyCase Settings → API & Integrations
2. Update OAuth redirect URI to: `https://your-app.vercel.app/api/mycase/callback`
3. Re-run OAuth flow with production URL

## Troubleshooting

### "MyCase tokens not found"
- Complete OAuth flow in `mycase-document-downloader` first
- Ensure `mycase_tokens.json` exists
- Check file path in `app/api/mycase/clients/route.ts`

### "Failed to upload files"
- Verify Supabase storage bucket `evidence-files` exists
- Check storage policies are enabled (see `supabase-schema.sql`)
- Ensure user is authenticated

### "Cannot read clients from MyCase"
- Check OAuth tokens are valid and not expired
- Verify MyCase API credentials in `.env.local`
- Check MyCase API is accessible

### Login issues
- Verify users exist in Supabase Auth
- Check Supabase URL and anon key are correct
- Ensure RLS policies are enabled

## Security Notes

- Never commit `.env.local` to version control
- Use environment variables in Vercel for production secrets
- Supabase RLS policies ensure only authenticated users can access data
- All file uploads are private (not publicly accessible)
- Consider implementing role-based access control for admin features

## Future Enhancements

- [ ] Bulk upload with drag-and-drop
- [ ] Email notifications when evidence is logged
- [ ] Advanced reporting with charts
- [ ] File preview before download
- [ ] Audit log for all actions
- [ ] Mobile app version
- [ ] Direct MyCase document upload integration
- [ ] OCR for automatic document classification

## License

MIT

## Support

For issues or questions, contact your development team or create an issue in the GitHub repository.
