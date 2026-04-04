// @ts-check
import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import react from '@astrojs/react';
import node from '@astrojs/node';
// https://astro.build/config
export default defineConfig({
  site: process.env.SITE || 'http://localhost:4000', 
  output: 'server',
  adapter: node({
    mode: 'standalone'
  }),
  integrations: [
    tailwind(),
    react({
      include: ['**/react/*', '**/components/*'],
    })
  ],
  server: {
    port: parseInt(process.env.PORT || '4000'),
    host: process.env.HOST || '0.0.0.0',
    headers: {
      'Cache-Control': 'no-cache'
    }
  },
  vite: {
    base: '/',
    optimizeDeps: {
      include: [
        'react',
        'react-dom'
      ],
      exclude: ['react-grid-layout']
    },
    build: {
      sourcemap: false,
      minify: true
    },
    server: {
      hmr: {
        overlay: false,
        protocol: 'ws'
      },
      watch: {
        usePolling: false,
        ignored: ['**/node_modules/**', '**/dist/**']
      },
      fs: {
        strict: true,
        allow: [
          // Allow access to the project root
          '.',
          // Allow access to node_modules for necessary packages
          'node_modules/@astrojs/tailwind',
          'node_modules/astro',
          'node_modules/vite'
        ]
      }
    }
  }
});
