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
    build: {
      // Optimize bundle size
      target: 'es2020',
      minify: isProduction ? 'esbuild' : false,
      // Secure source map handling
      sourcemap: isProduction ? 'hidden' : true,
      // Optimize chunk size warnings
      chunkSizeWarningLimit: 1500,
      // Enable CSS code splitting
      cssCodeSplit: true,
      // Optimize asset inlining
      assetsInlineLimit: 4096,
      // Remove unused CSS
      cssMinify: isProduction,
      // Production-specific optimizations
      ...(isProduction && {
        reportCompressedSize: true,
        // esbuild-native configuration with name preservation to prevent identifier collisions
        esbuild: {
          keepNames: true,
          drop: ['console', 'debugger'],
          pure: ['console.log', 'console.info', 'console.debug']
        }
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
