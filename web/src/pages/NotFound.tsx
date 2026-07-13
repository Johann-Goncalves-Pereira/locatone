import { Link } from '@tanstack/react-router'

function NotFound() {
	return (
		<div className='mx-auto flex min-h-dvh w-full max-w-2xl flex-col items-center justify-center gap-4 p-6 text-center'>
			<h1 className='font-[family-name:var(--font-display)] text-2xl font-bold'>
				Página não encontrada
			</h1>
			<p className='text-[var(--loc-muted)]'>
				O endereço que você abriu não existe no Locatone.
			</p>
			<Link to='/' search={{ panel: 'closed' }} className='underline'>
				Voltar ao início
			</Link>
		</div>
	)
}

export default NotFound
