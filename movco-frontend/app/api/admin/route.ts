import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Use service role to bypass RLS for admin operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, table, id, data } = body;

    if (!['storage_partners', 'removals_partners', 'admin_users'].includes(table)) {
      return NextResponse.json({ error: 'Invalid table' }, { status: 400 });
    }

    if (action === 'toggle_active') {
      // Get current status
      const { data: current } = await supabaseAdmin
        .from(table)
        .select('active')
        .eq('id', id)
        .single();

      if (!current) {
        return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
      }

      const { error } = await supabaseAdmin
        .from(table)
        .update({ active: !current.active })
        .eq('id', id);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true, active: !current.active });
    }

    if (action === 'update') {
      const { error } = await supabaseAdmin
        .from(table)
        .update(data)
        .eq('id', id);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    if (action === 'insert') {
      const { error } = await supabaseAdmin
        .from(table)
        .insert(data);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    if (action === 'delete') {
      const { error } = await supabaseAdmin
        .from(table)
        .delete()
        .eq('id', id);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
