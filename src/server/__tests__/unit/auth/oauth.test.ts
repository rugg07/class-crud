import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Mock } from 'vitest';
import { getGoogleAuthUrl, exchangeCodeForToken, getGoogleProfile } from '../../../auth/oauth';

describe('oauth', () => {
  beforeEach(() => {
    process.env.GOOGLE_CLIENT_ID = 'test-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
    process.env.GOOGLE_REDIRECT_URI = 'http://localhost:3000/auth/callback';
  });

  it('should build correct Google auth URL with state', () => {
    const state = 'test-state-123';
    const url = getGoogleAuthUrl(state);
    expect(url).toContain('https://accounts.google.com/o/oauth2/v2/auth');
    expect(url).toContain('client_id=test-client-id');
    expect(url).toContain('redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fauth%2Fcallback');
    expect(url).toContain('state=test-state-123');
    expect(url).toContain('response_type=code');
    expect(url).toContain('scope=openid+email+profile');
  });

  it('should exchange code for tokens', async () => {
    const mockTokenResponse = {
      access_token: 'test-access-token',
      id_token: 'test-id-token',
    };

    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockTokenResponse),
        })
      ) as unknown as Mock
    );

    const result = await exchangeCodeForToken('test-code');
    expect(result).toEqual(mockTokenResponse);
  });

  it('should return null on failed token exchange', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: false,
        })
      ) as unknown as Mock
    );

    const result = await exchangeCodeForToken('invalid-code');
    expect(result).toBeNull();
  });

  it('should decode id_token correctly', async () => {
    const payload = { email: 'user@example.com', name: 'Test User' };
    const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64');
    const idToken = `header.${payloadBase64}.signature`;

    const result = await getGoogleProfile(idToken);
    expect(result).toEqual({ email: 'user@example.com', name: 'Test User' });
  });

  it('should return null for malformed id_token', async () => {
    const result = await getGoogleProfile('invalid-token');
    expect(result).toBeNull();
  });

  it('should return null if id_token missing email or name', async () => {
    const payload = { email: 'user@example.com' };
    const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64');
    const idToken = `header.${payloadBase64}.signature`;

    const result = await getGoogleProfile(idToken);
    expect(result).toBeNull();
  });
});
