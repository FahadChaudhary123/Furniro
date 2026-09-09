# Runbooks

Operational procedures for Furniro. Each runbook is written to be followed under pressure:
numbered steps, explicit commands, and a stated way to tell whether the step worked.

> **Nothing is deployed yet.** There is no hosting account, no CI, no deployment
> configuration, and no production environment. These runbooks are the procedures to follow
> when there is one — written now, while there is time to think, rather than during the
> first incident. Steps that describe a not-yet-existing environment are marked 🔴.

| Runbook | Use when |
|---|---|
| [local-development.md](local-development.md) | Setting up, or the dev environment is misbehaving |
| [deployment.md](deployment.md) | Shipping to an environment |
| [rollback.md](rollback.md) | A deploy broke something and you need it undone |
| [secret-rotation.md](secret-rotation.md) | A credential leaked, or routine rotation |
| [incident-response.md](incident-response.md) | Production is down or degraded |

Governing standard: **Document B — *E-commerce maintenance and operations runbook*, Rev 1.0**.
Document B describes a trading business several stages ahead of this project;
[OPS_CONFORMANCE.md](../OPS_CONFORMANCE.md) maps it section by section against what actually
exists here and gives the order in which each part becomes real. Read that before treating
any Document B requirement as due.

Related: [THIRD_PARTY_REGISTER.md](../THIRD_PARTY_REGISTER.md) (Doc B §16).

---

## Before an incident happens

Fill these in. An empty table here is the reason an outage lasts two hours instead of ten
minutes.

| | |
|---|---|
| On-call contact | app@digitaiz.com |
| Escalation | _not defined_ |
| Hosting provider | _not chosen_ |
| Supabase project | _see `Backend/.env`, do not paste the value here_ |
| DNS registrar | _not defined_ |
| Status page | _none_ |
| Error tracking | _none_ |
| Uptime monitoring | _none_ |

**Never paste a credential, connection string or key into a runbook.** Runbooks get shared,
screenshotted and pasted into chat. Reference where a value lives; never reproduce it. See
[SECURITY.md](../../SECURITY.md).

---

## Writing a runbook

- Number the steps. Someone will be following them at 3am.
- Give the exact command, not a description of it.
- State how to verify each step worked, not just what to type.
- Say what to do when a step fails.
- Put the rollback at the end of every deploy procedure.
- Correct the runbook the moment reality diverges from it. A wrong runbook is worse than no
  runbook, because it is followed with confidence.
- **Test one runbook a month**, executed as written by someone who did not write it (Doc B
  §18). If they cannot follow it, the runbook is wrong, not the person.

  | Runbook | Last executed | Result |
  |---|---|---|
  | [local-development.md](local-development.md) | 2026-09-09 | works for a fresh setup; conditional `VITE_API_URL` step made unconditional |
  | [deployment.md](deployment.md) | never | needs a host |
  | [rollback.md](rollback.md) | never | needs a deployment |
  | [secret-rotation.md](secret-rotation.md) | never | executable now — rotation is overdue |
  | [incident-response.md](incident-response.md) | 2026-09-09 | tabletop; 1 defect found and fixed, 5 stale claims corrected |

  The incident tabletop induced a real CORS failure and followed the runbook against it.
  It found that a disallowed origin was being reported as a `500` with a stack trace — a
  caller's condition logged as a server fault — and that three of the runbook's seven listed
  "gaps" had stopped being true. A runbook that describes a system that no longer exists is
  followed with confidence, which is the dangerous kind of wrong.

  `secret-rotation.md` is the next one that can genuinely be run, and running it would also
  clear an outstanding action. **It needs someone with Supabase dashboard access** — new keys
  cannot be generated from the repository.
