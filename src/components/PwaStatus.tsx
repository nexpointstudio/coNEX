import { useEffect, useRef } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

export function PwaStatus({ draftPending }: { draftPending: boolean }) {
  const registrationRef = useRef<ServiceWorkerRegistration | undefined>(undefined)
  const { needRefresh: [needRefresh], offlineReady: [offlineReady], updateServiceWorker } = useRegisterSW({
    onRegisteredSW: (_url, registration) => { registrationRef.current = registration },
    onRegisterError: error => console.error('Falha no registro da PWA', error),
  })
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (navigator.onLine) void registrationRef.current?.update()
    }, 60 * 60 * 1000)
    return () => window.clearInterval(timer)
  }, [])
  if (!needRefresh && !offlineReady) return null
  return <div className="pwa-status" role="status">
    {needRefresh ? <><span>Nova versão do coNEX disponível{draftPending ? '. Envie ou copie sua mensagem antes de atualizar.' : '.'}</span><button disabled={draftPending} onClick={() => void updateServiceWorker(true)}>Atualizar agora</button></> : <span>coNEX pronto para uso offline da interface.</span>}
  </div>
}
