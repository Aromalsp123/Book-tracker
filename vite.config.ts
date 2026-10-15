import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
	plugins: [react()],
	publicDir: 'static',
	server: {
		proxy: {
			'/api/openlibrary': {
				target: 'https://openlibrary.org',
				changeOrigin: true,
				rewrite: (path) => path.replace(/^\/api\/openlibrary/, '')
			}
		}
	},
	resolve: {
		alias: {
			'$lib': resolve(__dirname, 'src/lib')
		}
	},
	build: {
		outDir: 'public',
		emptyOutDir: true,
		rollupOptions: {
			input: resolve(__dirname, 'index.html'),
			output: {
				manualChunks(id) {
					if (id.includes('/node_modules/@firebase/firestore/')) return 'firebase-firestore';
				}
			}
		}
	},
});
