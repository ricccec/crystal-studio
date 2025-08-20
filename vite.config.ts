import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron/simple';
import path from 'node:path';

export default defineConfig({
	root: path.join(__dirname, 'src/renderer'),
	publicDir: path.join(__dirname, 'public'),
	build: {
		outDir: path.join(__dirname, 'dist/renderer'),
		emptyOutDir: true, // Clear folder before build
		sourcemap: true,
	},
	resolve: {
		alias: {
			'@': path.join(__dirname, 'src/renderer'),
			'@shared': path.join(__dirname, 'src/shared'),
			'@main': path.join(__dirname, 'src/main'),
      		'@preload': path.join(__dirname, 'src/preload'),
		},
	},
	plugins: [
		react(),
		electron({
			main: { 
				entry: path.join(__dirname, 'src/main/main.ts'),
				vite: {
					resolve: {
						alias: {
							'@': path.join(__dirname, 'src/renderer'),
							'@shared': path.join(__dirname, 'src/shared'),
							'@main': path.join(__dirname, 'src/main'),
							'@preload': path.join(__dirname, 'src/preload'),
						},
					},
					build: {
						outDir: path.join(__dirname, 'dist-electron')
					}
				}
			},
			preload: {
				input: path.join(__dirname, 'src/preload/preload.ts'),
				vite: {
					resolve: {
						alias: {
							'@': path.join(__dirname, 'src/renderer'),
							'@shared': path.join(__dirname, 'src/shared'),
							'@main': path.join(__dirname, 'src/main'),
							'@preload': path.join(__dirname, 'src/preload'),
						},
					},
					build: {
						outDir: path.join(__dirname, 'dist-electron')
					}
				}
			},
		}),
	],
});
