import { useCallback, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase/client'
import type { Channel } from '../chat/types'
import { unreadCount } from './state'

export type Notification = { id: string; channel_id: Channel; created_at: string; read_at: string | null; message_id: string }

export function useNotifications(session: Session | null) {
  const [items, setItems] = useState<Notification[]>([])
  const [unread, setUnread] = useState(0)
  const [error, setError] = useState('')
  const refresh = useCallback(async () => {
    if (!supabase || !session) return
    const [list, total] = await Promise.all([
      supabase.from('notifications').select('id,channel_id,created_at,read_at,message_id')
        .eq('user_id', session.user.id).order('created_at', { ascending: false }).limit(100),
      supabase.from('notifications').select('id', { count: 'exact', head: true })
        .eq('user_id', session.user.id).is('read_at', null),
    ])
    if (list.error || total.error) setError('Falha ao carregar notificações.')
    else {
      const next = (list.data ?? []) as Notification[]
      setItems(next)
      setUnread(total.count ?? unreadCount(next))
      setError('')
    }
  }, [session])
  useEffect(() => {
    if (!session || !supabase) return
    queueMicrotask(() => { void refresh() })
    const stream = supabase.channel(`notifications:${session.user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${session.user.id}` }, () => { void refresh() })
      .subscribe()
    return () => { void supabase?.removeChannel(stream) }
  }, [refresh, session])
  async function markRead(id?: string) {
    if (!session || !supabase) return
    let query = supabase!.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', session.user.id).is('read_at', null)
    if (id) query = query.eq('id', id)
    const { error: updateError } = await query
    if (updateError) setError('Não foi possível marcar como lida.')
    else await refresh()
  }
  const markChannelRead = useCallback(async (channel: Channel) => {
    if (!session || !supabase) return
    const { error: updateError } = await supabase.from('notifications')
      .update({ read_at: new Date().toISOString() }).eq('user_id', session.user.id).eq('channel_id', channel).is('read_at', null)
    if (updateError) setError('Não foi possível marcar como lida.')
    else await refresh()
  }, [refresh, session])
  return { items, unread, error, markRead, markChannelRead }
}
