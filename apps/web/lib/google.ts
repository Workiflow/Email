import { Buffer } from 'buffer';
import { google } from 'googleapis';
import { encryptJSON, decryptJSON } from '@shared/inbox';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@db/inbox';
import type { GoogleOAuthState } from '@shared/inbox';

export interface StoredOAuthToken {
  access_token: string;
  refresh_token: string;
  scope?: string;
  token_type?: string;
  expiry_date?: number;
}

function requireSecret() {
  const secret = process.env.ENCRYPTION_KEY;
  if (!secret) {
    throw new Error('ENCRYPTION_KEY is required');
  }
  return secret;
}

export function getOAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Missing Google OAuth environment variables');
  }
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export function createOAuthState(payload: GoogleOAuthState) {
  const secret = requireSecret();
  const encrypted = encryptJSON(payload, secret);
  return Buffer.from(JSON.stringify(encrypted)).toString('base64url');
}

export function parseOAuthState(state: string): GoogleOAuthState {
  const secret = requireSecret();
  const decrypted = decryptJSON<GoogleOAuthState>(JSON.parse(Buffer.from(state, 'base64url').toString('utf8')), secret);
  return decrypted;
}

export function encryptToken(token: StoredOAuthToken) {
  const secret = requireSecret();
  return encryptJSON(token, secret);
}

function normalizeTokenPart(value: string | null | Uint8Array | number[] | undefined) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (value instanceof Uint8Array) return Buffer.from(value).toString('base64');
  if (Array.isArray(value)) return Buffer.from(value).toString('base64');
  return null;
}

export function decryptToken(payload: {
  token_encrypted: string | null | Uint8Array | number[];
  token_iv: string | null | Uint8Array | number[];
  token_auth_tag: string | null | Uint8Array | number[];
}) {
  const secret = requireSecret();
  const cipherText = normalizeTokenPart(payload.token_encrypted);
  const iv = normalizeTokenPart(payload.token_iv);
  const authTag = normalizeTokenPart(payload.token_auth_tag);
  if (!cipherText || !iv || !authTag) {
    return null;
  }
  return decryptJSON<StoredOAuthToken>(
    {
      cipherText,
      iv,
      authTag
    },
    secret
  );
}

export async function refreshAccessToken(token: StoredOAuthToken, supabase: SupabaseClient<Database>, inboxId: string) {
  const client = getOAuthClient();
  client.setCredentials(token);
  const { credentials } = await client.refreshAccessToken();
  const merged: StoredOAuthToken = {
    ...token,
    ...credentials
  };
  const encrypted = encryptToken(merged);
  await supabase
    .from('inbox')
    .update({
      token_encrypted: Buffer.from(encrypted.cipherText, 'base64'),
      token_iv: Buffer.from(encrypted.iv, 'base64'),
      token_auth_tag: Buffer.from(encrypted.authTag, 'base64')
    })
    .eq('id', inboxId);
  return merged;
}

export async function storeToken(
  supabase: SupabaseClient<Database>,
  inboxId: string,
  token: StoredOAuthToken,
  accountEmail?: string
) {
  const encrypted = encryptToken(token);
  await supabase
    .from('inbox')
    .update({
      token_encrypted: Buffer.from(encrypted.cipherText, 'base64'),
      token_iv: Buffer.from(encrypted.iv, 'base64'),
      token_auth_tag: Buffer.from(encrypted.authTag, 'base64'),
      google_account_email: accountEmail ?? null
    })
    .eq('id', inboxId);
}

export async function revokeToken(token: StoredOAuthToken) {
  const client = getOAuthClient();
  client.setCredentials(token);
  if (token.access_token) {
    await client.revokeToken(token.access_token);
  }
  if (token.refresh_token) {
    await client.revokeToken(token.refresh_token);
  }
}
