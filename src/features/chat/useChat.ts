import { useCallback, useEffect, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase/client'
import { validateMessage, type Channel, type Message } from './types'
import { mergeMessages } from './messageState'

const pageSize = 40
export function useChat(channel: Channel, session: Session) {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(false)
  const [connection, setConnection] = useState<'connecting' | 'online' | 'offline'>(navigator.onLine ? 'connecting' : 'offline')
  const [error, setError] = useState('')
  const oldest = useRef<Message | null>(null)

  const fetchPage = useCallback(async (older = false) => {
    if (!supabase) return
    setError('')
    const cursor = older ? oldest.current : null
    let query = supabase.from('messages').select('id,channel_id,author_id,content,created_at,profiles(username)')
      .eq('channel_id', channel).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(pageSize)
    if (cursor) query = query.or(`created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`)
    const { data, error: queryError } = await query
    if (queryError) { setError('Falha ao carregar mensagens. Tente novamente.'); setLoading(false); return }
    const page = (data ?? []) as unknown as Message[]
    setMessages(current => mergeMessages(current, page))
    const first = !oldest.current
    if (older || first) oldest.current = page.at(-1) ?? oldest.current
    if (older || first) setHasMore(page.length === pageSize)
    setLoading(false)
  }, [channel])

  useEffect(() => {
    let active = true
    queueMicrotask(() => { if (active) void fetchPage() })
    const online = () => { setConnection('connecting'); void fetchPage() }
    const offline = () => setConnection('offline')
    window.addEventListener('online', online)
    window.addEventListener('offline', offline)
    const stream = supabase?.channel(`chat:${channel}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `channel_id=eq.${channel}` }, () => { void fetchPage() })
      .subscribe(status => {
        if (status === 'SUBSCRIBED') { setConnection('online'); void fetchPage() }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') setConnection('offline')
      })
    return () => {
      active = false
      window.removeEventListener('online', online)
      window.removeEventListener('offline', offline)
      if (stream) void supabase?.removeChannel(stream)
    }
  }, [channel, fetchPage])

  async function send(text: string, id: string) {
    if (!supabase) throw new Error('Supabase não configurado.')
    const content = validateMessage(text)
    const { error: sendError } = await supabase.from('messages').insert({ id, channel_id: channel, author_id: session.user.id, content })
    if (sendError && sendError.code !== '23505') throw new Error('Mensagem não enviada. Verifique sua conexão e tente novamente.')
    await fetchPage()
  }

  return { messages, loading, hasMore, connection, error, send, loadMore: () => fetchPage(true), reload: () => fetchPage() }
}
