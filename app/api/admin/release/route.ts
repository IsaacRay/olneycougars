import { NextResponse } from 'next/server';
import { getUser, isAdmin } from '../../../lib/simpleAuth';
import { createClient } from '../../../utils/supabase/server';

export async function POST(request: Request) {
  const user = await getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  if (!isAdmin(user.email)) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }

  const { email } = await request.json();

  if (!email || typeof email !== 'string') {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 });
  }

  const supabase = await createClient();

  // Delete all squares for this user
  const { error: deleteError, count } = await supabase
    .from('superbowl_squares')
    .delete()
    .eq('email', email.toLowerCase())
    .select();

  if (deleteError) {
    console.error('Failed to release squares:', deleteError);
    return NextResponse.json({ error: 'Failed to release squares' }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    message: `Released ${count || 0} squares for ${email}`,
  });
}
