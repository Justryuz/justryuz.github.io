# justryuz-auth (Cloudflare Worker)

Checks the real SSH-style login. Password lives only in Worker secrets.

```
cd worker
npx wrangler login
npx wrangler secret put PASSWORD        # your real password
npx wrangler secret put TOKEN_SECRET    # e.g. output of: openssl rand -hex 32
npx wrangler secret put PRIVATE_MOTD    # optional text for the private shell
npx wrangler deploy
```

Then put the Worker URL in `../config.js` as `API_URL`.

Endpoints
- `POST /login` `{user, password}` returns `{ok, token}`. 5 failed tries lock the IP for 15 min (per isolate). Also add a Cloudflare rate-limiting rule on `/login` for a hard limit.
- `GET /motd` with `Authorization: Bearer <token>`.

Tokens are HMAC-signed and expire after 1 hour.
