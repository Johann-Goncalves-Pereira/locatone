import eslintComments from '@eslint-community/eslint-plugin-eslint-comments/configs'
import js from '@eslint/js'
import vitest from '@vitest/eslint-plugin'
import { importX } from 'eslint-plugin-import-x'
import react from 'eslint-plugin-react'
import reactCompiler from 'eslint-plugin-react-compiler'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import globals from 'globals'
import path from 'path'
import tseslint from 'typescript-eslint'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const bannedPackages = [
	{
		name: 'zod',
		message: 'Use effect/Schema instead of Zod.',
	},
	{
		name: 'zustand',
		message: 'Use @effect-atom/atom-react instead of Zustand.',
	},
	{
		name: '@tanstack/zod-adapter',
		message:
			'Use Effect Schema (Standard Schema) with TanStack Router instead.',
	},
]

/** @type {import('eslint').Config} */
export default [
	{ ignores: ['dist', 'src/routeTree.gen.ts'] },
	js.configs.recommended,
	eslintComments.recommended,
	{
		files: ['**/*.{js,mjs,cjs}'],
		languageOptions: {
			globals: {
				...globals.node,
			},
		},
	},
	...tseslint.configs.strictTypeChecked.map(config => ({
		...config,
		files: ['**/*.{ts,tsx}'],
	})),
	...tseslint.configs.stylisticTypeChecked.map(config => ({
		...config,
		files: ['**/*.{ts,tsx}'],
	})),
	{
		files: ['**/*.{ts,tsx}'],
		languageOptions: {
			ecmaVersion: 2020,
			globals: {
				...globals.browser,
			},
			parser: tseslint.parser,
			parserOptions: {
				projectService: true,
				tsconfigRootDir: __dirname,
			},
		},
		plugins: {
			react,
			'react-hooks': reactHooks,
			'react-refresh': reactRefresh,
			'react-compiler': reactCompiler,
			'import-x': importX,
			vitest,
		},
		rules: {
			...reactHooks.configs.recommended.rules,
			'react-refresh/only-export-components': [
				'error',
				{
					allowConstantExport: true,
					allowExportNames: ['renderWithProviders'],
				},
			],
			'no-unused-vars': 'off',
			'@typescript-eslint/no-unused-vars': [
				'error',
				{
					vars: 'all',
					args: 'after-used',
					ignoreRestSiblings: true,
					argsIgnorePattern: '^_',
					varsIgnorePattern: '^_',
				},
			],
			'@typescript-eslint/consistent-type-imports': [
				'error',
				{ prefer: 'type-imports', fixStyle: 'separate-type-imports' },
			],
			'@typescript-eslint/no-explicit-any': 'error',
			'@typescript-eslint/prefer-nullish-coalescing': 'error',
			'@typescript-eslint/prefer-optional-chain': 'error',
			'@typescript-eslint/no-non-null-assertion': 'error',
			'@typescript-eslint/prefer-as-const': 'error',
			'@typescript-eslint/consistent-type-assertions': [
				'error',
				{ assertionStyle: 'never' },
			],
			'@typescript-eslint/no-unnecessary-type-assertion': 'error',
			'@typescript-eslint/no-floating-promises': 'error',
			'@typescript-eslint/switch-exhaustiveness-check': 'error',
			'@typescript-eslint/restrict-template-expressions': [
				'error',
				{ allowNumber: true },
			],
			'@typescript-eslint/ban-ts-comment': [
				'error',
				{
					'ts-expect-error': true,
					'ts-ignore': true,
					'ts-nocheck': true,
					'ts-check': false,
				},
			],
			'@eslint-community/eslint-comments/no-unlimited-disable': 'error',
			'@eslint-community/eslint-comments/no-unused-disable': 'error',
			'@eslint-community/eslint-comments/no-use': 'error',
			'vitest/no-focused-tests': 'error',
			'vitest/no-disabled-tests': 'error',
			'no-restricted-imports': [
				'error',
				{
					paths: bannedPackages,
				},
			],
			'import-x/no-cycle': 'error',
			'react/react-in-jsx-scope': 'off',
			'react-compiler/react-compiler': 'error',
			'react-hooks/exhaustive-deps': 'error',
			'react/jsx-key': 'error',
			'react/jsx-no-bind': [
				'error',
				{
					allowArrowFunctions: true,
					allowBind: false,
					ignoreRefs: true,
				},
			],
			'react/jsx-no-constructed-context-values': 'error',
			'react/jsx-no-useless-fragment': 'error',
			'react/no-array-index-key': 'error',
			'react/no-object-type-as-default-prop': 'error',
			'react/self-closing-comp': 'error',
			'react/hook-use-state': 'error',
			'prefer-const': 'error',
			'no-var': 'error',
			'object-shorthand': 'error',
			'prefer-template': 'error',
			eqeqeq: ['error', 'always', { null: 'ignore' }],
			'no-console': ['error', { allow: ['warn', 'error'] }],
			'no-debugger': 'error',
			'no-restricted-syntax': [
				'error',
				{
					selector: 'TSEnumDeclaration',
					message: 'Use union types or Schema.Literal instead of enum.',
				},
			],
			'no-warning-comments': [
				'error',
				{
					terms: ['todo', 'fixme'],
					location: 'start',
				},
			],
		},
		settings: {
			react: {
				version: 'detect',
			},
			'import-x/resolver': {
				typescript: {
					project: path.resolve(__dirname, './tsconfig.app.json'),
				},
			},
		},
	},
	{
		files: [
			'src/routes/**/*.{ts,tsx}',
			'src/pages/**/*.{ts,tsx}',
			'src/app/**/*.{ts,tsx}',
			'src/layout/**/*.{ts,tsx}',
		],
		rules: {
			'no-restricted-imports': [
				'error',
				{
					paths: bannedPackages,
					patterns: [
						{
							group: ['../*', '../**'],
							message:
								'Use path aliases (@features, @lib, etc.) instead of relative parent imports.',
						},
					],
				},
			],
		},
	},
	{
		files: ['src/test/**/*.{ts,tsx}'],
		rules: {
			'react-refresh/only-export-components': 'off',
		},
	},
]
