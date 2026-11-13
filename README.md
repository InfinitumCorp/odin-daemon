# ODIN° DAEMON

Tabletop simulation of the ODIN° DAEMON airframes. Each model has its own backend. A person approves every engagement. ROE HOLD blocks resolution.

CONJURE rehearses each plan against a synthetic room (partner unit, oversight, affected community, liaison). The forecast is advisory. It does not clear a shot. The procedural crowd is a bounded-confidence model. No language model.

```bash
npm install
npm run dev
```

The server owns the picture. The client sends a role and commands, never a world.

| Method | Path                                              |                                           |
| ------ | ------------------------------------------------- | ----------------------------------------- |
| GET    | `/api/odin/health`                                |                                           |
| GET    | `/api/odin/picture?exercise=hearth&role=observer` |                                           |
| POST   | `/api/odin/step`                                  | `{ exercise, role, steps, commands }`     |
| POST   | `/api/odin/reset`                                 | `{ scenario, seed, role }` commander only |

Observer and analyst can watch the clock. Approve, deny, ROE, launch, and adopt require commander.

## Hosting: Cloudflare Workers

The app is TanStack Start built by Nitro's `cloudflare_module` preset. `npm run build` writes the Worker to `.output/server` and static assets to `.output/public`, and generates `.output/server/wrangler.json` from the root `wrangler.jsonc`.

```bash
npm run build
npx wrangler dev          # local Workers runtime on the built output
npm run deploy:preview    # build, then upload a preview version (does not go live)
npm run deploy            # production deploy, which needs sign-off first
```

## Database: Supabase

Data lives in the shared **Infinitum Corp** Supabase project (ref `ivqiskeziohbbtkcvlun`) in the `odin_daemon` schema. RLS is on and there are no policies, so the anon and authenticated keys can't reach these tables. Only the Worker can, over `DATABASE_URL`. The browser gets no database key at all.

- Migrations are in `supabase/migrations/`. Apply them with `npm run db:push` (`supabase db push`, after `supabase link --project-ref ivqiskeziohbbtkcvlun`). Because the project is shared, the CLI may report migration versions that other products pushed. If it does, apply the file in the SQL editor or with `psql "$DATABASE_URL" -f <file>`. Don't use `npm run db:migrate` against the shared project: it keeps its own `public._migrations` table, which every product would share.
- Without `DATABASE_URL`, local dev runs on embedded PGLite and applies the same migrations on startup.
- `supabase/migrations/auth/` holds the opt-in Better Auth schema. It isn't applied unless sign-in is turned on.

## Environment variables

Set these with `npx wrangler secret put <NAME>` (or in the Cloudflare dashboard). Never commit them.

| Name                                                         | Required                     | What it is                                                                                                                                                                                        |
| ------------------------------------------------------------ | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                               | for persistence              | Supabase Postgres connection string through the **transaction pooler** (port 6543) for the Infinitum Corp project. Secret. Without it, the exercise picture is kept in memory per Worker isolate. |
| `GROK_PROJECT_ID`, `GROK_GATE_ORIGIN`                        | no                           | Grok App Builder gate. Leave unset outside Grok-hosted deploys.                                                                                                                                   |
| `VITE_AUTH_ENABLED`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` | only if sign-in is turned on | Better Auth. Off by default.                                                                                                                                                                      |
| `INFINITUM_GEO_ENABLED`                                      | no                           | Geo routing. Unset follows the saved toggle, which defaults to off. `1`, `true`, `on`, or `yes` forces it on. Any other value forces it off.                                                      |
| `INFINITUM_GEO_DIR`                                          | no                           | Where `geoip.dat`, `geosite.dat`, and `settings.json` live. Defaults to `data/geo/`.                                                                                                              |

## Geo datasets

Country and site lists are optional. While geo routing is off, the exercise picture and the API bodies stay as they are.

The lists are the v2fly releases pinned in `geo/geo-dat.lock.json`. The binaries are downloaded, checksum-checked, and gitignored.

```bash
npm run geo:fetch
npm run geo:routing -- --geo-routing=on
npm run geo:routing -- --geo-routing=off
```

The console header has the same toggle. Attribution is in `THIRD_PARTY_NOTICES.md`.
