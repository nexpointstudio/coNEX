export function unreadCount(items: { read_at: string | null }[]) {
  return items.reduce((count, item) => count + (item.read_at ? 0 : 1), 0)
}
