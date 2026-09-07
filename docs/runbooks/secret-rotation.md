# Runbook: secret rotation

For a leaked credential, and for routine rotation.

**There is an outstanding rotation for this project.** See
[Outstanding](#-outstanding-rotate-before-the-first-commit).

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

## ⚠ Outstanding: rotate before the first commit

`Backend/.env` holds live, non-placeholder values for `SUPABASE_URL`, `SUPABASE_ANON_KEY`
and `DATABASE_URL`. `Backend/.gitignore` was an empty file until recently, and the project
is still not a git repository.

Nothing has leaked yet — the absence of a repository is the only reason. But `git init &&
git add .` under the old ignore rules would have committed all three, and the safe
assumption once code starts moving between machines is that anything sitting in a working
directory this long may have been copied, backed up or synced somewhere you did not intend.

**`DATABASE_URL` is the one that matters.** It embeds the database password and grants
direct read/write access to the entire database, bypassing row-level security completely.

Rotate both `DATABASE_URL` and `SUPABASE_ANON_KEY` now, while it costs a five-minute
procedure and zero downtime.

---

## Procedure

### `DATABASE_URL` — the Postgres password

1. **Supabase dashboard → Project Settings → Database → Reset database password.**
2. Copy the new connection string.
3. Update `Backend/.env` locally.
4. Update it in every deployed environment's configuration.
5. Restart anything holding a connection pool — pooled connections survive a password
   change and mask whether the rotation worked.
6. **Verify:** the app connects with the new value, and confirm the old one fails.

**Consequence:** every consumer of the old string loses access immediately. Know what those
are before you start. Today the answer is "nothing" — the back end has no code — which
makes now the cheapest possible moment to do it.

### `SUPABASE_ANON_KEY`

1. **Supabase dashboard → Project Settings → API → rotate the anon key.**
2. Update `Backend/.env` and every deployed environment.
3. Rebuild and redeploy the front end **if** it embeds the key — a `VITE_`-prefixed value
   is baked into the bundle at build time, so updating the host's environment variable
   alone changes nothing until a rebuild.

**Before rotating, confirm row-level security is enabled on every table.** The anon key is
public by design; RLS is the only thing that makes that safe. Without it, rotation just
replaces one full-access public credential with another.

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

- [ ] New value works in every environment
- [ ] Old value confirmed dead — try it
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
| Supabase anon key | 180 days |
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
