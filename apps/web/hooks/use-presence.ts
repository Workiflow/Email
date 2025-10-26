'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSupabaseBrowser } from '../lib/supabase-client';

interface PresenceState {
  userId: string;
  typing: boolean;
}

export function useConversationPresence(conversationId: string | null, userId: string) {
  const supabase = useSupabaseBrowser();
  const [peers, setPeers] = useState<PresenceState[]>([]);

  const channel = useMemo(() => {
    if (!conversationId) return null;
    return supabase.channel(`presence:conversation:${conversationId}`, {
      config: { presence: { key: userId } }
    });
  }, [conversationId, supabase, userId]);

  useEffect(() => {
    if (!channel) return;
    const subscription = channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<PresenceState>();
        const others = Object.values(state)
          .flat()
          .filter((member) => member.userId !== userId);
        setPeers(others);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ userId, typing: false });
        }
      });
    return () => {
      channel.unsubscribe();
    };
  }, [channel, userId]);

  function setTyping(typing: boolean) {
    if (!channel) return;
    channel.track({ userId, typing }).catch(() => {
      // ignore
    });
  }

  return { peers, setTyping } as const;
}
