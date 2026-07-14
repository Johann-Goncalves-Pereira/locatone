/* Locatone classic same-origin Worker Intl probe (not blob). */
self.onmessage = function () {
	var opts = Intl.DateTimeFormat().resolvedOptions()
	var languages = []
	try {
		languages = Array.prototype.slice.call(self.navigator.languages || [])
	} catch {
		/* ignore */
	}
	self.postMessage({
		timeZone: opts.timeZone || '',
		language: self.navigator.language || '',
		languages: languages,
	})
}
