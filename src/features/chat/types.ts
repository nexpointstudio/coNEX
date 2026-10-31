export type Channel = 'geral' | 'desenvolvimento' | 'compartilhamentos'
export const channels: Channel[] = ['geral', 'desenvolvimento', 'compartilhamentos']
export type Message = {
  id: string
  channel_id: Channel
  author_id: string
  content: string
  created_at: string
  profiles: { username: string } | null
}

export function validateMessage(text: string) {
  const content = text.trim()
  if (!content || content.length > 2000) throw new Error('A mensagem deve ter de 1 a 2000 caracteres.')
  return content
}
