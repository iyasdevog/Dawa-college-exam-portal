import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

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
      react()
    ],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY || ''),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || ''),
      'process.env.NODE_ENV': JSON.stringify(mode),
      // Remove development flags in production
      __DEV__: !isProduction,
      __PROD__: isProduction
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
          manualChunks: {
            // Vendor chunks for better caching
            'react-vendor': ['react', 'react-dom'],
            'firebase-vendor': ['firebase/app', 'firebase/firestore', 'firebase/auth'],
            'charts-vendor': ['recharts'],
            'excel-vendor': ['xlsx'],
            'ai-vendor': ['@google/genai'],

            // Feature-based chunks
            'dashboard-features': [
              './src/presentation/components/Dashboard.tsx',
              './src/domain/services/ReportingService.ts'
            ],
            'faculty-features': [
              './src/presentation/components/FacultyEntry.tsx',
              './src/presentation/components/Management.tsx'
            ],
            'public-features': [
              './src/presentation/components/PublicPortal.tsx',
              './src/presentation/components/ClassResults.tsx',
              './src/presentation/components/StudentScorecard.tsx'
            ],
            'infrastructure-services': [
              './src/infrastructure/services/dataService.ts',
              './src/infrastructure/services/EnhancedDataService.ts',
              './src/infrastructure/services/AIService.ts'
            ]
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
        // External dependencies that should not be bundled
        external: (id) => {
          // Keep all dependencies bundled for better performance in this case
          return false;
        },
        // Advanced tree shaking configuration
        treeshake: {
          moduleSideEffects: false,
          propertyReadSideEffects: false,
          tryCatchDeoptimization: false,
          unknownGlobalSideEffects: false
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
        // Remove all console statements except errors and warnings
        terserOptions: {
          compress: {
            drop_console: true,
            drop_debugger: true,
            pure_funcs: ['console.log', 'console.info', 'console.debug']
          }
        },
        // Optimize for production
        reportCompressedSize: true,
        // Enable advanced minification
        minify: 'terser'
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
