/**
 * Sends one accountability email via Brevo.
 *
 * Runs as a Vercel Serverless Function so the Brevo API key stays server-side —
 * anything in the Vite bundle (including every VITE_* variable) is public.
 *
 * Required environment variables (set these in the Vercel project settings, not
 * in .env, which is committed to this repo):
 *   BREVO_API_KEY       - from https://app.brevo.com  → SMTP & API → API Keys
 *   BREVO_SENDER_EMAIL  - a sender address verified in Brevo
 *   BREVO_SENDER_NAME   - optional display name, defaults to "Habit Tracker"
 *   SUPABASE_URL        - your project URL, used to verify the caller
 *   SUPABASE_ANON_KEY   - your anon key, used to verify the caller
 */

const MAX_RECIPIENTS = 20;

interface EmailRequestBody {
  to?: unknown;
  subject?: unknown;
  body?: unknown;
}

const isEmail = (value: unknown): value is string =>
  typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    BREVO_API_KEY,
    BREVO_SENDER_EMAIL,
    BREVO_SENDER_NAME,
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
  } = process.env;

  if (!BREVO_API_KEY || !BREVO_SENDER_EMAIL) {
    return res.status(500).json({ error: 'Email is not configured on the server.' });
  }
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return res.status(500).json({ error: 'Auth verification is not configured on the server.' });
  }

  // Only a signed-in user of this app may send. Without this the route is an
  // open relay that anyone on the internet could use to send mail as you.
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'Missing bearer token.' });
  }

  const userResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY },
  });
  if (!userResponse.ok) {
    return res.status(401).json({ error: 'Invalid session.' });
  }

  const { to, subject, body }: EmailRequestBody =
    typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});

  const recipients = Array.isArray(to) ? to.filter(isEmail) : [];
  if (recipients.length === 0) {
    return res.status(400).json({ error: 'No valid recipients.' });
  }
  if (recipients.length > MAX_RECIPIENTS) {
    return res.status(400).json({ error: `At most ${MAX_RECIPIENTS} recipients per email.` });
  }
  if (typeof subject !== 'string' || !subject.trim()) {
    return res.status(400).json({ error: 'Subject is required.' });
  }
  if (typeof body !== 'string' || !body.trim()) {
    return res.status(400).json({ error: 'Body is required.' });
  }

  const brevoResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': BREVO_API_KEY,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      sender: { email: BREVO_SENDER_EMAIL, name: BREVO_SENDER_NAME || 'Habit Tracker' },
      to: recipients.map((email: string) => ({ email })),
      subject: subject.trim(),
      textContent: body.trim(),
    }),
  });

  if (!brevoResponse.ok) {
    const detail = await brevoResponse.text();
    console.error('Brevo send failed:', brevoResponse.status, detail);
    return res.status(502).json({ error: 'Email provider rejected the message.', detail });
  }

  return res.status(200).json({ sent: recipients.length });
}
