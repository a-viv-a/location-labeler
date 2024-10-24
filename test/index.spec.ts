import { env } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import app from '../src/index';
import { identifier } from '../src/label'

// describe('request label', () => {
  // it('Should return 401 if missing token', async () => {
  //   const res = await app.request('/request-label', {}, env)

  //   expect(res.status).toBe(401)
  // })
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
// })

describe('label identifier', () => {
  it('Should pass normal values through as lowercase', () => {
    expect(identifier({city: "City", iso: "US-WI"})).toEqual('us-wi-city')
  })
  it("should handle a number", () => {
    expect(identifier({city: "CITY1", iso: "US-CA"})).toEqual("us-ca-cityb")
  })
  it("should multiple numbers", () => {
    expect(identifier({city: "CITY25", iso: "US3-CA"})).toEqual("usd-ca-cityz")
  })
  it("should handle diacritics", () => {
    expect(identifier({city: "woèﬁ", iso: "US-CA"})).toEqual('us-ca-woefi')
  })
})
