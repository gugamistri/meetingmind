import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  
  // Vite options specific for Tauri development
  clearScreen: false,
  
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      // Tell vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },

  // Path resolution
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  // Build configuration
  build: {
    target: 'esnext',
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunk for external dependencies
          vendor: ['react', 'react-dom'],
          // UI components chunk
          ui: [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-label',
            '@radix-ui/react-select',
            '@radix-ui/react-separator',
            '@radix-ui/react-switch',
            '@radix-ui/react-tooltip',
          ],
          // Tauri API chunk
          tauri: ['@tauri-apps/api', '@tauri-apps/plugin-shell'],
        }
      }
    },
    // Disable minification in development for better debugging
    minify: process.env.NODE_ENV === 'production' ? 'esbuild' : false,
    sourcemap: true,
  },

  // Enable environment variables with VITE_ prefix
  envPrefix: ['VITE_', 'TAURI_'],
})