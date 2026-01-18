import { NextResponse } from 'next/server';
import { getUser, isAdmin } from '../../../lib/simpleAuth';

export async function GET() {
  const user = await getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  return NextResponse.json({
    email: user.email,
    isAdmin: isAdmin(user.email)
  });
}
