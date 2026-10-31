import { useCallback, useEffect, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase/client'
import { validateMessage, type Channel, type Message } from './types'

const pageSize = 40
function merge(current: Message[], incoming: Message[]) {
  const map = new Map(current.map(message => [message.id, message]))
  incoming.forEach(message => map.set(message.id, message))
  return [...map.values()].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
}

export function useChat(channel: Channel, session: Session) {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(false)
  const [connection, setConnection] = useState<'connecting' | 'online' | 'offline'>('connecting')
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
    setMessages(current => merge(current, page))
    const first = !oldest.current
    if (older || first) oldest.current = page.at(-1) ?? oldest.current
    if (older || first) setHasMore(page.length === pageSize)
    setLoading(false)
  }, [channel])

  useEffect(() => {
    setMessages([])
    oldest.current = null
    setLoading(true)
    setConnection(navigator.onLine ? 'connecting' : 'offline')
    void fetchPage()
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
      window.removeEventListener('online', online)
      window.removeEventListener('offline', offline)
      if (stream) void supabase?.removeChannel(stream)
    }
  }, [channel, fetchPage])

  async function send(text: string) {
    if (!supabase) throw new Error('Supabase não configurado.')
    const content = validateMessage(text)
    const { error: sendError } = await supabase.from('messages').insert({ channel_id: channel, author_id: session.user.id, content })
    if (sendError) throw new Error('Mensagem não enviada. Verifique sua conexão e tente novamente.')
    await fetchPage()
  }

  return { messages, loading, hasMore, connection, error, send, loadMore: () => fetchPage(true), reload: () => fetchPage() }
}
