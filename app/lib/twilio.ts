import twilio from 'twilio';

const accountSid = process.env.NEXT_PUBLIC_TWILIO_ACCOUNT_SID;
const authToken = process.env.NEXT_PUBLIC_TWILIO_AUTH_TOKEN;
const fromNumber = process.env.NEXT_PUBLIC_TWILIO_FROM_NUMBER;
const adminNumbers = process.env.NEXT_PUBLIC_ADMIN_PHONE_NUMBERS?.split(',') || [];

const client = accountSid && authToken ? twilio(accountSid, authToken) : null;

export async function sendSquaresNotification(email: string, count: number): Promise<boolean> {
  if (!client || !fromNumber || adminNumbers.length === 0) {
    console.error('Twilio not configured - missing environment variables');
    return false;
  }

  const message = `SuperBowl Squares: ${email} has locked in ${count} square${count !== 1 ? 's' : ''}!`;

  try {
    await Promise.all(
      adminNumbers.map((toNumber) =>
        client.messages.create({
          body: message,
          from: fromNumber,
          to: toNumber.trim(),
        })
      )
    );
    return true;
  } catch (error) {
    console.error('Failed to send SMS:', error);
    return false;
  }
}
