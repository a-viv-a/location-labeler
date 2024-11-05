import { IdResolver } from "@atproto/identity";
import { verifyJwt } from "@atproto/xrpc-server";
import { Context, MiddlewareHandler } from "hono";
import { bearerAuth } from "hono/bearer-auth";
import { createMiddleware } from "hono/factory"
import { Bindings } from "hono/types";

// Verifying a service JWT
// helper method to resolve a user's DID to their atproto signing key
const idResolver = new IdResolver()
const getSigningKey = async (
  did: string,
  forceRefresh: boolean,
): Promise<string> => {
  return idResolver.did.resolveAtprotoKey(did, forceRefresh)
}

export const bearerDIDAuth = createMiddleware<{
  Bindings: Env, Variables: {
    did: string
  }
}>(async (c, next) => {
  const bearerAuthMiddleware = bearerAuth({
    verifyToken: async (token, c) => {
      try {
        // TODO: consider using some lxm?
        const payload = await verifyJwt(token, c.env.LABELER_DID, null, getSigningKey)
        // iss is issuer, the did of the account making the request
        c.set('did', payload.iss)
      } catch (e) {
        // TODO: remove these logs?
        console.error(e)
        return false
      }
      return true
    }
  })
  return await bearerAuthMiddleware(c, next)
})

/**
Safeguard against failing to run auth! Run this early in the route handler...
*/
export const readDid = (c: {
  get: (_: 'did') => string
}) => {
  const did = c.get('did')
  if (did == null || typeof did !== 'string' || !did.startsWith('did:')) {
    throw new Error(`Illegal did when read, got did='${did}'`)
  }
  return did
}
