import { Hono } from "npm:hono@4.6.5";

const app = new Hono()

app.get('/', (c) => c.text('hiiii'))

export default app
