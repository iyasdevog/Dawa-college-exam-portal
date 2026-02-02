import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    server: {
        port: 3002,
        host: '0.0.0.0',
    },
    plugins: [
        react()
    ],
    build: {
        rollupOptions: {
            input: {
                main: path.resolve(__dirname, 'index-debug.html')
            }
        }
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, '.'),
        }
    }
});