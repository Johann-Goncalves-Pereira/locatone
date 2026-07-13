import type { ButtonHTMLAttributes } from 'react'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
	variant?: 'primary' | 'ghost'
}

const variantClasses = {
	primary:
		'bg-[var(--loc-accent)] text-[var(--loc-bg)] hover:bg-[var(--loc-accent-strong)]',
	ghost:
		'bg-transparent text-[var(--loc-ink)] hover:bg-[color-mix(in_oklab,var(--loc-ink)_8%,transparent)]',
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
			className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-[var(--loc-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--loc-bg)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${variantClasses[variant]} ${className}`}
			{...props}
		/>
	)
}
