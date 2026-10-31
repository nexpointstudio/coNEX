import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Bell, ChevronDown, Code2, Compass, Gamepad2, Hash, Headphones, Menu, MessageCircle, Paperclip, Radio, Send, Settings, ShieldCheck, Sparkles, X } from 'lucide-react'
import { AuthScreen } from './features/auth/AuthScreen'
import { logout } from './features/auth/auth'
import { useChat } from './features/chat/useChat'
import { channels, type Channel } from './features/chat/types'
import { useNotifications } from './features/notifications/useNotifications'
import { useSession } from './hooks/useSession'
import { configured } from './lib/supabase/client'
import { PwaStatus } from './components/PwaStatus'

type Area = 'chat' | 'studio' | 'social'
type ChatProps = { channel: Channel; session: Session; draft: string; setDraft: (value: string) => void }

function ConnectedChat({ channel, session, draft, setDraft }: ChatProps) {
  const { messages, loading, hasMore, connection, error, send, loadMore, reload } = useChat(channel, session)
  const [sendError, setSendError] = useState('')
  const [sending, setSending] = useState(false)
  const scroll = useRef<HTMLDivElement>(null)
  const pinned = useRef(true)
  useEffect(() => { if (pinned.current) scroll.current?.scrollTo({ top: scroll.current.scrollHeight, behavior: 'smooth' }) }, [messages])
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (sending) return
    setSending(true); setSendError('')
    try { await send(draft); setDraft('') } catch (cause) { setSendError(cause instanceof Error ? cause.message : 'Falha ao enviar.') }
    finally { setSending(false) }
  }
  return <><div className="chat-scroll" ref={scroll} onScroll={event => { const element = event.currentTarget; pinned.current = element.scrollHeight - element.scrollTop - element.clientHeight < 100 }}>
    <div className="chat-intro"><div className="intro-icon"><Hash size={28}/></div><div className="eyebrow">CANAL DE TEXTO</div><h2>Bem-vindo ao #{channel}</h2><p>Converse e organize suas atividades no coNEX.</p></div>
    <div className="chat-date-divider"><span>{connection === 'online' ? 'Conectado' : connection === 'connecting' ? 'Conectando...' : 'Conexão perdida. Reconectando...'}</span></div>
    {error && <p role="alert">{error} <button onClick={() => void reload()}>Tentar novamente</button></p>}
    {hasMore && <button className="load-more" onClick={() => void loadMore()}>Carregar mensagens anteriores</button>}
    {loading ? <p>Carregando mensagens...</p> : messages.length === 0 ? <p>Nenhuma mensagem neste canal.</p> : <div className="messages-list">{messages.map(message => {
      const own = message.author_id === session.user.id
      const name = message.profiles?.username ?? 'Usuário'
      return <article className="chat-message" key={message.id}><div className={`message-avatar ${own ? 'my-avatar' : ''}`}>{name.slice(0, 2).toUpperCase()}</div><div className="message-body"><div className="message-meta"><strong>{name}</strong>{own && <span className="you-tag">Você</span>}<time dateTime={message.created_at}>{new Date(message.created_at).toLocaleString('pt-BR')}</time></div><p>{message.content}</p></div></article>
    })}</div>}
  </div><form className="message-composer" onSubmit={submit}><div className="composer-inner"><span className="composer-attachment" title="Anexos em outra etapa"><Paperclip size={20}/></span><input aria-label={`Mensagem no canal ${channel}`} placeholder={`Mensagem em #${channel}`} maxLength={2000} value={draft} onChange={event => setDraft(event.target.value)}/><button type="submit" className="send-button" disabled={!draft.trim() || sending || connection !== 'online'} aria-label="Enviar mensagem"><Send size={18}/></button></div>{sendError && <span className="composer-error" role="alert">{sendError}</span>}<span className="composer-hint">Até 2000 caracteres. Anexos ainda não disponíveis.</span></form></>
}

function App() {
  const { session, loading } = useSession()
  if (loading) return <div className="auth-screen">Carregando coNEX...</div>
  if (configured && !session) return <><AuthScreen/><PwaStatus draftPending={false}/></>
  return <Workspace session={session}/>
}

function Workspace({ session }: { session: Session | null }) {
  const [area, setArea] = useState<Area>('chat')
  const [channel, setChannel] = useState<Channel>('geral')
  const [drafts, setDrafts] = useState<Record<Channel, string>>({ geral: '', desenvolvimento: '', compartilhamentos: '' })
  const [menuOpen, setMenuOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const notifications = useNotifications(session)
  const markChannelRead = notifications.markChannelRead
  useEffect(() => {
    if (session && notifications.items.some(item => item.channel_id === channel && !item.read_at)) {
      void markChannelRead(channel)
    }
  }, [channel, notifications.items, session, markChannelRead])
  const username = String(session?.user.user_metadata?.username ?? 'Meu perfil')
  const draft = drafts[channel]
  const setDraft = (value: string) => setDrafts(current => ({ ...current, [channel]: value }))
  function changeArea(value: Area) { setArea(value); setMenuOpen(false) }
  function changeChannel(value: Channel) { setChannel(value); changeArea('chat') }
  const title = area === 'chat' ? channel : area === 'studio' ? 'Studio' : 'Social'
  return <><div className="app-shell">
    <aside className="app-rail"><div className="rail-logo" title="coNEX">N</div><div className="rail-divider"/>
      <button className={`rail-button ${area === 'chat' ? 'active' : ''}`} title="Conversas" aria-label="Conversas" onClick={() => changeArea('chat')}><MessageCircle size={22}/></button>
      <button className={`rail-button ${area === 'studio' ? 'active' : ''}`} title="Studio indisponível" aria-label="Studio indisponível" onClick={() => changeArea('studio')}><Code2 size={22}/></button>
      <button className={`rail-button ${area === 'social' ? 'active' : ''}`} title="Social indisponível" aria-label="Social indisponível" onClick={() => changeArea('social')}><Compass size={22}/></button><div className="rail-spacer"/><span className="rail-button static-icon" title="Configurações em breve"><Settings size={21}/></span>
    </aside>
    {menuOpen && <button className="sidebar-backdrop" aria-label="Fechar menu" onClick={() => setMenuOpen(false)}/>}
    <aside className={`app-sidebar ${menuOpen ? 'open' : ''}`}><div className="workspace-header"><div className="workspace-symbol">N</div><div className="workspace-name"><strong>NexPoint Studio</strong><span>{session ? 'Espaço privado' : 'Prévia local'}</span></div><ChevronDown size={17}/></div>
      <div className="sidebar-scroll"><div className="sidebar-label">CANAIS DE TEXTO</div>{channels.map(item => <button key={item} className={`channel-link ${area === 'chat' && channel === item ? 'selected' : ''}`} onClick={() => changeChannel(item)}><Hash size={17}/><span>{item}</span></button>)}
        <div className="sidebar-label space-top">CANAIS DE VOZ · INDISPONÍVEIS</div><div className="channel-link static-channel"><Headphones size={17}/><span>Sala de criação</span></div><div className="channel-link static-channel"><Gamepad2 size={17}/><span>Jogando juntos</span></div><div className="voice-note"><Radio size={14}/>Chamadas em outra etapa</div></div>
      <div className="profile-bar"><div className="profile-avatar">{username.slice(0, 2).toUpperCase()}<span className="online-indicator"/></div><div className="profile-info"><strong>{username}</strong><span>{session ? 'Conectado' : 'Demonstração'}</span></div>{session && <button className="logout-button" onClick={() => void logout()}>Sair</button>}</div>
    </aside>
    <main className="app-main"><header className="main-header"><button className="mobile-menu" aria-label="Abrir menu" onClick={() => setMenuOpen(true)}><Menu size={22}/></button><div className="header-title"><span className="header-path">coNEX / NexPoint Studio</span><h1>{area === 'chat' ? <Hash size={21}/> : <Sparkles size={21}/>} {title}</h1></div><div className="header-actions"><span className="preview-pill"><span className="preview-dot"/>{session ? 'Espaço privado' : 'Prévia local'}</span><button className="header-icon-button" aria-label={`Notificações: ${notifications.unread} não lidas`} title="Notificações" onClick={() => setNotificationsOpen(!notificationsOpen)}><Bell size={20}/>{notifications.unread > 0 && <span className="notification-count">{notifications.unread}</span>}</button></div>
      {notificationsOpen && <div className="notifications-popup"><div className="popup-heading"><strong>Notificações</strong><button aria-label="Fechar notificações" onClick={() => setNotificationsOpen(false)}><X size={17}/></button></div>{notifications.error && <p role="alert">{notifications.error}</p>}{!session ? <p>Disponíveis após configurar o Supabase.</p> : notifications.items.length === 0 ? <p>Nenhuma notificação.</p> : <><button className="text-button" onClick={() => void notifications.markRead()}>Marcar todas como lidas</button>{notifications.items.map(item => <button key={item.id} className={`popup-item notification-item ${!item.read_at ? 'unread' : ''}`} onClick={() => { changeChannel(item.channel_id); void notifications.markRead(item.id); setNotificationsOpen(false) }}><Bell size={16}/><span>Nova mensagem em #{item.channel_id}<small>{new Date(item.created_at).toLocaleString('pt-BR')}</small></span></button>)}</>}</div>}</header>
      {area === 'chat' ? session ? <ConnectedChat key={channel} channel={channel} session={session} draft={draft} setDraft={setDraft}/> : <div className="chat-scroll"><div className="chat-intro"><div className="intro-icon"><Hash size={28}/></div><div className="eyebrow">PRÉVIA LOCAL</div><h2>Bem-vindo ao #{channel}</h2><p>Esta é uma demonstração da interface. Configure o Supabase para criar uma conta e conversar online.</p></div></div> : <div className="dashboard-scroll"><div className="dashboard-hero"><div className="eyebrow">{area === 'studio' ? 'STUDIO' : 'SOCIAL'}</div><h2>{area === 'studio' ? 'Seu espaço para criar.' : 'Tudo o que você gosta, conectado.'}</h2><p>{area === 'studio' ? 'Projetos, código e ferramentas reunidos no coNEX.' : 'Conteúdo e atividades sociais integrados às suas conversas.'}</p><span className="coming-soon">Módulo indisponível nesta versão</span></div></div>}
      <nav className="mobile-navigation" aria-label="Navegação principal"><button className={area === 'chat' ? 'active' : ''} onClick={() => changeArea('chat')}><MessageCircle size={21}/><span>Conversas</span></button><button className={area === 'studio' ? 'active' : ''} onClick={() => changeArea('studio')}><Code2 size={21}/><span>Studio</span></button><button className={area === 'social' ? 'active' : ''} onClick={() => changeArea('social')}><Compass size={21}/><span>Social</span></button></nav>
    </main>
    <aside className="details-panel"><div className="details-top"><Sparkles size={18}/><span>Seu espaço, conectado.</span></div><div className="details-content"><div className="details-label">coNEX STUDIO</div><div className="details-feature"><div className="details-feature-icon"><ShieldCheck size={24}/></div><h3>Um espaço privado para sua equipe.</h3><p>Conversas organizadas em um só aplicativo.</p></div><div className="details-separator"/><div className="details-label">STATUS DO PROJETO</div><div className="project-progress"><div className="progress-top"><span>Chat privado V1</span><span>{session ? 'Conectado' : 'Aguardando Supabase'}</span></div><p>Studio, Social e voz serão implementados em outra etapa.</p></div></div><div className="details-footer"><span className="brand-small">co<strong>NEX</strong></span><span>Versão 1</span></div></aside>
  </div><PwaStatus draftPending={Object.values(drafts).some(value => Boolean(value.trim()))}/></>
}

export default App
