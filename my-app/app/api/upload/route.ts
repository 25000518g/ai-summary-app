import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn('Supabase credentials not configured');
}

const supabase = supabaseUrl && supabaseKey 
  ? createClient(supabaseUrl, supabaseKey)
  : null;

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

    // Validate file type
    const fileType = file.type;
    if (fileType !== 'text/plain' && fileType !== 'application/pdf') {
      return NextResponse.json(
        { error: 'Invalid file type. Only TXT and PDF files are allowed.' },
        { status: 400 }
      );
    }

    // Check if Supabase is configured
    if (!supabase) {
      return NextResponse.json(
        { 
          error: 'Supabase is not configured. Please add SUPABASE credentials to .env.local',
          stored: false,
          message: 'File was not uploaded to Supabase storage'
        },
        { status: 511 } // Network Authentication Required
      );
    }

    // Use original filename
    const fileName = file.name;

    // Upload file to Supabase Storage
    const bucketName = 'documents';
    const buffer = await file.arrayBuffer();
    
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(fileName, buffer, {
        contentType: fileType,
        upsert: false,
      });

    if (error) {
      console.error('Supabase storage error:', error);
      return NextResponse.json(
        { 
          error: `Failed to upload file to Supabase: ${error.message}`,
          details: error
        },
        { status: 500 }
      );
    }

    // Get the public URL of the uploaded file
    const { data: { publicUrl } } = supabase.storage
      .from(bucketName)
      .getPublicUrl(fileName);

    return NextResponse.json({
      success: true,
      fileName: file.name,
      storagePath: fileName,
      publicUrl: publicUrl,
      fileSize: file.size,
      fileType: fileType,
      message: 'File uploaded successfully to Supabase',
    });

  } catch (error: any) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to upload file' },
      { status: 500 }
    );
  }
}
