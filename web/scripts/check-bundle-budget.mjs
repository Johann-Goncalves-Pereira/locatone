import { readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const MAX_CHUNK_BYTES = 500 * 1024
const ASSETS_DIR = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	'../dist/assets',
)

async function main() {
	let entries
	try {
		entries = await readdir(ASSETS_DIR)
	} catch {
		console.error(
			`Bundle budget check failed: missing ${ASSETS_DIR}. Run vite build first.`,
		)
		process.exit(1)
	}

	const jsChunks = entries.filter(name => name.endsWith('.js'))
	if (jsChunks.length === 0) {
		console.error('Bundle budget check failed: no JS chunks in dist/assets.')
		process.exit(1)
	}

	const oversized = []

	for (const name of jsChunks) {
		const filePath = path.join(ASSETS_DIR, name)
		const { size } = await stat(filePath)
		const sizeKb = (size / 1024).toFixed(2)
		console.log(`  ${name.padEnd(40)} ${sizeKb.padStart(8)} kB`)

		if (size > MAX_CHUNK_BYTES) {
			oversized.push({ name, size })
		}
	}

	if (oversized.length > 0) {
		console.error(
			`\nBundle budget exceeded (max ${String(MAX_CHUNK_BYTES / 1024)} kB per JS chunk):`,
		)
		for (const chunk of oversized) {
			console.error(`  - ${chunk.name}: ${(chunk.size / 1024).toFixed(2)} kB`)
		}
		console.error(
			'\nSplit vendors with build.rolldownOptions.output.advancedChunks or lazy-load routes/features.',
		)
		process.exit(1)
	}

	console.log(
		`\nBundle budget OK: all ${String(jsChunks.length)} JS chunks ≤ ${String(MAX_CHUNK_BYTES / 1024)} kB.`,
	)
}

await main()
