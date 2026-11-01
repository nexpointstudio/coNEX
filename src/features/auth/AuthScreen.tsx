
import { useState, type FormEvent } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { login, register } from './auth'

export function AuthScreen() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  function changeMode(nextMode: 'login' | 'register') {
    setMode(nextMode)
    setError('')
    setSuccess('')
    setPassword('')
    setShowPassword(false)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (busy) return

    setBusy(true)
    setError('')
    setSuccess('')

    try {
      if (mode === 'register') {
        await register(username, password)

        setSuccess(
          'Conta criada com sucesso! Entre com seu nome e senha.',
        )

        setMode('login')
        setPassword('')
      } else {
        await login(username, password, remember)
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Ocorreu um erro inesperado.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="auth-screen">
      <form className="auth-card" onSubmit={submit}>
        <div className="rail-logo">N</div>

        <h1>coNEX</h1>

        <p>
          Comunicação privada do NexPoint Studio
        </p>

        <div className="auth-switch">
          <button
            type="button"
            className={mode === 'login' ? 'active' : ''}
            onClick={() => changeMode('login')}
            disabled={busy}
          >
            Entrar
          </button>

          <button
            type="button"
            className={mode === 'register' ? 'active' : ''}
            onClick={() => changeMode('register')}
            disabled={busy}
          >
            Criar conta
          </button>
        </div>

        <label>
          Nome de usuário

          <input
            type="text"
            autoComplete="username"
            placeholder="Seu nome de usuário"
            required
            minLength={3}
            maxLength={24}
            value={username}
            onChange={(event) =>
              setUsername(event.target.value)
            }
            disabled={busy}
          />
        </label>

        <label>
          Senha

          <div className="password-field">
            <input
              type={showPassword ? 'text' : 'password'}
              autoComplete={
                mode === 'login'
                  ? 'current-password'
                  : 'new-password'
              }
              placeholder={
                mode === 'register'
                  ? 'Crie uma senha segura'
                  : 'Digite sua senha'
              }
              required
              minLength={mode === 'register' ? 12 : undefined}
              maxLength={128}
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              disabled={busy}
            />

            <button
              type="button"
              aria-label={
                showPassword
                  ? 'Ocultar senha'
                  : 'Mostrar senha'
              }
              onClick={() =>
                setShowPassword(!showPassword)
              }
            >
              {showPassword ? (
                <EyeOff size={18} />
              ) : (
                <Eye size={18} />
              )}
            </button>
          </div>
        </label>

        {mode === 'login' ? (
          <label className="remember">
            <input
              type="checkbox"
              checked={remember}
              onChange={(event) =>
                setRemember(event.target.checked)
              }
              disabled={busy}
            />

            Manter conectado neste dispositivo
          </label>
        ) : (
          <p className="auth-help">
            Escolha um nome de usuário único e uma senha
            com pelo menos 12 caracteres.
          </p>
        )}

        {error && (
          <p role="alert" className="auth-error">
            {error}
          </p>
        )}

        {success && (
          <p role="status" className="auth-success">
            {success}
          </p>
        )}

        <button
          className="auth-submit"
          type="submit"
          disabled={busy}
        >
          {busy
            ? 'Aguarde...'
            : mode === 'login'
              ? 'Entrar'
              : 'Criar conta'}
        </button>
      </form>
    </main>
  )
}
