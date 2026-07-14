import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { type Plugin, defineConfig } from 'vite'

/** Soft Vite warning threshold; hard fail is enforced by scripts/check-bundle-budget.mjs */
const CHUNK_SIZE_WARNING_LIMIT_KB = 500

function clientHeadersDevPlugin(): Plugin {
	return {
		name: 'locatone-client-headers-dev',
		configureServer(server) {
			server.middlewares.use('/api/client-headers', (req, res) => {
				res.setHeader('Cache-Control', 'no-store')
				res.setHeader('Content-Type', 'application/json; charset=utf-8')
				const headerRaw: unknown = Reflect.get(req.headers, 'accept-language')
				let acceptLanguage: string | undefined
				if (typeof headerRaw === 'string') {
					acceptLanguage = headerRaw
				} else if (
					Array.isArray(headerRaw) &&
					typeof headerRaw[0] === 'string'
				) {
					acceptLanguage = headerRaw[0]
				}
				res.statusCode = 200
				res.end(
					JSON.stringify({
						available: true,
						...(acceptLanguage !== undefined && acceptLanguage.length > 0
							? { acceptLanguage }
							: {}),
					}),
				)
			})
		},
	}
}

/** Local Vite stand-in for Vercel `/api/edge-geo` — no CDN geo headers in dev. */
function edgeGeoDevPlugin(): Plugin {
	return {
		name: 'locatone-edge-geo-dev',
		configureServer(server) {
			server.middlewares.use('/api/edge-geo', (req, res) => {
				res.setHeader('Cache-Control', 'no-store')
				res.setHeader('Content-Type', 'application/json; charset=utf-8')
				if (req.method !== 'GET' && req.method !== 'HEAD') {
					res.statusCode = 405
					res.end(
						JSON.stringify({
							available: false,
							reason: 'method_not_allowed',
						}),
					)
					return
				}
				const forwarded: unknown = Reflect.get(req.headers, 'x-forwarded-for')
				let ip: string | undefined
				if (typeof forwarded === 'string' && forwarded.length > 0) {
					ip = forwarded.split(',')[0]?.trim()
				} else {
					const realIp: unknown = Reflect.get(req.headers, 'x-real-ip')
					if (typeof realIp === 'string' && realIp.length > 0) {
						ip = realIp
					}
				}
				res.statusCode = 200
				res.end(
					JSON.stringify({
						available: false,
						reason: 'no_edge_headers',
						...(ip !== undefined && ip.length > 0 ? { ip } : {}),
					}),
				)
			})
		},
	}
}

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
			clientHeadersDevPlugin(),
			edgeGeoDevPlugin(),
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
							{
								name: 'leaflet',
								test: /node_modules[/\\](?:leaflet|react-leaflet)[/\\]/,
							},
						],
					},
				},
			},
		},
	}
})
