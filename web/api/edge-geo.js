/**
 * Server-seen geo from the visitor's real TCP exit IP.
 * Cannot be forged by rewriting client IP-geo API bodies — requires a
 * matching proxy exit for Locatone to align with a spoofed place.
 */

function parseCoord(value) {
	if (value == null || value === '') return undefined
	const n = Number(value)
	return Number.isFinite(n) ? n : undefined
}

module.exports = function handler(req, res) {
	res.setHeader('Cache-Control', 'no-store')
	res.setHeader('Content-Type', 'application/json; charset=utf-8')

	if (req.method !== 'GET' && req.method !== 'HEAD') {
		res.statusCode = 405
		res.end(JSON.stringify({ available: false, reason: 'method_not_allowed' }))
		return
	}

	const headers = req.headers || {}
	const country =
		headers['x-vercel-ip-country'] || (req.geo && req.geo.country) || undefined
	const region =
		headers['x-vercel-ip-country-region'] ||
		(req.geo && req.geo.region) ||
		undefined
	const city =
		headers['x-vercel-ip-city'] || (req.geo && req.geo.city) || undefined
	const latitude = parseCoord(
		headers['x-vercel-ip-latitude'] || (req.geo && req.geo.latitude),
	)
	const longitude = parseCoord(
		headers['x-vercel-ip-longitude'] || (req.geo && req.geo.longitude),
	)
	const ip =
		headers['x-real-ip'] ||
		(typeof headers['x-forwarded-for'] === 'string'
			? headers['x-forwarded-for'].split(',')[0].trim()
			: undefined) ||
		undefined

	const hasGeo =
		(typeof country === 'string' && country.length > 0) ||
		latitude !== undefined ||
		longitude !== undefined

	if (!hasGeo) {
		res.statusCode = 200
		res.end(
			JSON.stringify({
				available: false,
				reason: 'no_edge_headers',
				ip: ip || undefined,
			}),
		)
		return
	}

	const acceptLanguage =
		typeof headers['accept-language'] === 'string'
			? headers['accept-language']
			: undefined

	const body = {
		available: true,
	}
	if (ip) body.ip = ip
	if (country) body.country = String(country).toUpperCase()
	if (region) body.region = decodeURIComponent(String(region))
	if (city) body.city = decodeURIComponent(String(city))
	if (latitude !== undefined) body.latitude = latitude
	if (longitude !== undefined) body.longitude = longitude
	if (acceptLanguage) body.acceptLanguage = acceptLanguage

	res.statusCode = 200
	res.end(JSON.stringify(body))
}
