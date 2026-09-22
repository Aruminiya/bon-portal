import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // strictPort：port 被占用時直接失敗，而不是靜默換一個 ——
    // Authentik 的 redirect URI 是逐字比對的，換 port 等於登入直接壞掉，
    // 那種失敗要在啟動時就看見，不是等到按下登入才發現。
    port: 6030,
    strictPort: true,
  },
})
