import { decrypt, encrypt } from './crypto';

const SECRET = Buffer.alloc(32, 7).toString('base64');

describe('crypto helpers', () => {
  it('round trips values', () => {
    const encrypted = encrypt('super-secret', SECRET);
    expect(decrypt(encrypted, SECRET)).toEqual('super-secret');
  });

  it('throws for invalid key length', () => {
    expect(() => encrypt('hi', 'short')).toThrow();
  });
});
