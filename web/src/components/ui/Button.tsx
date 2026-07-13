import type { ButtonHTMLAttributes } from 'react'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
	variant?: 'primary' | 'ghost'
}

const variantClasses = {
	primary:
		'bg-stone-900 text-white hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-white',
	ghost:
		'bg-transparent text-stone-700 hover:bg-stone-100 dark:text-stone-200 dark:hover:bg-stone-800',
} satisfies Record<NonNullable<ButtonProps['variant']>, string>

export function Button({
	variant = 'primary',
	className = '',
	type = 'button',
	...props
}: ButtonProps) {
	return (
		<button
			type={type}
			className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-stone-400 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:focus-visible:ring-stone-500 dark:focus-visible:ring-offset-stone-950 ${variantClasses[variant]} ${className}`}
			{...props}
		/>
	)
}
