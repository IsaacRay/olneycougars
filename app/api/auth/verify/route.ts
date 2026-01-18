import { NextRequest, NextResponse } from 'next/server';
import { verifyMagicLinkToken, setUser } from '../../../lib/simpleAuth';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  // Get base URL for redirects
  const baseUrl = process.env.NODE_ENV === 'production'
    ? 'https://olneycougars.com'  // Replace with your domain
    : (process.env.NEXTAUTH_URL || 'http://localhost:3000');

  if (!token) {
    return NextResponse.redirect(new URL('/login?error=invalid', baseUrl));
  }

  try {
    // Verify token and get email
    const email = await verifyMagicLinkToken(token);

    if (!email) {
      return NextResponse.redirect(new URL('/login?error=invalid', baseUrl));
    }

    // Set user cookie
    await setUser(email);

    // Redirect to home page
    return NextResponse.redirect(new URL('/', baseUrl));
  } catch (error) {
    console.error('Verification error:', error);
    return NextResponse.redirect(new URL('/login?error=invalid', baseUrl));
  }
}
