import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    proxy: {
      // GitHub OAuth device flow (login/device/code + login/oauth/access_token)
      '/api/github-login': {
        target: 'https://github.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/github-login/, ''),
      },
      // Exchange a GitHub token for a short-lived Copilot token
      '/api/copilot-token': {
        target: 'https://api.github.com',
        changeOrigin: true,
        rewrite: () => '/copilot_internal/v2/token',
      },
      // Real GitHub Copilot chat/completions + models API (used by VS Code)
      '/api/copilot': {
        target: 'https://api.githubcopilot.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/copilot/, ''),
      },
      '/api/ollama': {
        target: 'http://localhost:11434',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/ollama/, ''),
      },
      '/api/llamacpp': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/llamacpp/, ''),
      },
    },
  },
})
