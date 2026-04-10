/**
 * Server-side Cloudflare Turnstile token verification.
 * Call this from API routes before processing form submissions.
 *
 * @param {string} token — The cf-turnstile-response token from the client
 * @returns {Promise<{ success: boolean }>}
 * @throws {Error} if the token is missing, invalid, or verification fails
 */
export async function verifyTurnstile(token) {
  if (!token) {
    throw new Error('Turnstile verification token is required');
  }

  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    // If no secret is configured, skip verification (dev mode convenience)
    console.warn('[Turnstile] TURNSTILE_SECRET_KEY not set — skipping verification');
    return { success: true };
  }

  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      secret,
      response: token
    })
  });

  const result = await response.json();

  if (!result.success) {
    throw new Error('Bot verification failed. Please try again.');
  }

  return { success: true };
}
