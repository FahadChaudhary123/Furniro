# Runbook: rollback

A deploy broke something. Get back to a known-good state, then diagnose.

🔴 No environment is deployed yet, so this has never been exercised. Read it before you
need it.

---

## The rule

**Roll back first. Diagnose afterwards.**

Rolling forward with a fix under pressure means writing code, reviewing it and deploying it
while users are affected and you are stressed — and the fix is untested by definition. A
rollback returns you to a state that was working minutes ago. Take the known-good state,
then debug calmly with the site up.

The exception is a rollback that would itself cause damage — most often a database
migration, see [below](#when-a-migration-is-involved).

---

## 1. Confirm it is the deploy

Thirty seconds, before you act:

- Did it start at the deploy? Check the timestamp against the deploy time.
- Is it every user, or one? Try an incognito window and a different network.
- Is the host itself up? Check the provider's status page.
- Is Supabase up? Check the Supabase status page.

If the problem predates the deploy, rolling back will not fix it, and doing so adds a
second change to reason about.

## 2. Say something

Post in the team channel before you start:

> Investigating <symptom> on production, started ~<time>. Rolling back the <time> deploy.
> Will update in 10 minutes.

Silence during an outage is worse than the outage. Someone else is already looking at it,
and without a message you will both work on it separately.

## 3. Roll back

### Hosted platform

Most platforms keep prior deployments and can promote one instantly. This is the fastest
and safest route.

| Host | How |
|---|---|
| Vercel | Deployments → previous deployment → Promote to Production |
| Netlify | Deploys → previous deploy → Publish deploy |
| Cloudflare Pages | Deployments → previous → Rollback |

**Verify:** load the site, confirm the symptom is gone, check the deployment id matches the
one you promoted.

### Git revert

If the platform cannot promote, revert the commit and let the deploy re-run:

```bash
git revert <sha>          # creates a new commit undoing that one
git push origin main
```

Use `revert`, not `reset --hard`. `revert` adds a commit that undoes the change and keeps
history intact for everyone else. `reset --hard` on a shared branch rewrites history and
breaks every other clone — during an incident, that turns one problem into two.

### Manual rebuild

Last resort:

```bash
git checkout <last-known-good-sha>
cd Frontend && npm ci && npm run build
# deploy dist/ per your host
```

## 4. Verify

- [ ] The original symptom is gone
- [ ] All four routes load
- [ ] Hard refresh on `/shop` works
- [ ] No console errors
- [ ] The deployed version is the one you intended

## 5. Update the team

> Rolled back to <version>. Site is healthy as of <time>. Root cause under investigation.

## 6. Then diagnose

With the site up and no time pressure:

1. Reproduce locally against the bad commit.
2. Find the root cause — not just the symptom.
3. Fix it on a branch, with a test if there is any way to write one.
4. Note it in [CHANGELOG.md](../../CHANGELOG.md).
5. Write down what would have caught this earlier, and do that thing.

---

## When a migration is involved

A code rollback does **not** roll back a database migration, and this is where rollbacks go
wrong.

If the bad deploy ran a migration, old code is now pointing at a changed schema. Reverting
the code alone can leave the app writing to columns that no longer exist, or reading ones
that were renamed.

**Additive migrations** — a new nullable column, a new table — are safe to leave in place.
Old code ignores them. Roll back the code and stop.

**Destructive migrations** — a dropped or renamed column, a changed type, a tightened
constraint — cannot be undone by reverting code. Take a backup before touching anything,
then decide deliberately between a down-migration and rolling forward. This is the one case
where rolling forward may genuinely be safer.

The way to avoid the dilemma is to never combine a destructive migration with a code deploy.
Expand, migrate, contract: add the new column, deploy code that writes both, backfill,
deploy code that reads the new one, and only then drop the old column — each step
independently reversible.

---

## Prevention

Every rollback is evidence that something upstream was missing. The candidates for this
project, in order of what they would have caught:

- **No tests.** Nothing mechanical stands between a regression and production.
- **No CI.** Nothing runs `lint` and `build` before a merge.
- **No staging environment.** Production is the first place anything is exercised.
- **No error tracking.** You will find out from a user, not a dashboard.
