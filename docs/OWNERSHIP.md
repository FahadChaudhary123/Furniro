# Current ownership and escalation

**Status:** draft operational register, 2026-10-06. Furniro currently has one maintainer,
but this repository does not identify that person or a backup. The published security
contact is `app@digitaiz.com` ([SECURITY.md](../SECURITY.md)); an inbox is a contact route,
not a named accountable owner or a staffed on-call rota.

| Responsibility | Accountable person | Backup / escalation | Current coverage |
|---|---|---|---|
| Storefront, API and deployment | To be named | None recorded | Local tests and runbooks; no deployed service |
| Catalogue, content and PKR prices | To be named | None recorded | JSON catalogue and publish gate; PKR prices await approval |
| Security and credential rotation | To be named | None recorded | Security contact published; weekly dependency audit and update proposals configured; live Supabase credential rotation outstanding |
| Privacy and legal copy | To be named | None recorded | Processing register exists; privacy notice and legal sign-off absent |
| Commerce provider, payments and refunds | To be named | None recorded | Provider not selected; no trading system |
| Orders, fulfilment and customer support | To be named | None recorded | No order or support operation yet |

## Escalation today

1. A security report goes to the contact in [SECURITY.md](../SECURITY.md).
2. A local application fault follows [incident-response.md](runbooks/incident-response.md)
   and the relevant runbook. There is no production service to page or roll back.
3. A credential exposure requires rotation through
   [secret-rotation.md](runbooks/secret-rotation.md). The repository cannot perform the
   account-side rotation itself.
4. Until a security owner and alert route are assigned, review the scheduled `audit` job and
   Dependabot pull requests in GitHub each week; triage any high or critical finding.

**Before production:** record the maintainer's name and reliable contact, a backup who can
access Render/GitHub/Supabase, and the person authorized to approve PKR prices, refunds and
legal copy. Confirm alert routing and response hours. Until then, do not claim 24/7 coverage
or a five-minute incident acknowledgement target.
