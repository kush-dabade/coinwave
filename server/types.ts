// Types shared by the news server function and the browser app.
// Kept free of Node imports so the app bundle can depend on it.
import type { NewsItem } from "./rss"

export type { NewsItem }

export type SourceStatus = {
  id: string
  name: string
  ok: boolean
  count: number
  error: string | null
}

export type NewsPayload = {
  fetchedAt: number
  items: NewsItem[]
  sources: SourceStatus[]
}
