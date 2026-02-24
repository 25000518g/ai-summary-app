import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function DELETE(request: Request) {
  try {
    const { fileName } = await request.json();

    if (!fileName) {
      return NextResponse.json(
        { error: 'File name is required' },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: 'Supabase not configured' },
        { status: 511 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Delete file from the 'documents' bucket
    const { error } = await supabase.storage
      .from('documents')
      .remove([fileName]);

    if (error) {
      return NextResponse.json(
        { error: `Failed to delete file: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, message: `File ${fileName} deleted successfully` });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
