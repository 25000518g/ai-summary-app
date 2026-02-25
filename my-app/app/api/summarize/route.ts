import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  try {
    const { text, fileName } = await req.json();

    if (!text) {
      return NextResponse.json({ error: 'No text provided' }, { status: 400 });
    }

    const aiProvider = (process.env.AI_PROVIDER || 'openai').toLowerCase();
    const truncated = String(text).substring(0, 8000);
    let summary = '';

    if (aiProvider === 'github') {
      const githubApiUrl = process.env.GITHUB_MODEL_API_URL;
      const githubKey = process.env.GITHUB_MODEL_API_KEY;
      if (!githubApiUrl || !githubKey) {
        throw new Error('GITHUB_MODEL_API_URL or GITHUB_MODEL_API_KEY not configured');
      }

      const resp = await fetch(githubApiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${githubKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: process.env.GITHUB_MODEL_NAME || 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'You are a helpful assistant that creates concise summaries of documents.' },
            { role: 'user', content: `Please summarize the following document (${fileName}):\n\n${truncated}` },
          ],
          temperature: 0.7,
          max_completion_tokens: 1000,
        }),
      });

      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error?.message || 'GitHub Model API error');
      summary = data.choices?.[0]?.message?.content || 'Failed to generate summary';
    } else if (aiProvider === 'openai') {
      const key = process.env.OPENAI_API_KEY;
      if (!key) throw new Error('OPENAI_API_KEY not configured');

      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'You are a helpful assistant that creates concise summaries of documents.' },
            { role: 'user', content: `Please summarize the following document (${fileName}):\n\n${truncated}` },
          ],
          temperature: 0.7,
          max_tokens: 1000,
        }),
      });

      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error?.message || 'OpenAI API error');
      summary = data.choices?.[0]?.message?.content || 'Failed to generate summary';
    } else if (aiProvider === 'openrouter') {
      const key = process.env.OPENROUTER_API_KEY;
      if (!key) throw new Error('OPENROUTER_API_KEY not configured');
      const model = process.env.OPENROUTER_MODEL || 'stepfun/step-3.5-flash:free';

      // First OpenRouter call with reasoning enabled
      const resp1 = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: 'You are a helpful assistant that creates concise summaries of documents.' },
            { role: 'user', content: `Please summarize the following document (${fileName}):\n\n${truncated}` },
          ],
          reasoning: { enabled: true },
        }),
      });

      let res1Json;
      try {
        res1Json = await resp1.json();
      } catch (err) {
        const text = await resp1.text();
        throw new Error('OpenRouter did not return JSON: ' + text.slice(0, 200));
      }
      if (!resp1.ok) throw new Error(res1Json.error?.message || 'OpenRouter API error');

      const firstMessage = res1Json.choices?.[0]?.message || {};

      // Preserve reasoning_details and continue the conversation
      const messages = [
        { role: 'system', content: 'You are a helpful assistant that creates concise summaries of documents.' },
        { role: 'user', content: `Please summarize the following document (${fileName}):\n\n${truncated}` },
        { role: 'assistant', content: firstMessage.content, reasoning_details: firstMessage.reasoning_details },
        { role: 'user', content: 'Please continue your reasoning and provide a final concise summary.' },
      ];

      const resp2 = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ model, messages }),
      });

      const res2 = await resp2.json();
      if (!resp2.ok) throw new Error(res2.error?.message || 'OpenRouter API error');
      summary = res2.choices?.[0]?.message?.content || 'Failed to generate summary';
    } else {
      throw new Error(`Unsupported AI_PROVIDER: ${aiProvider}. Supported providers: github, openai, openrouter`);
    }

    // Attempt to save summary to Supabase Postgres (optional)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    let saved = false;
    let record: any = null;

    if (supabaseUrl && supabaseKey) {
      try {
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Try to get public URL for the file in storage (if it exists)
        let fileUrl: string | null = null;
        try {
          const { data: urlData } = supabase.storage.from('documents').getPublicUrl(fileName || '');
          fileUrl = urlData?.publicUrl || null;
        } catch (err) {
          // ignore
        }

        // Insert into a table named 'summaries' (schema: file_name, summary, model, file_url)
        const { data: insertData, error: insertError } = await supabase
          .from('summaries')
          .insert([{ file_name: fileName || null, summary, model: aiProvider, file_url: fileUrl }])
          .select()
          .limit(1);

        if (insertError) {
          console.warn('Failed to save summary to Supabase:', insertError.message);
        } else {
          saved = true;
          record = insertData?.[0] ?? null;
        }
      } catch (err) {
        console.warn('Supabase save error:', err);
      }
    }

    return NextResponse.json({ summary, fileName, model: aiProvider, saved, record });
  } catch (error: any) {
    console.error('Summarization error:', error);
    return NextResponse.json({ error: error.message || 'Failed to generate summary' }, { status: 500 });
  }
}
