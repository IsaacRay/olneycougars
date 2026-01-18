import { cookies } from 'next/headers';
import { createClient } from '../utils/supabase/server';

export interface User {
  email: string;
}

// Get current user from cookie
export async function getUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const encodedEmail = cookieStore.get('Auth')?.value;

  if (!encodedEmail) return null;

  try {
    const email = Buffer.from(encodedEmail, 'base64').toString('utf-8');
    return { email };
  } catch {
    return null;
  }
}

// Set user session cookie
export async function setUser(email: string) {
  const cookieStore = await cookies();
  const encodedEmail = Buffer.from(email.toLowerCase(), 'utf-8').toString('base64');

  cookieStore.set('Auth', encodedEmail, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365, // 1 year
    path: '/'
  });
}

// Clear session
export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete('Auth');
}

// Check if user is admin (customize this for your app)
export function isAdmin(email: string | null): boolean {
  // Replace with your admin email(s)
  return email === 'your-admin-email@example.com';
}

// Create a magic link token
export async function createMagicLinkToken(email: string): Promise<string> {
  // Generate a random token
  const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  const supabase = await createClient();
  const { error } = await supabase
    .from('magic_link_tokens')
    .insert({
      id: token,
      email: email.toLowerCase(),
      expires_at: expiresAt.toISOString(),
      used: false
    });

  if (error) {
    console.error('Failed to create token:', error);
    throw error;
  }

  return token;
}

// Verify a magic link token
export async function verifyMagicLinkToken(token: string): Promise<string | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('magic_link_tokens')
    .select('*')
    .eq('id', token)
    .eq('used', false)
    .single();

  if (error || !data) {
    return null;
  }

  // Check if expired
  if (new Date(data.expires_at) < new Date()) {
    return null;
  }

  // Mark as used
  await supabase
    .from('magic_link_tokens')
    .update({ used: true })
    .eq('id', token);

  return data.email;
}
