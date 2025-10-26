import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';

const ALGO = 'aes-256-gcm';
const IV_LENGTH = 12;

export interface EncryptedPayload {
  iv: string;
  cipherText: string;
  authTag: string;
}

export function encrypt(value: string, secret: string): EncryptedPayload {
  const key = Buffer.from(secret, 'base64');
  if (key.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be 32 bytes base64 encoded');
  }
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGO, key, iv);
  const cipherText = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    iv: iv.toString('base64'),
    cipherText: cipherText.toString('base64'),
    authTag: authTag.toString('base64')
  };
}

export function decrypt(payload: EncryptedPayload, secret: string): string {
  const key = Buffer.from(secret, 'base64');
  if (key.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be 32 bytes base64 encoded');
  }
  const decipher = createDecipheriv(ALGO, key, Buffer.from(payload.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(payload.authTag, 'base64'));
  const plain = Buffer.concat([
    decipher.update(Buffer.from(payload.cipherText, 'base64')),
    decipher.final()
  ]);
  return plain.toString('utf8');
}

export function encryptJSON<T>(value: T, secret: string): EncryptedPayload {
  return encrypt(JSON.stringify(value), secret);
}

export function decryptJSON<T>(payload: EncryptedPayload, secret: string): T {
  return JSON.parse(decrypt(payload, secret)) as T;
}
