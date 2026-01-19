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

  // Get all squares grouped by email
  const { data: squares, error } = await supabase
    .from('superbowl_squares')
    .select('email, locked');

  if (error) {
    console.error('Failed to fetch squares:', error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }

  // Group by email and count
  const userMap = new Map<string, { count: number; locked: boolean }>();
  squares.forEach((sq) => {
    const existing = userMap.get(sq.email);
    if (existing) {
      existing.count++;
      if (sq.locked) existing.locked = true;
    } else {
      userMap.set(sq.email, { count: 1, locked: sq.locked });
    }
  });

  const users = Array.from(userMap.entries()).map(([email, data]) => ({
    email,
    squareCount: data.count,
    locked: data.locked,
  }));

  // Sort by email
  users.sort((a, b) => a.email.localeCompare(b.email));

  return NextResponse.json({ users });
}
