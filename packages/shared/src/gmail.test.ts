import { parseGmailPayload } from './gmail';

const htmlBody = Buffer.from('<p>Hello</p>').toString('base64');

const payload = {
  mimeType: 'multipart/alternative',
  parts: [
    {
      mimeType: 'text/plain',
      body: { data: Buffer.from('Hello').toString('base64') }
    },
    {
      mimeType: 'text/html',
      body: { data: htmlBody }
    },
    {
      mimeType: 'application/pdf',
      filename: 'file.pdf',
      body: { attachmentId: 'abc', size: 123 }
    }
  ],
  headers: [
    { name: 'Subject', value: 'Test' },
    { name: 'From', value: 'user@example.com' }
  ]
};

describe('parseGmailPayload', () => {
  it('extracts body and attachments', () => {
    const parsed = parseGmailPayload(payload);
    expect(parsed.bodyHtml).toContain('Hello');
    expect(parsed.bodyText).toEqual('Hello');
    expect(parsed.attachments).toHaveLength(1);
    expect(parsed.headers['subject']).toEqual('Test');
  });
});
