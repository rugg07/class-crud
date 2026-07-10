// Build Google OAuth consent URL with client ID, redirect URI, and state parameter.
export function getGoogleAuthUrl(state: string): string {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    throw new Error('GOOGLE_CLIENT_ID or GOOGLE_REDIRECT_URI not configured');
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

// Exchange authorization code for access and ID tokens via Google token endpoint.
export async function exchangeCodeForToken(
  code: string
): Promise<{ access_token: string; id_token: string } | null> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      'GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, or GOOGLE_REDIRECT_URI not configured'
    );
  }

  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }).toString(),
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as {
      access_token: string;
      id_token: string;
    };
    return data;
  } catch {
    return null;
  }
}

// Decode id_token payload (base64), returns email and name or null if malformed.
export async function getGoogleProfile(
  idToken: string
): Promise<{ email: string; name: string } | null> {
  try {
    const parts = idToken.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const payload = JSON.parse(
      Buffer.from(parts[1]!, 'base64').toString('utf-8')
    ) as { email?: string; name?: string };

    if (!payload.email || !payload.name) {
      return null;
    }

    return { email: payload.email, name: payload.name };
  } catch {
    return null;
  }
}
