import { NextResponse } from 'next/server';
import { logout } from '../../../lib/simpleAuth';

export async function POST() {
  await logout();
  return NextResponse.json({ success: true });
}
