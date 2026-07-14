/**
 * Echo browser request headers the page cannot read (Accept-Language).
 * Survives VPN exit spoofing — ProtonVPN does not rewrite Accept-Language.
 */

module.exports = function handler(req, res) {
	res.setHeader('Cache-Control', 'no-store')
	res.setHeader('Content-Type', 'application/json; charset=utf-8')

	if (req.method !== 'GET' && req.method !== 'HEAD') {
		res.statusCode = 405
		res.end(JSON.stringify({ available: false, reason: 'method_not_allowed' }))
		return
	}

	const headers = req.headers || {}
	const acceptLanguage =
		typeof headers['accept-language'] === 'string'
			? headers['accept-language']
			: undefined

	res.statusCode = 200
	res.end(
		JSON.stringify({
			available: true,
			acceptLanguage: acceptLanguage || undefined,
		}),
	)
}
