import { env } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import app from '../src/index';

describe('request label', () => {
  it('Should return 401 if missing token', async () => {
    const res = await app.request('/request-label', {}, env)

    expect(res.status).toBe(401)
  })
  // it('Should return 400 if missing lat/long', async () => {
  //   const seq = new Request('request-label', {
  //     method: 'POST'
  //   })
  //   const res = await app.request(req)

  //   expect(res.status).toBe(400)
  // })
  // it('Should return 200 response', async () => {
  //   const res = await app.request('/request-label', {}, env)

  //   expect(res.status).toBe(200)
  //   // expect(await res.json()).toEqual({
  //   //   hello: 'world',
  //   //   var: 'my variable',
  //   // })
  // })
})
