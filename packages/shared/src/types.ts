export type ConversationStatus = 'open' | 'waiting' | 'closed';

export interface Profile {
  id: string;
  email: string;
  name: string | null;
  role: 'admin' | 'agent' | 'viewer';
  teamId: string;
}

export interface Inbox {
  id: string;
  teamId: string;
  name: string;
  gmailAddress: string;
  isActive: boolean;
  lastSyncedAt: string | null;
}

export interface ConversationSummary {
  id: string;
  inboxId: string;
  subject: string;
  status: ConversationStatus;
  assigneeId: string | null;
  lastCustomerMessageAt: string | null;
  lastAgentMessageAt: string | null;
  preview: string | null;
  tags: Array<{ id: string; name: string; color: string }>;
  snoozedUntil: string | null;
}

export interface Message {
  id: string;
  conversationId: string;
  gmailMessageId: string;
  from: string;
  to: string[];
  cc: string[];
  bcc: string[];
  sentAt: string;
  bodyHtml: string | null;
  bodyText: string | null;
  headers: Record<string, string | string[]>;
  hasAttachments: boolean;
}

export interface Attachment {
  id: string;
  messageId: string;
  filename: string;
  mimeType: string;
  size: number;
  storagePath: string;
}

export interface Comment {
  id: string;
  conversationId: string;
  authorId: string;
  body: string;
  createdAt: string;
}

export interface GmailMessagePayload {
  id: string;
  threadId: string;
  historyId: string;
  internalDate: string;
  payload: GoogleGmailMessagePayload;
  labelIds?: string[];
  snippet?: string;
  sizeEstimate?: number;
}

export interface GoogleGmailMessagePayload {
  mimeType?: string;
  filename?: string;
  headers?: Array<{ name?: string; value?: string }>;
  body?: { size?: number; data?: string; attachmentId?: string };
  parts?: GoogleGmailMessagePayload[];
}

export interface ParsedGmailMessage {
  bodyHtml: string | null;
  bodyText: string | null;
  headers: Record<string, string | string[]>;
  attachments: Array<{
    attachmentId: string;
    filename: string;
    mimeType: string;
    size: number;
  }>;
}
