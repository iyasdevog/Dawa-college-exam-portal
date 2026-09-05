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
      // Enable code splitting and chunk optimization
      rollupOptions: {
        output: {
          // Manual chunk splitting for better caching
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('firebase')) {
                return 'firebase-vendor';
              }
              if (id.includes('recharts') || id.includes('d3-')) {
                return 'charts-vendor';
              }
              if (id.includes('xlsx')) {
                return 'excel-vendor';
              }
              if (id.includes('@google/genai')) {
                return 'ai-vendor';
              }
              return 'vendor';
            }
          },
          // Optimize chunk file names for caching
          chunkFileNames: (chunkInfo) => {
            const facadeModuleId = chunkInfo.facadeModuleId
              ? chunkInfo.facadeModuleId.split('/').pop()?.replace('.tsx', '').replace('.ts', '')
              : 'chunk';
            return `assets/js/[name]-[hash].js`;
          },
          entryFileNames: 'assets/js/[name]-[hash].js',
          assetFileNames: (assetInfo) => {
            const info = assetInfo.name?.split('.') || [];
            const ext = info[info.length - 1];
            if (/\.(css)$/.test(assetInfo.name || '')) {
              return 'assets/css/[name]-[hash].[ext]';
            }
            if (/\.(png|jpe?g|svg|gif|tiff|bmp|ico)$/i.test(assetInfo.name || '')) {
              return 'assets/images/[name]-[hash].[ext]';
            }
            if (/\.(woff2?|eot|ttf|otf)$/i.test(assetInfo.name || '')) {
              return 'assets/fonts/[name]-[hash].[ext]';
            }
            return 'assets/[name]-[hash].[ext]';
          }
        },
        treeshake: {
          moduleSideEffects: (id) => {
            if (id.includes('firebase')) return true;
            if (id.includes('node_modules')) return false;
            return true; // preserve app code side effects
          }
        }
      },
      // Optimize bundle size
      target: 'es2020',
      minify: isProduction ? 'esbuild' : false,
      // Secure source map handling
      sourcemap: isProduction ? 'hidden' : true,
      // Optimize chunk size warnings
      chunkSizeWarningLimit: 1000,
      // Enable CSS code splitting
      cssCodeSplit: true,
      // Optimize asset inlining
      assetsInlineLimit: 4096,
      // Remove unused CSS
      cssMinify: isProduction,
      // Production-specific optimizations
      ...(isProduction && {
        reportCompressedSize: true,
        // esbuild-native console/debugger removal (terserOptions was ignored under esbuild)
        esbuild: {
          drop: ['console', 'debugger'],
          // Keep error/warn for production debugging
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
