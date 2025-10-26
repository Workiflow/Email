import { Buffer } from 'buffer';
import type { GoogleGmailMessagePayload, ParsedGmailMessage } from './types';

const HEADER_NAMES_TO_NORMALISE = new Set([
  'subject',
  'from',
  'to',
  'cc',
  'bcc',
  'message-id',
  'in-reply-to',
  'references',
  'date'
]);

export function parseGmailPayload(payload: GoogleGmailMessagePayload): ParsedGmailMessage {
  const headers: Record<string, string | string[]> = {};
  if (payload.headers) {
    for (const header of payload.headers) {
      if (!header?.name) continue;
      const key = HEADER_NAMES_TO_NORMALISE.has(header.name.toLowerCase())
        ? header.name.toLowerCase()
        : header.name;
      const value = header.value ?? '';
      if (headers[key]) {
        const existing = headers[key];
        if (Array.isArray(existing)) {
          existing.push(value);
        } else {
          headers[key] = [existing, value];
        }
      } else {
        headers[key] = value;
      }
    }
  }

  let bodyHtml: string | null = null;
  let bodyText: string | null = null;
  const attachments: ParsedGmailMessage['attachments'] = [];

  function walk(node: GoogleGmailMessagePayload) {
    if (node.body?.attachmentId) {
      attachments.push({
        attachmentId: node.body.attachmentId,
        filename: node.filename ?? 'attachment',
        mimeType: node.mimeType ?? 'application/octet-stream',
        size: node.body.size ?? 0
      });
      return;
    }

    if (node.mimeType === 'text/html' && node.body?.data) {
      bodyHtml = decodeBody(node.body.data);
    }

    if (node.mimeType === 'text/plain' && node.body?.data) {
      bodyText = decodeBody(node.body.data);
    }

    if (node.parts) {
      for (const part of node.parts) {
        walk(part);
      }
    }
  }

  walk(payload);

  if (!bodyHtml && bodyText) {
    bodyHtml = `<pre>${escapeHtml(bodyText)}</pre>`;
  }

  return { bodyHtml, bodyText, headers, attachments };
}

function decodeBody(data: string): string {
  const normalized = data.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(normalized, 'base64').toString('utf8');
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
