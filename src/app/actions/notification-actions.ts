'use server';

import { auth } from '@/lib/firebase-admin';

const N8N_WEBHOOK_URL = process.env.NEXT_PUBLIC_SIGNUP_WEBHOOK_URL || '';
const N8N_WEBHOOK_SECRET = process.env.N8N_WEBHOOK_SECRET || '';

interface SignupPayload {
  email: string | null;
  displayName: string | null;
  uid: string;
  authMethod: 'google' | 'email' | 'github' | 'anonymous';
}

export async function notifySignupAction(
  idToken: string,
  payload: SignupPayload
): Promise<void> {
  if (!N8N_WEBHOOK_URL) return;

  // Verify the caller is authenticated
  try {
    await auth.verifyIdToken(idToken);
  } catch {
    console.error('notifySignupAction: Invalid auth token');
    return;
  }

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (N8N_WEBHOOK_SECRET) headers['X-Webhook-Secret'] = N8N_WEBHOOK_SECRET;
    await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        project: 'TalentOS',
        projectUrl: 'https://veiled-ventures.web.app',
        ...payload,
        timestamp: new Date().toISOString(),
      }),
    });
  } catch {
    // Silent fail — signup alerts are non-critical
  }
}
