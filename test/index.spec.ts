// test/index.spec.ts
import { env, createExecutionContext, waitOnExecutionContext, SELF } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import app from '../src/index';

// For now, you'll need to do something like this to get a correctly-typed
// `Request` to pass to `worker.fetch()`.
const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

describe('Example', () => {
  it('Should return 200 response', async () => {
    const res = await app.request('/hello', {}, env)

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      hello: 'world',
      var: 'my variable',
    })
  })
})
