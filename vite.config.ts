import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  // Tauri: don't clear console, listen on all interfaces
  clearScreen: false,
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
  },
  envPrefix: ['VITE_', 'TAURI_ENV_'],
  build: {
    // Tauri supports ES modules
    target: process.env.TAURI_ENV_PLATFORM === 'windows'
      ? 'chrome105'
      : 'safari13',
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },
  // Capacitor requires relative paths — set base to './' for cap builds via env
  base: process.env.CAPACITOR_BUILD ? './' : '/',
})
