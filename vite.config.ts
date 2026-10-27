import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import type { Plugin } from "vite"
import { defineConfig } from "vitest/config"

import { handleNews } from "./server/news"

/**
 * Serves the news function during `vite dev` / `vite preview`, so local
 * development matches production (where api/news.ts runs on Vercel).
 */
function newsApi(): Plugin {
  // Must not return anything: Vite treats a returned function as a post-hook.
  const mount = (server: {
    middlewares: { use: (path: string, fn: typeof handleNews) => void }
  }) => {
    server.middlewares.use("/api/news", handleNews)
  }
  return {
    name: "coinwave-news-api",
    configureServer: mount,
    configurePreviewServer: mount,
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), newsApi()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Framework code changes rarely; keeping it in its own chunk lets
        // browsers reuse the cached copy across app deploys.
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined
          if (
            /node_modules\/(react|react-dom|react-router|scheduler)\//.test(id)
          )
            return "framework"
          if (id.includes("@tanstack")) return "query"
          return undefined
        },
      },
    },
  },
  test: {
    include: ["src/**/*.test.ts", "server/**/*.test.ts"],
  },
})
