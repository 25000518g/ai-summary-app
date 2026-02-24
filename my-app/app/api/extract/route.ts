import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Handle TXT file extraction
    if (file.type === 'text/plain') {
      const text = await file.text();
      return NextResponse.json({
        text: text,
        pageCount: 1,
        fileName: file.name,
      });
    }
    
    // Handle PDF extraction - simplified approach for server-side
    if (file.type === 'application/pdf') {
      // For PDFs, we'll implement extraction on the client-side instead
      // This avoids server-side pdfjs requirements during build
      return NextResponse.json(
        { 
          error: 'PDF extraction should be performed client-side. Please use the Extract Text button on PDFs in the viewer.',
          hint: 'Open the PDF in the viewer, then click Extract Text'
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Unsupported file type. Please upload .txt or .pdf files only.' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('Text extraction error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to extract text' },
      { status: 500 }
    );
  }
}

