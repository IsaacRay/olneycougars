import { NextResponse } from 'next/server';
import { getUser, isAdmin } from '../../../lib/simpleAuth';
import { createClient } from '../../../utils/supabase/server';

export async function POST() {
  const user = await getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  if (!isAdmin(user.email)) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }

  const supabase = await createClient();

  // Delete the config row to clear generated numbers
  const { error } = await supabase
    .from('superbowl_config')
    .delete()
    .eq('id', 1);

  if (error) {
    console.error('Failed to clear numbers:', error);
    return NextResponse.json({ error: 'Failed to clear numbers' }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    message: 'Generated numbers have been cleared',
  });
}
