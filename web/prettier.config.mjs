/** @type {import('prettier').Config} */
const config = {
	// Formatting
	semi: false,
	singleQuote: true,
	trailingComma: 'all',
	useTabs: true,
	tabWidth: 2,
	printWidth: 80,
	endOfLine: 'lf',
	proseWrap: 'always',

	// JSX/HTML
	jsxSingleQuote: true,
	bracketSpacing: true,
	htmlWhitespaceSensitivity: 'css',

	// Quotes
	quoteProps: 'as-needed',
	arrowParens: 'avoid',

	// Pragma
	insertPragma: false,
	requirePragma: false,

	// CSS declaration order (prettier-plugin-css-order)
	cssDeclarationSorterOrder: 'concentric-css',

	// Plugins
	plugins: [
		'@trivago/prettier-plugin-sort-imports',
		'prettier-plugin-css-order',
		'prettier-plugin-tailwindcss',
	],

	// Import sort: React → third-party → @app → @lib → @features → other aliases → relative
	importOrder: [
		'^react$',
		'<THIRD_PARTY_MODULES>',
		'^@app/(.*)$',
		'^@lib/(.*)$',
		'^@features/(.*)$',
		'^@components/(.*)$',
		'^@layout/(.*)$',
		'^@pages/(.*)$',
		'^@/(.*)$',
		'^[./]',
	],
	importOrderSeparation: true,
	importOrderSortSpecifiers: true,
	importOrderParserPlugins: ['typescript', 'jsx'],
}

export default config
