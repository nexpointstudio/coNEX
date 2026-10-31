import { useEffect, useState, type FormEvent } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { login, register } from './auth'

export function AuthScreen() {
  const token = new URLSearchParams(location.search).get('invite') ?? ''
  useEffect(() => { if (token) history.replaceState(null, '', location.pathname) }, [token])
  const [mode, setMode] = useState<'login' | 'register'>(token ? 'register' : 'login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setSuccess('')
    setBusy(true)
    try {
      if (mode === 'register') {
        await register(username, password, token)
        history.replaceState(null, '', location.pathname)
        setSuccess('Conta criada. Entre com seu nome e senha.')
        setMode('login')
      } else await login(username, password, remember)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha inesperada.')
    } finally {
      setBusy(false)
    }
  }

  return <main className="auth-screen"><form className="auth-card" onSubmit={submit}>
    <div className="rail-logo">N</div><h1>coNEX</h1>
    <p>Comunicação privada do NexPoint Studio</p>
    <div className="auth-switch"><button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>Entrar</button><button type="button" className={mode === 'register' ? 'active' : ''} onClick={() => setMode('register')}>Criar conta</button></div>
    <label>Nome de usuário<input autoComplete="username" required value={username} maxLength={24} onChange={event => setUsername(event.target.value)} /></label>
    <label>Senha<div className="password-field"><input type={show ? 'text' : 'password'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required value={password} onChange={event => setPassword(event.target.value)} /><button type="button" aria-label={show ? 'Ocultar senha' : 'Mostrar senha'} onClick={() => setShow(!show)}>{show ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div></label>
    {mode === 'login' ? <label className="remember"><input type="checkbox" checked={remember} onChange={event => setRemember(event.target.checked)} /> Manter conectado neste dispositivo</label> : <p className="auth-help">É necessário abrir um link de convite válido. A senha deve ter pelo menos 12 caracteres.</p>}
    {error && <p role="alert" className="auth-error">{error}</p>}{success && <p role="status" className="auth-success">{success}</p>}
    <button className="auth-submit" disabled={busy} type="submit">{busy ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Criar conta'}</button>
  </form></main>
}
