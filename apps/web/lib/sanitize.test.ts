import { describe, expect, it } from 'vitest';
import { sanitizeHtml } from './sanitize';

describe('sanitizeHtml', () => {
  it('removes unsafe scripts', () => {
    const dirty = '<p>Hello</p><script>alert(1)</script>';
    const clean = sanitizeHtml(dirty);
    expect(clean).not.toContain('<script');
    expect(clean).toContain('<p>Hello</p>');
  });
});
