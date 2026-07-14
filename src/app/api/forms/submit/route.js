import { NextResponse } from 'next/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dzlmtvodpyhetvektfuo.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function POST(request) {
  try {
    const body = await request.json();
    const { brand_key, form_type, ...formData } = body;

    if (!brand_key || !form_type || !formData.email) {
      return NextResponse.json(
        { error: 'brand_key, form_type and email are required' },
        { status: 400 },
      );
    }

    const fullName = formData.full_name
      || [formData.first_name, formData.last_name].filter(Boolean).join(' ');

    const response = await fetch(`${SUPABASE_URL}/rest/v1/form_submissions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        brand_key,
        form_type,
        full_name: fullName || '',
        email: formData.email,
        phone: formData.phone || '',
        form_data: formData,
        source: `${brand_key}_website_${form_type}`,
        workflow_status: 'sheet_sync_pending',
        ip_address: request.headers.get('x-forwarded-for') || 'unknown',
        user_agent: request.headers.get('user-agent') || '',
        referer: request.headers.get('referer') || '',
      }),
    });

    if (!response.ok) {
      console.error('Supabase form submission failed', await response.text());
      return NextResponse.json(
        { error: 'We could not save your application. Please try again.' },
        { status: 502 },
      );
    }

    const [submission] = await response.json();
    return NextResponse.json({
      success: true,
      message: 'Application submitted successfully',
      id: submission?.id || null,
      application_number: submission?.id ? `SOS-${submission.id}` : 'SOS-SUBMITTED',
      sync_status: 'sheet_sync_pending',
    });
  } catch (error) {
    console.error('Form submission error', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
