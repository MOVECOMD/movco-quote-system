import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const companyId = searchParams.get('company_id');

  if (!companyId) {
    return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('email_connections')
    .select('provider, email_address, connected_at')
    .eq('company_id', companyId)
    .eq('provider', 'gmail')
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: 'Failed to check connection' }, { status: 500 });
  }

  return NextResponse.json({
    connected: !!data,
    email_address: data?.email_address || null,
    connected_at: data?.connected_at || null,
  });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const companyId = searchParams.get('company_id');

  if (!companyId) {
    return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('email_connections')
    .delete()
    .eq('company_id', companyId)
    .eq('provider', 'gmail');

  if (error) {
    return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}