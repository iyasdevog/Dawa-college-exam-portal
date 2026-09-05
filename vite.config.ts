import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const isProduction = mode === 'production';

  return {
    server: {
      port: 3005,
      strictPort: false,
      host: '0.0.0.0',
    },
    plugins: [
      react(),
      VitePWA({
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'sw.js',
        injectManifest: {
          injectionPoint: undefined
        },
        manifestFilename: 'manifest.json',
        registerType: 'prompt',
        injectRegister: 'auto',
        manifest: {
          name: "Da'wa College Exam Portal",
          short_name: "Exam Portal",
          description: "Exam Portal and Management System",
          theme_color: "#ffffff",
          icons: [
            {
              src: 'icon-192x192.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'icon-512x512.png',
              sizes: '512x512',
              type: 'image/png'
            }
          ]
        }
      })
    ],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY || ''),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || ''),
      'process.env.NODE_ENV': JSON.stringify(mode),
      // Remove development flags in production
      __DEV__: !isProduction,
      __PROD__: isProduction,
      __APP_VERSION__: JSON.stringify(Date.now().toString())
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    },
    // Keep original identifiers to prevent TDZ collisions from minifier renaming.
    // Applied globally (dev + prod) to ensure consistent behavior.
    esbuild: {
      keepNames: true,
      ...(isProduction && {
        drop: ['console', 'debugger'],
        pure: ['console.log', 'console.info', 'console.debug']
      })
    },
    build: {
      // Optimize bundle size
      target: 'es2020',
      minify: isProduction ? 'esbuild' : false,
      // Secure source map handling
      sourcemap: isProduction ? 'hidden' : true,
      // Optimize chunk size warnings
      chunkSizeWarningLimit: 2000,
      // Enable CSS code splitting
      cssCodeSplit: true,
      // Optimize asset inlining
      assetsInlineLimit: 4096,
      // Remove unused CSS
      cssMinify: isProduction,
      rollupOptions: {
        output: {
          // Co-locate all infrastructure services in a single chunk to prevent
          // cross-chunk TDZ (Temporal Dead Zone) evaluation order errors.
          // When services are split across chunks, Rollup may evaluate one chunk
          // (e.g. dataService) before its dependency chunk (firebaseConfig) has 
          // finished executing, causing "Cannot access 'X' before initialization".
          manualChunks(id) {
            // All infrastructure services → one chunk (avoids cross-chunk TDZ)
            if (
              id.includes('/infrastructure/services/') ||
              id.includes('/infrastructure/config/') ||
              id.includes('/infrastructure/utils/')
            ) {
              return 'infrastructure';
            }
            // Firebase SDK → its own chunk (stable, no circular deps)
            if (id.includes('firebase/')) {
              return 'firebase';
            }
            // React core
            if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
              return 'react-vendor';
            }
          }
        }
      },
      // Production-specific optimizations
      ...(isProduction && {
        reportCompressedSize: true,
      })
    },
    // Optimize dependencies
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'firebase/app',
        'firebase/firestore',
        'firebase/auth'
      ],
      exclude: [
        // Exclude heavy libraries from pre-bundling to enable dynamic imports
        'xlsx',
        'recharts',
        '@google/genai'
      ]
    }
  };
});
