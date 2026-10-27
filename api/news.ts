// Vercel serverless function: GET /api/news
// Aggregates publisher RSS feeds (see server/news.ts). Cached at the edge for
// five minutes so every visitor shares the same few upstream requests.
import { handleNews } from "../server/news"

export default handleNews
