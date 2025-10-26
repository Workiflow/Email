import { z } from 'zod';
import type { ConversationStatus } from './types';

export const statusValues: ConversationStatus[] = ['open', 'waiting', 'closed'];

export const createInboxSchema = z.object({
  name: z.string().min(1),
  gmailAddress: z.string().email()
});

export const assignSchema = z.object({
  assigneeId: z.string().uuid().nullable()
});

export const statusSchema = z.object({
  status: z.enum(statusValues)
});

export const tagSchema = z.object({
  tagId: z.string().uuid()
});

export const snoozeSchema = z.object({
  until: z.string().datetime()
});

export const commentSchema = z.object({
  body: z.string().min(1)
});

export const replySchema = z.object({
  body: z.string().min(1),
  to: z.array(z.string().email()).nonempty(),
  cc: z.array(z.string().email()).optional().default([]),
  bcc: z.array(z.string().email()).optional().default([]),
  attachments: z
    .array(
      z.object({
        id: z.string(),
        filename: z.string(),
        mimeType: z.string()
      })
    )
    .optional()
    .default([])
});

export const filterSchema = z.object({
  status: z.enum(statusValues).optional(),
  assigneeId: z.string().uuid().optional(),
  tagId: z.string().uuid().optional(),
  q: z.string().optional(),
  inboxId: z.string().uuid().optional(),
  snoozed: z.string().optional()
});

export const googleOAuthStateSchema = z.object({
  inboxId: z.string().uuid(),
  teamId: z.string().uuid(),
  redirectPath: z.string().default('/')
});

export type CreateInboxInput = z.infer<typeof createInboxSchema>;
export type AssignInput = z.infer<typeof assignSchema>;
export type StatusInput = z.infer<typeof statusSchema>;
export type TagInput = z.infer<typeof tagSchema>;
export type SnoozeInput = z.infer<typeof snoozeSchema>;
export type CommentInput = z.infer<typeof commentSchema>;
export type ReplyInput = z.infer<typeof replySchema>;
export type FilterInput = z.infer<typeof filterSchema>;
export type GoogleOAuthState = z.infer<typeof googleOAuthStateSchema>;
