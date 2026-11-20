# justryuz-auth (Cloudflare Worker)

Auth gateway and post storage for the blog. The password and token key live only in Worker secrets. Posts live in Cloudflare KV.

## One-time setup

```
cd worker
npx wrangler login
npx wrangler kv namespace create POSTS        # copy the printed id into wrangler.toml
npx wrangler secret put PASSWORD              # your real admin password
npx wrangler secret put TOKEN_SECRET          # e.g. output of: openssl rand -hex 32
npx wrangler secret put PRIVATE_MOTD          # optional text for the private shell
npx wrangler deploy
```

Then set `API_URL` in `../config.js` to the printed Worker URL (e.g. `https://justryuz-auth.<you>.workers.dev`) and push.

Also change `ALLOWED_ORIGIN` in `wrangler.toml` if your site URL differs. For local testing add `http://localhost:8000` (comma separated).

## Using it

1. Open `/admin.html` (or `ssh justryuz@git.justryuz.my` then type `admin`) and log in.
2. First time only: click **Import post dari data.js** to copy the sample posts into KV. After that the site reads posts from KV, and `data.js` is only a fallback if the Worker is down.
3. **+ Post baru** to write. Posts show on the public site within about 20 seconds.

## Endpoints

| Route | Auth | Purpose |
|---|---|---|
| `POST /login` | none | `{user, password}` returns `{ok, token}`. 5 failed tries lock the IP for 15 min (per isolate). |
| `GET /posts` | none | `{ok, initialized, posts}` |
| `GET /admin/me` | token | check session |
| `PUT /admin/posts` | token | `{post, create}` create or update (slug is the ID) |
| `DELETE /admin/posts/:slug` | token | delete |
| `POST /admin/import` | token | one-time bulk import, refused once initialized |
| `GET /motd` | token | private shell message |

Tokens are HMAC-signed and expire after 1 hour. Add a Cloudflare rate-limiting rule on `/login` for a hard limit. All input is validated in `cleanPost()` in `worker.js` (slug, date, level, group, lengths).

## Change the password
`npx wrangler secret put PASSWORD` again. Existing tokens stay valid until they expire. Rotate `TOKEN_SECRET` to log everyone out.
