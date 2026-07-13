import { StrictMode } from 'react'

import { createRoot } from 'react-dom/client'

import App from '@app/App'

import './main.css'

if (import.meta.env.DEV) {
	void import('react-scan').then(({ scan }) => {
		scan({
			enabled: true,
		})
	})
}

const rootElement = document.getElementById('root')
if (!rootElement) {
	throw new Error('Root element not found')
}

createRoot(rootElement).render(
	<StrictMode>
		<App />
	</StrictMode>,
)
