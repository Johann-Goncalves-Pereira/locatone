import { Schema } from 'effect'

export const TodoFilter = Schema.Literal('all', 'active', 'done')
export type TodoFilter = typeof TodoFilter.Type

export const Todo = Schema.Struct({
	id: Schema.Number.pipe(Schema.int(), Schema.positive()),
	userId: Schema.Number.pipe(Schema.int(), Schema.positive()),
	title: Schema.String.pipe(Schema.minLength(1)),
	completed: Schema.Boolean,
})
export type Todo = typeof Todo.Type

export const Todos = Schema.Array(Todo)
export type Todos = typeof Todos.Type
