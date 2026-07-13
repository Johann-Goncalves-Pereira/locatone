import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { defineConfig } from 'vite'

/** Soft Vite warning threshold; hard fail is enforced by scripts/check-bundle-budget.mjs */
const CHUNK_SIZE_WARNING_LIMIT_KB = 500

export default defineConfig(({ mode }) => {
	const isProduction = mode === 'production'

	return {
		define: {
			'process.env.NODE_ENV': JSON.stringify(
				isProduction ? 'production' : 'development',
			),
			__DEV__: !isProduction,
		},
		plugins: [
			tailwindcss(),
			tanstackRouter({ target: 'react', autoCodeSplitting: true }),
			react({
				babel: {
					plugins: [['babel-plugin-react-compiler', { target: '19' }]],
				},
			}),
		],
		resolve: {
			alias: {
				'@app': path.resolve(__dirname, './src/app'),
				'@components': path.resolve(__dirname, './src/components'),
				'@features': path.resolve(__dirname, './src/features'),
				'@layout': path.resolve(__dirname, './src/layout'),
				'@lib': path.resolve(__dirname, './src/lib'),
				'@pages': path.resolve(__dirname, './src/pages'),
				'@': path.resolve(__dirname, './src'),
			},
		},
		build: {
			chunkSizeWarningLimit: CHUNK_SIZE_WARNING_LIMIT_KB,
			rolldownOptions: {
				output: {
					advancedChunks: {
						groups: [
							{
								name: 'react-vendor',
								test: /node_modules[/\\](?:react|react-dom|scheduler)[/\\]/,
							},
							{
								name: 'tanstack',
								test: /node_modules[/\\]@tanstack[/\\]/,
							},
							{
								name: 'effect',
								test: /node_modules[/\\](?:effect|@effect-atom)[/\\]/,
							},
						],
					},
				},
			},
		},
	}
})
