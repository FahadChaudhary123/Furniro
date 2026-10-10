# Runbook: secret rotation

For a leaked credential, and for routine rotation.

**There is an outstanding rotation for this project.** See
[Outstanding](#-outstanding-rotate-now).

---

## If a secret has leaked, do this first

**Rotate before anything else.** Not after you have deleted the file, rewritten history, or
worked out how it happened. Every one of those takes minutes during which the old value
still works.

A credential that has been exposed — committed, pasted into a chat, printed in a log or a
CI transcript, or included in a screenshot — must be treated as compromised. Not
"probably fine because the repo is private": private repositories get forked, cloned,
mirrored into CI caches, and made public by accident. Public pushes are scraped by bots
within seconds, continuously, at scale.

Removing the file does not un-leak the value. Only rotation does.

---

## ⚠ Outstanding: rotate now

`Backend/.env` holds live, non-placeholder values for `SUPABASE_URL`, `SUPABASE_ANON_KEY`
and `DATABASE_URL`. `Backend/.gitignore` was an empty file for part of this project's life.

**The repository now exists on GitHub with CI running against it.** On 2026-10-01,
`Backend/.env` was absent from locally available Git history and tracked files, and its
ignore rule was active. See [SECURITY.md](../../SECURITY.md#-current-exposure--act-on-this-first).
Rotate regardless of the local check: the safe assumption for a credential that
has sat in a working directory across a long session, on a machine that syncs and backs up,
is that it has been somewhere you did not intend.

**`DATABASE_URL` is the one that matters.** It embeds the database password and grants
direct read/write access to the entire database, bypassing row-level security completely.

Reset the database password and retire the unused legacy `anon` key. Confirm other
consumers before disabling a key; the current Furniro API reads JSON and does not call
Supabase. Supabase's [current API-key guidance](https://supabase.com/docs/guides/getting-started/api-keys)
recommends publishable keys in place of legacy `anon` keys.

---

## Procedure

### `DATABASE_URL` — the Postgres password

1. **Supabase dashboard → Database → Settings → reset the database password.** See
   [Supabase's reset guide](https://supabase.com/docs/guides/troubleshooting/how-do-i-reset-my-supabase-database-password-oTs5sB).
2. Inventory other applications and tools that use this database. Give each actual consumer
   the new connection string through its secret store; do not paste it into chat or docs.
   The current Furniro API does not connect to this database, so do not add the new password
   to Render or keep it in `Backend/.env` solely for Furniro.
3. Remove the obsolete `DATABASE_URL` from `Backend/.env` once any real local consumer has
   migrated. Do not leave the old password there after rotation.
4. Restart anything holding a connection pool — pooled connections survive a password
   change and mask whether the rotation worked.
5. **Verify:** every actual consumer connects with the new value, and the old one fails.

**Consequence:** every consumer of the old string loses access immediately. Know what those
are before you start. Today the answer is still "nothing" — the API reads from JSON files
and no code has ever opened a database connection — which makes now the cheapest possible
moment to do it. That stops being true the day a schema exists.

### Legacy `SUPABASE_ANON_KEY`

Supabase is replacing the legacy `anon` key with a publishable API key. Creating a
publishable key does **not** revoke the legacy key. Follow the
[migration guide](https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys):

1. In **Settings → API Keys**, create or locate a publishable key. Check every consumer of
   the legacy key, including any outside this repository.
2. Move consumers that need Supabase access to the publishable key. The current Furniro
   storefront does not embed a Supabase key, and the API's JSON repositories do not call
   Supabase. Do not add a new key to either tier merely to replace an unused value.
3. Confirm from the dashboard's last-used information that no consumer still uses the
   legacy key; then disable the legacy `anon` key in **Settings → API Keys**. Disabling is
   a separate step. Do not assume creating the new key revoked the old one.
4. If a browser bundle ever embeds a key, rebuild and redeploy it after changing that
   value: `VITE_` variables are baked into the bundle at build time.

Before any browser client queries Supabase tables, enable row-level security and the
intended policies on every exposed table. See
[Supabase's API-key guidance](https://supabase.com/docs/guides/getting-started/api-keys).

### `service_role` key

Same dashboard section. This key **bypasses RLS entirely** — server-side only, never in
`Frontend/`, never behind a `VITE_` prefix, never in a log line. Not currently in use here;
keep it that way unless something genuinely needs it.

### Payment provider keys

🔴 Not applicable — no payment integration. When there is: rotate the secret key in the
provider dashboard, update the server environment, and re-verify webhook signature
handling. The publishable key is public and needs a front-end rebuild.

---

## After rotating

- [ ] New database password works for every actual consumer
- [ ] Old database password is rejected
- [ ] Legacy `anon` key is disabled after consumers move, or its continued use is recorded
- [ ] Provider access logs checked for use you cannot account for
- [ ] `Backend/.env` is ignored: `git check-ignore -v Backend/.env`
- [ ] Team told which value rotated — **never the value itself**
- [ ] Noted in [CHANGELOG.md](../../CHANGELOG.md) under *Security*, without the value

---

## Purging a secret from git history

Rotation is the fix. History cleanup is hygiene, and it is genuinely partial — do it, but
do not let it substitute for rotation.

```bash
# git-filter-repo (recommended over filter-branch)
git filter-repo --path Backend/.env --invert-paths
git push --force --all
git push --force --tags
```

**What this does not reach:** existing clones and forks, provider caches, CI artifacts, and
anything a scraper already took. Coordinate with everyone who has a clone — after a force
push their branches diverge, and someone will "fix" it by force-pushing the secret back.

---

## Routine rotation

Even with no leak:

| Credential | Interval |
|---|---|
| Database password | 90 days |
| Legacy Supabase `anon` key | Retire after consumers migrate; do not schedule rotation of a deprecated key |
| Supabase publishable key | Reissue as required by the provider or after suspected misuse |
| `service_role` key | 90 days |
| Payment provider keys | 180 days, and on any staff change |

Rotate immediately, off-schedule, when someone with access leaves, when a laptop is lost,
after any suspected compromise, and after any incident where you are not certain what was
exposed.

---

## Prevention

- `.gitignore` covering `.env` in every package — now in place at the root, `Backend/` and
  `Frontend/`.
- `.env.example` with keys and no values, committed, as the template.
- A pre-commit hook (`gitleaks`, `git-secrets`) to block the mistake mechanically.
- Secret scanning enabled on the host once the repo is pushed.
- Never paste a credential into a runbook, a ticket, a screenshot or a chat message.
- Least privilege: use the anon key with RLS wherever it suffices, rather than reaching for
  `service_role` because it is easier.
