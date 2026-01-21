import { NextResponse } from 'next/server';
import { getUser, isAdmin } from '../../../lib/simpleAuth';
import { createClient } from '../../../utils/supabase/server';

export async function GET() {
  const user = await getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  if (!isAdmin(user.email)) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from('superbowl_scores')
    .select('*')
    .single();

  if (error && error.code !== 'PGRST116') {
    // PGRST116 is "no rows returned" which is fine
    console.error('Failed to fetch scores:', error);
    return NextResponse.json({ error: 'Failed to fetch scores' }, { status: 500 });
  }

  return NextResponse.json({ scores: data || null });
}

export async function POST(request: Request) {
  const user = await getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  if (!isAdmin(user.email)) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }

  const body = await request.json();
  const { q1_afc, q1_nfc, q2_afc, q2_nfc, q3_afc, q3_nfc, q4_afc, q4_nfc } = body;

  // Validate that all provided values are valid integers or null
  const fields = { q1_afc, q1_nfc, q2_afc, q2_nfc, q3_afc, q3_nfc, q4_afc, q4_nfc };
  for (const [key, value] of Object.entries(fields)) {
    if (value !== null && value !== undefined && value !== '') {
      const num = Number(value);
      if (!Number.isInteger(num) || num < 0) {
        return NextResponse.json({ error: `Invalid value for ${key}` }, { status: 400 });
      }
    }
  }

  const supabase = await createClient();

  // Convert empty strings to null
  const toIntOrNull = (v: unknown): number | null => {
    if (v === null || v === undefined || v === '') return null;
    return Number(v);
  };

  const scoreData = {
    id: 1,
    q1_afc: toIntOrNull(q1_afc),
    q1_nfc: toIntOrNull(q1_nfc),
    q2_afc: toIntOrNull(q2_afc),
    q2_nfc: toIntOrNull(q2_nfc),
    q3_afc: toIntOrNull(q3_afc),
    q3_nfc: toIntOrNull(q3_nfc),
    q4_afc: toIntOrNull(q4_afc),
    q4_nfc: toIntOrNull(q4_nfc),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('superbowl_scores')
    .upsert(scoreData)
    .select()
    .single();

  if (error) {
    console.error('Failed to update scores:', error);
    return NextResponse.json({ error: 'Failed to update scores' }, { status: 500 });
  }

  return NextResponse.json({ scores: data });
}
