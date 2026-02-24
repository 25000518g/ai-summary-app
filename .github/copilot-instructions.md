# AI Summary App - Copilot Instructions

## Architecture Overview
This is a Next.js 16 app using the App Router for an AI-powered document summarization service. Key components:
- **Frontend**: Client-side file upload and PDF viewing in `app/page.tsx`
- **Backend**: API routes in `app/api/` for file upload, text extraction, and AI summarization
- **Storage**: Supabase Object Storage (S3-compatible) for storing uploaded PDF/TXT files
- **Database**: Supabase PostgreSQL (planned) - for storing documents metadata and summaries
- **AI Integration**: OpenAI/Anthropic for document text extraction and summarization
- **PDF Viewer**: Native HTML5 iframe for PDF preview, pdfjs-dist for client-side text extraction
**Deployment**: Vercel

## Architecture & Data flow
1. **Client Layer** ('app/page.tsx', 'app/components/*')
   - Split-pane UI: left for file upload, right for tabbed document viewer
   - Uploaded files are validated client-side (TXT/PDF only)
   - Tab-based viewer with three modes: PDF preview, extracted text, and AI summary
   - For PDFs, preview rendered using `react-pdf`; text extraction and summarization triggered by buttons
   - For TXT files, text is extracted directly in text tab;
   - For text tab, it cannot over display of the right panel.
   - State management: `useState` for files, extracted text, summary, loading states, errors, and active tab

2. **API Layer** ('app/api/*')
   - `/api/upload`: POST with FormData containing file; uploads to Supabase Storage bucket 'documents'; returns `{ success, fileName, storagePath, publicUrl, fileSize }`
   - `/api/extract`: Placeholder; text extraction is handled client-side using pdfjs-dist in `extractText()` function
   - `/api/summarize`: POST with `{ text, fileName }`; calls OpenAI or Anthropic (based on `AI_PROVIDER` env) and returns AI-generated summary

   3. AI Integration
   - 

## Key Patterns & Conventions
- **File Upload**: Validate file types (TXT/PDF only) in `handleFileUpload()` - check `file.type` against `'text/plain'` or `'application/pdf'`. POST FormData to `/api/upload`; Supabase stores with timestamp + random suffix filename
- **Supabase Storage**: Use `createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)` on server; upload to bucket 'documents'; get public URL with `getPublicUrl()`
- **PDF Viewing**: Use native HTML5 `<iframe>` with Blob URL for zero-dependency PDF preview
- **Text Extraction**: Client-side using `pdfjs-dist` for PDFs (call `getDocument()`, iterate pages with `getTextContent()`); native `.text()` for TXT files
- **AI Summarization**: POST extracted text to `/api/summarize`; respects `AI_PROVIDER` env var ('openai' or 'anthropic'); use respective API keys
- **Tab Management**: Use `activeTab` state (type `'pdf' | 'text' | 'summary'`) to control viewer mode; disable tabs until content is available
- **Error Handling**: Display user-friendly error messages for upload failures (Supabase not configured), extraction errors, and summarization errors
- **Styling**: Tailwind CSS v4 with custom CSS variables in `globals.css`; inline styles for complex layouts
- **State Management**: React `useState` for file lists, selected PDFs, viewer state, extracted text, summary, loading flags, error messages, and active tab

## Development Workflow
- **Local Dev**: `cd my-app && npm run dev` (runs on port 3000)
- **Build**: `npm run build` (outputs to `.next/`)
- **Deploy**: `cd my-app && vercel --prod` (requires Vercel CLI login)
- **API Testing**: Use `curl` for endpoints like `http://localhost:3000/api/health`

## Integration Points
- **Supabase**: For object storage (files) and database (metadata/summaries) - env vars: `.env.local` with `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (client), `SUPABASE_SERVICE_ROLE_KEY` (server-only)
- **AI Models**: API keys stored securely in environment variables (`OPENAI_API_KEY` or `ANTHROPIC_API_KEY`)
- **File Processing**: Client-side PDF text extraction using `pdfjs-dist` imported dynamically

## Common Tasks
- Adding API routes: Create `app/api/[endpoint]/route.ts` with named exports (GET, POST, etc.)
- File validation: Always check `file.type` and `file.size` before processing
- Error handling: Return `NextResponse.json()` with appropriate status codes
- Environment: Never commit `.env*` files; use `.env.example` as template
- File Upload to Supabase: `POST /api/upload` with FormData containing file; returns `{ success, fileName, storagePath, publicUrl, fileSize }`
- Text Extraction: Use client-side `pdfjs-dist.getDocument()` to extract from PDF files
- AI Summarization: Set `AI_PROVIDER` env var ('openai' or 'anthropic'); use `OPENAI_API_KEY` or `ANTHROPIC_API_KEY`; `POST /api/summarize` with `{ text, fileName }`

## File Structure Reference
- `app/page.tsx`: Main upload/viewer UI with tabbed viewer for PDF, text, and summary
- `app/api/health/route.ts`: Health check endpoint
- `app/api/upload/route.ts`: File upload endpoint (POST) - uploads files to Supabase Storage
- `app/api/extract/route.ts`: Text extraction endpoint (POST) - handles PDF and TXT files
- `app/api/summarize/route.ts`: AI summarization endpoint (POST) - calls OpenAI or Anthropic
- `app/layout.tsx`: Root layout with fonts
- `public/`: Static assets
- Root `.gitignore`: Excludes `.next/`, `node_modules/`, `.env*`</content>
<parameter name="filePath">/workspaces/ai-summary-app/.github/copilot-instructions.md

