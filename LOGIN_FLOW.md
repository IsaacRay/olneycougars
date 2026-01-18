# Magic Link Authentication Flow

This document describes the complete passwordless authentication system used in the OA Football application. Use this to reproduce the login flow in another repository.

## Overview

The authentication system uses **magic links** - passwordless email-based login. Users enter their email, receive a link, click it, and are logged in. No passwords are stored or transmitted.

**Key characteristics:**
- Passwordless authentication via email
- Simple token-based system (no JWT complexity)
- Cookie-based sessions with 1-year expiry
- 10-minute token expiration window
- One-time use tokens
- Case-insensitive email handling

---

## Environment Variables Required

Create a `.env.local` file with these variables:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key

# Email Service (Resend)
NEXT_PUBLIC_RESEND_API_KEY=re_your_resend_api_key

# Optional: Base URL for development
NEXTAUTH_URL=http://localhost:3001

# Node environment
NODE_ENV=development
```

**Where to get these:**
- **Supabase URL/Key**: Supabase Dashboard → Project Settings → API
- **Resend API Key**: resend.com → API Keys

---

## Database Schema

### Magic Link Tokens Table

Run this SQL in your Supabase SQL Editor:

```sql
-- Create magic_link_tokens table for authentication
CREATE TABLE IF NOT EXISTS magic_link_tokens (
  id TEXT PRIMARY KEY,                              -- Random token string
  email TEXT NOT NULL,                              -- User's email address
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,    -- Token expiration time
  used BOOLEAN DEFAULT false,                       -- Whether token has been used
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() -- When token was created
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_magic_link_tokens_email
  ON magic_link_tokens(email);

CREATE INDEX IF NOT EXISTS idx_magic_link_tokens_expires_at
  ON magic_link_tokens(expires_at);

-- Disable RLS since tokens need to work for unauthenticated users
-- and all access is server-side through the anon key
ALTER TABLE magic_link_tokens DISABLE ROW LEVEL SECURITY;

-- Optional: Cleanup function for expired tokens
CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS void AS $$
BEGIN
  DELETE FROM magic_link_tokens
  WHERE expires_at < NOW() OR used = true;
END;
$$ LANGUAGE plpgsql;
```

---

## Dependencies

Add these to your `package.json`:

```json
{
  "dependencies": {
    "@supabase/supabase-js": "^2.56.0",
    "@supabase/ssr": "^0.7.0",
    "resend": "^6.0.3"
  }
}
```

---

## File Structure

```
app/
├── login/
│   └── page.tsx                    # Login form UI
├── api/
│   └── auth/
│       ├── send-magic-link/
│       │   └── route.ts            # Sends magic link email
│       ├── verify/
│       │   └── route.ts            # Verifies token & creates session
│       ├── me/
│       │   └── route.ts            # Returns current user
│       └── logout/
│           └── route.ts            # Clears session
├── lib/
│   ├── simpleAuth.ts               # Core auth logic
│   └── supabase.ts                 # Supabase client (standard)
├── utils/
│   └── supabase/
│       ├── server.ts               # Server-side Supabase client
│       └── client.ts               # Browser-side Supabase client
└── contexts/
    └── AuthContext.tsx             # React context for auth state
```

---

## Implementation Files

### 1. Supabase Client Setup

**`app/lib/supabase.ts`**
```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

**`app/utils/supabase/server.ts`**
```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Ignore errors from Server Components
          }
        },
      },
    }
  )
}
```

**`app/utils/supabase/client.ts`**
```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

---

### 2. Core Authentication Logic

**`app/lib/simpleAuth.ts`**
```typescript
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
```

---

### 3. API Routes

**`app/api/auth/send-magic-link/route.ts`**
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createMagicLinkToken } from '../../../lib/simpleAuth';

const resend = new Resend(process.env.NEXT_PUBLIC_RESEND_API_KEY);

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Normalize email to lowercase
    const normalizedEmail = email.toLowerCase();

    // Create token
    const token = await createMagicLinkToken(normalizedEmail);

    // Generate magic link
    const baseUrl = process.env.NODE_ENV === 'production'
      ? 'https://your-production-domain.com'  // Replace with your domain
      : (process.env.NEXTAUTH_URL || 'http://localhost:3001');
    const magicLink = `${baseUrl}/api/auth/verify?token=${token}`;

    // Development mode: log link to console if Resend not configured
    if (!process.env.NEXT_PUBLIC_RESEND_API_KEY) {
      console.log('Magic link for', normalizedEmail, ':', magicLink);
      return NextResponse.json({
        success: true,
        message: 'Check console for magic link (dev mode)'
      });
    }

    // Send email with Resend
    const { error: emailError } = await resend.emails.send({
      from: 'Your App <noreply@your-domain.com>',  // Replace with your sender
      to: normalizedEmail,
      subject: 'Your login link',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Login to Your App</h2>
          <p>Click the link below to log in to your account:</p>
          <a href="${magicLink}" style="display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 6px; margin: 16px 0;">
            Log In
          </a>
          <p style="color: #666; font-size: 14px;">This link will expire in 10 minutes.</p>
          <p style="color: #666; font-size: 14px;">If you didn't request this login link, you can safely ignore this email.</p>
        </div>
      `
    });

    if (emailError) {
      console.error('Email error:', emailError);
      return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'An error occurred' }, { status: 500 });
  }
}
```

**`app/api/auth/verify/route.ts`**
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { verifyMagicLinkToken, setUser } from '../../../lib/simpleAuth';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  // Get base URL for redirects
  const baseUrl = process.env.NODE_ENV === 'production'
    ? 'https://your-production-domain.com'  // Replace with your domain
    : (process.env.NEXTAUTH_URL || 'http://localhost:3001');

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
```

**`app/api/auth/me/route.ts`**
```typescript
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
```

**`app/api/auth/logout/route.ts`**
```typescript
import { NextResponse } from 'next/server';
import { logout } from '../../../lib/simpleAuth';

export async function POST() {
  await logout();
  return NextResponse.json({ success: true });
}
```

---

### 4. Login Page

**`app/login/page.tsx`**
```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Login() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const router = useRouter();

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const response = await fetch('/api/auth/send-magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.toLowerCase() })
      });

      const data = await response.json();

      if (response.ok) {
        setMessage('Check your email for the magic link!');
        setEmail('');
      } else {
        setMessage(data.error || 'Failed to send login link');
      }
    } catch (error) {
      setMessage('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Sign in to Your App
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Enter your email to receive a magic link
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSignIn}>
          <div>
            <label htmlFor="email" className="sr-only">
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="appearance-none rounded-lg relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              placeholder="Enter your email address"
              disabled={loading}
            />
          </div>

          <div>
            <button
              type="submit"
              disabled={loading || !email}
              className={`group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white ${
                loading || !email
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
              } transition-colors duration-200`}
            >
              {loading ? 'Sending...' : 'Send Magic Link'}
            </button>
          </div>

          {message && (
            <div
              className={`rounded-lg p-4 text-sm ${
                message.includes('Check your email')
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}
            >
              {message}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
```

---

### 5. Auth Context

**`app/contexts/AuthContext.tsx`**
```typescript
'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface User {
  email: string;
  isAdmin: boolean;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    try {
      const response = await fetch('/api/auth/me');
      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      } else {
        setUser(null);
      }
    } catch (error) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setUser(null);
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
```

---

### 6. Wrap Your App with AuthProvider

**`app/layout.tsx`** (add the provider)
```typescript
import { AuthProvider } from './contexts/AuthContext';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
```

---

## Authentication Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           MAGIC LINK AUTH FLOW                              │
└─────────────────────────────────────────────────────────────────────────────┘

1. USER ENTERS EMAIL
   ┌──────────┐     POST /api/auth/send-magic-link     ┌──────────────────┐
   │  Login   │ ─────────────────────────────────────▶ │  Generate Token  │
   │  Page    │         { email: "user@..." }          │  Store in DB     │
   └──────────┘                                        └────────┬─────────┘
                                                                │
2. EMAIL SENT                                                   │
   ┌──────────┐                                        ┌────────▼─────────┐
   │  User's  │ ◀─────────────────────────────────────│  Resend Email    │
   │  Inbox   │    Magic link with token in URL        │  Service         │
   └──────────┘                                        └──────────────────┘

3. USER CLICKS LINK
   ┌──────────┐     GET /api/auth/verify?token=xxx     ┌──────────────────┐
   │  Email   │ ─────────────────────────────────────▶ │  Verify Token    │
   │  Link    │                                        │  Mark as Used    │
   └──────────┘                                        └────────┬─────────┘
                                                                │
4. SESSION CREATED                                              │
   ┌──────────┐                                        ┌────────▼─────────┐
   │  Home    │ ◀─────────────────────────────────────│  Set Cookie      │
   │  Page    │    Redirect + Auth cookie              │  (base64 email)  │
   └──────────┘                                        └──────────────────┘

5. SUBSEQUENT REQUESTS
   ┌──────────┐     GET /api/auth/me                   ┌──────────────────┐
   │  Any     │ ─────────────────────────────────────▶ │  Decode Cookie   │
   │  Page    │    Cookie: Auth=base64(email)          │  Return User     │
   └──────────┘                                        └──────────────────┘
```

---

## Usage in Protected Pages

```typescript
'use client';

import { useAuth } from './contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function ProtectedPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return null;
  }

  return (
    <div>
      <p>Welcome, {user.email}!</p>
      <button onClick={logout}>Logout</button>
    </div>
  );
}
```

---

## Security Features

| Feature | Implementation |
|---------|----------------|
| HTTP-only cookies | Prevents XSS access to auth token |
| Secure flag | Cookies only sent over HTTPS in production |
| SameSite: Lax | CSRF protection |
| Token expiration | 10-minute window reduces exposure |
| One-time use tokens | Tokens marked used after verification |
| Base64 encoding | Simple obfuscation of email in cookie |
| Case normalization | Prevents duplicate accounts |

---

## Customization Points

1. **Admin check**: Modify `isAdmin()` in `simpleAuth.ts`
2. **Token expiration**: Change `10 * 60 * 1000` in `createMagicLinkToken()`
3. **Session duration**: Change `maxAge` in `setUser()`
4. **Email template**: Customize HTML in `send-magic-link/route.ts`
5. **Production URL**: Update `baseUrl` in both API routes
6. **Email sender**: Update `from` in Resend call

---

## Setup Checklist

- [ ] Create Supabase project and get URL/key
- [ ] Create Resend account and get API key
- [ ] Set up verified domain in Resend for sending emails
- [ ] Create `.env.local` with all environment variables
- [ ] Run SQL to create `magic_link_tokens` table
- [ ] Install dependencies (`npm install`)
- [ ] Create all the files above
- [ ] Wrap app with `AuthProvider`
- [ ] Update production URLs in API routes
- [ ] Update admin email in `isAdmin()` function
- [ ] Test login flow locally (check console for magic link in dev mode)
