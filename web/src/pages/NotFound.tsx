import { Link } from '@tanstack/react-router'

function NotFound() {
	return (
		<div className='mx-auto flex min-h-dvh w-full max-w-2xl flex-col items-center justify-center gap-4 p-6 text-center'>
			<h1 className='text-2xl font-semibold'>Page not found</h1>
			<p className='text-stone-600 dark:text-stone-300'>
				The page you are looking for does not exist.
			</p>
			<Link to='/' search={{ filter: 'all' }} className='underline'>
				Go to home
			</Link>
		</div>
	)
}

export default NotFound
