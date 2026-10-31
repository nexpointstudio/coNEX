import { useRegisterSW } from 'virtual:pwa-register/react'

export function PwaStatus({ draftPending }: { draftPending: boolean }) {
  const { needRefresh: [needRefresh], offlineReady: [offlineReady], updateServiceWorker } = useRegisterSW({
    onRegisteredSW: (_url, registration) => {
      if (registration) setInterval(() => { if (navigator.onLine) void registration.update() }, 60 * 60 * 1000)
    },
    onRegisterError: error => console.error('Falha no registro da PWA', error),
  })
  if (!needRefresh && !offlineReady) return null
  return <div className="pwa-status" role="status">
    {needRefresh ? <><span>Nova versão do coNEX disponível{draftPending ? '. Envie ou copie sua mensagem antes de atualizar.' : '.'}</span><button disabled={draftPending} onClick={() => void updateServiceWorker(true)}>Atualizar agora</button></> : <span>coNEX pronto para uso offline da interface.</span>}
  </div>
}
