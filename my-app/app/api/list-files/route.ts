import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { files: [], message: 'Supabase not configured' },
        { status: 511 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // List files in the 'documents' bucket
    const { data, error } = await supabase.storage
      .from('documents')
      .list('', {
        limit: 100,
        offset: 0,
        sortBy: { column: 'created_at', order: 'desc' },
      });

    if (error) {
      return NextResponse.json(
        { error: `Failed to list files: ${error.message}`, files: [] },
        { status: 500 }
      );
    }

    // Filter out folders and add public URLs
    const files = (data || [])
      .filter((item) => item.name && !item.metadata?.mimetype?.includes('directory'))
      .map((item) => {
        const { data: urlData } = supabase.storage
          .from('documents')
          .getPublicUrl(item.name);
        
        return {
          name: item.name,
          size: item.metadata?.size || 0,
          created_at: item.created_at,
          publicUrl: urlData.publicUrl,
        };
      });

    return NextResponse.json({ files, success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message, files: [] },
      { status: 500 }
    );
  }
}
