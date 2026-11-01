import type { Message } from './types'

export function mergeMessages(current: Message[], incoming: Message[]) {
  const map = new Map(current.map(message => [message.id, message]))
  incoming.forEach(message => map.set(message.id, message))
  return [...map.values()].sort((a, b) =>
    a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
}

export function isNearBottom(scrollHeight: number, scrollTop: number, clientHeight: number) {
  return scrollHeight - scrollTop - clientHeight < 100
}
