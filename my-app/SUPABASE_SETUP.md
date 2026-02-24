# Supabase Setup Guide

This guide explains how to set up Supabase for the AI Summary App to enable file uploads to cloud storage.

## Prerequisites

1. A Supabase account (free at https://supabase.com)
2. A Supabase project created

## Step 1: Get Your Supabase Credentials

1. Go to https://supabase.com and sign in to your account
2. Select your project from the dashboard
3. Go to **Settings → API** in the left sidebar
4. You'll find:
   - `Project URL` → This is your `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → This is your `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key (secret) → This is your `SUPABASE_SERVICE_ROLE_KEY`

## Step 2: Create a Storage Bucket

1. In your Supabase project, go to **Storage** in the left sidebar
2. Click **Create a new bucket**
3. Name it exactly: `documents`
4. Make sure to set permissions:
   - Enable **Public bucket** (if you want files to be publicly accessible)
   - Or configure fine-grained access controls as needed

## Step 3: Configure Environment Variables

1. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

2. Edit `.env.local` and fill in your Supabase credentials:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
   ```

3. Never commit `.env.local` to Git

## Step 4: Test File Uploads

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Navigate to http://localhost:3000

3. Upload a PDF or TXT file

4. You should see:
   - ✅ "Uploaded: filename to Supabase" on success
   - ⚠️ "Uploaded locally: filename (Supabase not configured)" if Supabase is not set up

5. Verify the file was uploaded:
   - Go to your Supabase project → Storage → documents bucket
   - You should see your uploaded file with a timestamp-based name

## Step 5: Deploy to Vercel

1. Add environment variables to your Vercel project:
   ```bash
   vercel env add NEXT_PUBLIC_SUPABASE_URL
   vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
   vercel env add SUPABASE_SERVICE_ROLE_KEY
   ```

2. Or use the Vercel dashboard:
   - Go to your project settings
   - Click **Environment Variables**
   - Add the three variables

3. Deploy:
   ```bash
   vercel --prod
   ```

## Troubleshooting

### "Supabase credentials not configured" warning during build
This is expected if you haven't set up environment variables. The app will gracefully fall back to local storage.

### Upload fails with status 511
This means Supabase is not configured. Add the environment variables and try again.

### "Failed to upload file to Supabase" error
1. Check that the `documents` bucket exists in your Supabase project
2. Verify your service role key is correct (it should be a long secret string)
3. Check your Supabase project has available storage (free tier has 1GB limit)

### Files are uploaded but not visible in Supabase Storage UI
This might be a permission issue. You may need to:
1. Check bucket policies in **Storage → Policies**
2. Ensure your service role key has `storage.objects:write` permission
3. Try making the bucket public if privacy isn't a concern

## Security Notes

- **`NEXT_PUBLIC_` variables**: Safe to expose in the browser (public keys)
- **`SUPABASE_SERVICE_ROLE_KEY`**: Private! Never commit or expose this key
- Always use `.env.local` and add it to `.gitignore`
- On Vercel, use the project settings to manage secrets
- Consider implementing RLS (Row Level Security) policies for production use

## Next Steps

After confirming file uploads work, implement database integration to:
- Store document metadata (filename, upload date, size)
- Link documents to their AI-generated summaries
- Track document processing history
