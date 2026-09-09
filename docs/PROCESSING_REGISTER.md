# Processing register

**`PRIV-06` · Document B §11 · Last audited 2026-09-09**

What personal data this system processes, why, and for how long. Doc B §11 requires this to
be updated *as part of* adding a third party or a new processing activity — not as a
follow-up task, because the follow-up is what never happens.

Companion to [THIRD_PARTY_REGISTER.md](THIRD_PARTY_REGISTER.md), which lists sub-processors.
This lists activities.

---

## ⚠ What this document is and is not

**It is an engineering audit of what the code does.** Every row below was verified against
the source on the date above, not inferred from intent.

**It is not legal advice, and the "lawful basis" column is not settled.** Choosing a basis is
a legal judgement about a specific business in a specific jurisdiction, and none of the
inputs exist here: there is no identified data controller, no established place of business,
no decision about which markets are served. The column records what a basis would most
plausibly be, marked **`NEEDS SIGN-OFF`**, so a lawyer has a factual starting point rather
than a blank page. **Do not publish a privacy notice derived from this without that review**
— see `PRIV-07`.

---

## Summary

The system currently processes **very little** personal data, and that is a property worth
keeping rather than an accident to correct.

There is no database, no accounts, no orders and no payments. Nothing here is stored in a
form that could be looked up by person, because there is no person to look anything up by.

| | |
|---|---|
| Identified data subjects | Website visitors only |
| Stored server-side | Nothing durable. Logs only, on disk/stdout |
| Stored in the browser | Cart contents (`{slug, quantity}`) |
| Special category data | None |
| Data shared with third parties | None (see [gaps](#known-gaps)) |
| Transfers outside the origin country | None today; Supabase is provisioned but unused |

---

## Activities

### 1. Serving the storefront (request logs)

| | |
|---|---|
| **Data** | HTTP method, path, status code, duration, correlation id |
| **Not collected** | **IP address, query string, request body, cookies, referrer** |
| **Subject** | Visitor |
| **Purpose** | Diagnosing faults; `PLAT-02` correlation across a session |
| **Lawful basis** | Legitimate interest — operating a website `NEEDS SIGN-OFF` |
| **Retention** | Doc B §11 target: 30 days hot / 12 months cold. **Not enforced** — see gaps |
| **Where** | `Backend/src/app.js` request middleware |

The query string is excluded deliberately: `/shop?q=…` carries whatever the visitor searched
for. The IP is excluded too, which is stricter than most access logs.

### 2. Rate limiting

| | |
|---|---|
| **Data** | Client IP address, grouped to a /64 subnet for IPv6 |
| **Subject** | Visitor |
| **Purpose** | `SEC-03`. Preventing abuse of a public API |
| **Lawful basis** | Legitimate interest — network and information security `NEEDS SIGN-OFF` |
| **Retention** | In memory, for the length of the window (60 s general, 1 h writes) |
| **Where** | `Backend/src/security/rateLimit.js` |

The IP is used as a counter key and **never written to a log**. The 429 log line records
method, path and limit — not who hit it. It does not survive a process restart, and because
the store is in-memory it is not shared between instances.

### 3. Client error reports

| | |
|---|---|
| **Data** | Error message, stack trace, component stack, page path, user-agent string |
| **Subject** | Visitor whose browser crashed |
| **Purpose** | `PLAT-04`. Finding faults that are invisible server-side |
| **Lawful basis** | Legitimate interest — operating a website `NEEDS SIGN-OFF` |
| **Retention** | As request logs. **Not enforced** — see gaps |
| **Where** | `Backend/src/platform/clientErrors.js`, `Frontend/src/shared/lib/reportError.js` |

**The user-agent string is the sensitive part of this row.** It is not an identifier on its
own, but combined with an IP it contributes to a browser fingerprint. It is kept because a
crash that only happens on one browser version is otherwise undiagnosable, it is capped at
300 characters, and **it is never stored alongside an IP** — the log line has no IP in it.

The client sends the page path **without its query string**, for the same reason as the
request log. A stack trace can incidentally contain a URL; the 4000-character cap bounds
that but does not eliminate it.

### 4. Cart contents (browser storage)

| | |
|---|---|
| **Data** | `{slug, quantity}` per line. Nothing else |
| **Subject** | Visitor |
| **Purpose** | `CART-01`. A cart that survives a reload |
| **Lawful basis** | Strictly necessary for a service the user requested `NEEDS SIGN-OFF` |
| **Retention** | Until the visitor clears it or clears site data. No expiry |
| **Where** | `Frontend/src/modules/cart/storage.js` — `localStorage`, key `furniro.cart.v1` |

Never leaves the device and is never sent to the server. It holds no price, name or image by
design ([ADR 0007](decisions/0007-cart-stores-no-prices.md)), so it is a list of product
slugs and counts.

Under the ePrivacy rules this is browser storage requiring disclosure, and it is the kind
most likely to qualify as strictly necessary — a cart is the service the visitor asked for.
That still requires disclosure in a privacy notice, which does not exist.

### 5. Zero-result search terms

| | |
|---|---|
| **Data** | The search term, capped at 100 characters, plus the category filter in effect |
| **Not collected** | Anything identifying. No IP, no user-agent, no session |
| **Subject** | Visitor who searched |
| **Purpose** | `SRCH-05`. Doc B §4 and §15: finding what customers ask for and cannot find |
| **Lawful basis** | Legitimate interest — understanding demand `NEEDS SIGN-OFF` |
| **Retention** | As request logs. **Not enforced** — see gaps |
| **Where** | `Backend/src/modules/catalogue/controller.js`, message `search returned nothing` |

**This is a deliberate exception to activity 1**, which strips query strings from the request
log precisely because `?q=…` carries whatever someone typed. It is worth making because a
search that returns nothing is customers describing, in their own words, what the shop does
not stock — the clearest demand signal a catalogue can produce.

Minimised to match the exception:

- **Only zero-result searches are logged.** A search that worked teaches nothing, and is not
  recorded — verified by searching for a term that matches and confirming it appears nowhere
  in the log.
- **The term alone**, with the category, because "nothing in Bedroom" and "nothing at all"
  are different problems.
- **A distinct log message**, so it can be filtered for the weekly review and purged on its
  own schedule without touching anything else.

A search term can still be unexpectedly personal — someone types a room, a condition, a
name. Nothing here ties one to a person, and the 100-character cap bounds how much of a
sentence can arrive, but the field is free text and that residual risk is real rather than
eliminated.

### 6. Contact and newsletter forms — **no longer processing**

Both forms solicited a name, an email address and a message, and **discarded everything**.
The contact form had no submit handler, so pressing Submit triggered a native GET, reloaded
the page and lost the message; a customer had every reason to believe it had been sent.

They are now **disabled with a visible explanation**, so no personal data is collected. This
row stays in the register as the record of what changed, and because re-enabling either one
adds a genuine processing activity that needs a row of its own, a retention period, and a
consent record.

---

## Known gaps

Ordered by how much they matter.

1. **No privacy notice** (`PRIV-07`). Everything above is undisclosed to the people it
   concerns. This document is the input to writing one; it is not a substitute, and it is
   not written for the public.
2. **No retention enforcement** (`PRIV-05`). Doc B §11 sets 30 days hot / 12 months cold for
   logs. Nothing purges anything — there is no job framework (`PLAT-05`) to run a purge in.
   The periods above are targets, not facts.
3. **No subject-request route** (`PRIV-01`). There is nowhere to send an access or deletion
   request, and no process behind it if there were.
4. **No consent mechanism** (`PRIV-04`). Not yet needed — nothing here is analytics or
   marketing — and it becomes needed the moment either is added.
5. **Host and CDN logs are out of scope of this audit.** Whatever serves the built site keeps
   its own access logs, which will contain IP addresses regardless of what the application
   does. That is a real processing activity belonging to a platform that has not been chosen.
6. **Supabase is provisioned but unused.** Credentials exist, no schema does. Nothing is
   stored there. It becomes a sub-processor and a cross-border transfer the moment it holds
   data, and it must gain a row here in the same change.

---

## When to update this

As part of the change, never after it. Specifically:

- Adding any field that identifies a person
- Adding any third-party script, pixel, font host or API
- Enabling either of the disabled forms
- Creating the first database table that holds anything about a person
- Changing what is logged

If a change adds a row here and the change ships without it, the register is wrong, and a
register that is known to be wrong is worse than no register — it gets trusted once.
