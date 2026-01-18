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
      ? 'https://olneycougars.com'  // Replace with your domain
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
      from: 'Olney Cougars <noreply@olneycougars.com>',  // Replace with your sender
      to: normalizedEmail,
      subject: 'Your login link',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Login to Olney Cougars</h2>
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
