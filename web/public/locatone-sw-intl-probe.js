/* Locatone service-worker Intl probe — short-lived; unregistered after reply. */
self.addEventListener('message', event => {
	const opts = Intl.DateTimeFormat().resolvedOptions()
	let languages = []
	try {
		languages = Array.prototype.slice.call(self.navigator.languages || [])
	} catch {
		/* ignore */
	}
	const reply = {
		timeZone: opts.timeZone || '',
		language: self.navigator.language || '',
		languages,
	}
	if (event.source && typeof event.source.postMessage === 'function') {
		event.source.postMessage(reply)
		return
	}
	if (event.ports && event.ports[0]) {
		event.ports[0].postMessage(reply)
	}
})
