'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { Button, Card, CardContent, CardHeader, KeyHint, TagPill, cn } from '@ui/inbox';
import type { ConversationSummary, Message, Comment, Profile } from '@shared/inbox';
import { pushToast } from './toaster';
import { useConversationPresence } from '../hooks/use-presence';
import { sanitizeHtml } from '../lib/sanitize';

interface InboxShellProps {
  profile: Profile;
  initialConversations: ConversationSummary[];
}

interface ConversationDetail {
  conversation: ConversationSummary;
  messages: Array<
    Message & {
      attachments: Array<{
        id: string;
        messageId: string;
        filename: string;
        mimeType: string;
        size: number;
        storagePath: string;
      }>;
    }
  >;
  comments: Comment[];
}

async function fetchJSON<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'Request failed');
  }
  return response.json();
}

export function InboxShell({ profile, initialConversations }: InboxShellProps) {
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(
    initialConversations[0]?.id ?? null
  );
  const [filter, setFilter] = useState<'mine' | 'open' | 'waiting' | 'closed' | 'snoozed' | 'all'>('all');
  const queryClient = useQueryClient();
  const { peers, setTyping } = useConversationPresence(selectedConversationId, profile.id);

  const conversationsQuery = useQuery<ConversationSummary[]>({
    queryKey: ['conversations', filter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filter === 'mine') params.set('assigneeId', profile.id);
      else if (filter === 'open') params.set('status', 'open');
      else if (filter === 'waiting') params.set('status', 'waiting');
      else if (filter === 'closed') params.set('status', 'closed');
      else if (filter === 'snoozed') params.set('snoozed', 'true');
      const queryString = params.toString();
      const url = queryString ? `/api/conversations?${queryString}` : '/api/conversations';
      const data = await fetchJSON<ConversationSummary[]>(url);
      return data;
    },
    initialData: initialConversations
  });

  useEffect(() => {
    if (!selectedConversationId && conversationsQuery.data?.length) {
      setSelectedConversationId(conversationsQuery.data[0].id);
    }
  }, [conversationsQuery.data, selectedConversationId]);

  const detailQuery = useQuery<ConversationDetail | null>({
    queryKey: ['conversation', selectedConversationId],
    enabled: Boolean(selectedConversationId),
    queryFn: async () => {
      if (!selectedConversationId) return null;
      return fetchJSON<ConversationDetail>(`/api/conversations/${selectedConversationId}`);
    }
  });

  const assignMutation = useMutation({
    mutationFn: async (assigneeId: string | null) => {
      if (!selectedConversationId) return;
      await fetchJSON(`/api/conversations/${selectedConversationId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assigneeId })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversation', selectedConversationId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    }
  });

  const statusMutation = useMutation({
    mutationFn: async (status: 'open' | 'waiting' | 'closed') => {
      if (!selectedConversationId) return;
      await fetchJSON(`/api/conversations/${selectedConversationId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversation', selectedConversationId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    }
  });

  const commentMutation = useMutation({
    mutationFn: async (body: string) => {
      if (!selectedConversationId) return;
      await fetchJSON(`/api/conversations/${selectedConversationId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversation', selectedConversationId] });
      pushToast('Comment added');
    }
  });

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (!selectedConversationId || !detailQuery.data) return;
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (event.key.toLowerCase() === 'a') {
        assignMutation.mutate(profile.id);
      }
      if (event.key.toLowerCase() === 'e') {
        statusMutation.mutate('closed');
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [assignMutation, detailQuery.data, profile.id, selectedConversationId, statusMutation]);

  const typingPeers = peers.filter((peer) => peer.typing);

  return (
    <div className="flex h-screen gap-4 p-4">
      <aside className="flex w-80 flex-col gap-3">
        <FilterTabs active={filter} onSelect={setFilter} />
        <div className="flex-1 overflow-y-auto rounded-md border bg-white">
          {conversationsQuery.data?.map((conversation) => (
            <button
              key={conversation.id}
              onClick={() => setSelectedConversationId(conversation.id)}
              className={cn(
                'flex w-full flex-col gap-1 border-b px-4 py-3 text-left hover:bg-gray-50',
                selectedConversationId === conversation.id && 'bg-blue-50'
              )}
            >
              <div className="flex items-center justify-between text-sm font-medium">
                <span>{conversation.subject}</span>
                <span className="text-xs text-gray-500">
                  {conversation.lastCustomerMessageAt
                    ? formatDistanceToNow(new Date(conversation.lastCustomerMessageAt), { addSuffix: true })
                    : '—'}
                </span>
              </div>
              <p className="text-xs text-gray-600 line-clamp-2">{conversation.preview ?? 'No preview available'}</p>
              <div className="flex flex-wrap gap-1">
                {conversation.tags.map((tag) => (
                  <TagPill key={tag.id} color={tag.color}>
                    {tag.name}
                  </TagPill>
                ))}
              </div>
            </button>
          ))}
        </div>
      </aside>
      <section className="flex min-w-0 flex-1 flex-col gap-4">
        {detailQuery.isLoading && <p className="p-6 text-sm text-gray-600">Loading conversation…</p>}
        {detailQuery.data && (
          <ConversationDetailView
            detail={detailQuery.data}
            onAssign={() => assignMutation.mutate(profile.id)}
            onStatusChange={(status) => statusMutation.mutate(status)}
            onComment={(body) => commentMutation.mutate(body)}
            typingPeers={typingPeers}
            setTyping={setTyping}
            profile={profile}
          />
        )}
        {!detailQuery.data && !detailQuery.isLoading && (
          <div className="flex flex-1 items-center justify-center text-sm text-gray-500">
            Select a conversation to get started
          </div>
        )}
      </section>
    </div>
  );
}

function FilterTabs({
  active,
  onSelect
}: {
  active: 'mine' | 'open' | 'waiting' | 'closed' | 'snoozed' | 'all';
  onSelect: (value: 'mine' | 'open' | 'waiting' | 'closed' | 'snoozed' | 'all') => void;
}) {
  const options: Array<{ value: typeof active; label: string }> = [
    { value: 'all', label: 'All' },
    { value: 'mine', label: 'Assigned to me' },
    { value: 'open', label: 'Open' },
    { value: 'waiting', label: 'Waiting' },
    { value: 'closed', label: 'Closed' },
    { value: 'snoozed', label: 'Snoozed' }
  ];

  return (
    <div className="flex gap-2">
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onSelect(option.value)}
          className={cn(
            'rounded-md border px-2 py-1 text-xs font-medium',
            option.value === active ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200'
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function ConversationDetailView({
  detail,
  onAssign,
  onStatusChange,
  onComment,
  typingPeers,
  setTyping,
  profile
}: {
  detail: ConversationDetail;
  onAssign: () => void;
  onStatusChange: (status: 'open' | 'waiting' | 'closed') => void;
  onComment: (body: string) => void;
  typingPeers: Array<{ userId: string }>;
  setTyping: (typing: boolean) => void;
  profile: Profile;
}) {
  const [commentBody, setCommentBody] = useState('');

  useEffect(() => {
    return () => setTyping(false);
  }, [setTyping]);

  function handleCommentSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!commentBody.trim()) return;
    onComment(commentBody.trim());
    setCommentBody('');
    setTyping(false);
  }

  return (
    <div className="flex flex-1 gap-4">
      <div className="flex-1 overflow-y-auto rounded-md border bg-white">
        <header className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold">{detail.conversation.subject}</h2>
            <p className="text-sm text-gray-500">
              Status: <span className="font-medium text-gray-700">{detail.conversation.status}</span>
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onAssign}>
              Assign to me
            </Button>
            <Button variant="primary" onClick={() => onStatusChange('closed')}>
              Close
            </Button>
          </div>
        </header>
        <div className="flex flex-col gap-4 px-6 py-4">
          {detail.messages.map((message) => (
            <article key={message.id} className="rounded-md border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">{message.from}</div>
                <div className="text-xs text-gray-500">
                  {formatDistanceToNow(new Date(message.sentAt), { addSuffix: true })}
                </div>
              </div>
              <div
                className="prose mt-3 max-w-none text-sm"
                dangerouslySetInnerHTML={{
                  __html: sanitizeHtml(message.bodyHtml ?? message.bodyText ?? '')
                }}
              />
            </article>
          ))}
        </div>
      </div>
      <aside className="flex w-80 flex-col gap-4">
        <Card>
          <CardHeader>Internal comments</CardHeader>
          <CardContent className="flex flex-col gap-3">
            <form onSubmit={handleCommentSubmit} className="flex flex-col gap-3">
              <textarea
                value={commentBody}
                onChange={(event) => {
                  setCommentBody(event.target.value);
                  setTyping(event.target.value.length > 0);
                }}
                onBlur={() => setTyping(false)}
                className="h-24 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
              <Button type="submit" variant="primary">
                Comment
              </Button>
            </form>
            {typingPeers.length > 0 && (
              <p className="text-xs text-gray-500">
                {typingPeers.length === 1 ? 'Another teammate is typing…' : 'Multiple teammates are typing…'}
              </p>
            )}
            <div className="flex flex-col gap-2">
              {detail.comments.map((comment) => (
                <div key={comment.id} className="rounded-md border border-gray-200 p-2 text-xs text-gray-700">
                  <div className="mb-1 text-[10px] uppercase text-gray-500">
                    {comment.authorId === profile.id ? 'You' : comment.authorId}{' '}
                    · {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                  </div>
                  <div>{comment.body}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>Shortcuts</CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Shortcut label="Assign to me" keyLabel="A" />
            <Shortcut label="Close" keyLabel="E" />
            <Shortcut label="Reply" keyLabel="R" />
            <Shortcut label="Comment" keyLabel="C" />
            <Shortcut label="Snooze" keyLabel="S" />
            <Shortcut label="Tag" keyLabel="T" />
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}

function Shortcut({ label, keyLabel }: { label: string; keyLabel: string }) {
  return (
    <div className="flex items-center gap-2 text-xs text-gray-600">
      <KeyHint>{keyLabel}</KeyHint>
      <span>{label}</span>
    </div>
  );
}
