# API

**Status: catalogue and content are live; nothing else is.** The product, category and
blog endpoints are implemented, consumed by the front end, and covered by 60 smoke checks.
Everything else below is still the contract to build against.

Conventions and error shapes here are binding once implementation starts — agreeing them
before the first route is written is the point of the document.

- Entity shapes: [DATA_MODEL.md](DATA_MODEL.md)
- Layering (`routes` → `controllers` → `models`): [ARCHITECTURE.md](ARCHITECTURE.md#back-end)

---

## Conventions

**Base URL** — `http://localhost:<PORT>/api`, where `PORT` comes from `Backend/.env` and
falls back to 3000. It is genuinely configurable: this project's own `.env` sets 5000, which
broke the documented setup until the front end and the smoke suite stopped assuming 3000.
The front end reads `VITE_API_URL` and never hard-codes a host.

**Version in the path** once anything external consumes it: `/api/v1/...`. Skip it while
the only client is this repo's front end and both deploy together.

**Format** — JSON in, JSON out, UTF-8. `Content-Type: application/json` required on any
request with a body.

**Casing** — `snake_case` field names, matching the Postgres columns. One casing convention
end to end; no transform layer to forget.

**Money** — integers in minor units, always. Never a formatted string, never a float. See
[Money](DATA_MODEL.md#money).

**Timestamps** — ISO 8601 in UTC with an explicit offset: `2026-09-07T14:30:00Z`.

**Methods** — `GET` read, `POST` create, `PATCH` partial update, `PUT` full replace,
`DELETE` remove. `GET` and `DELETE` carry no body.

### Status codes

| Code | Meaning |
|---|---|
| `200` | OK, body follows |
| `201` | Created; `Location` header points at the new resource |
| `204` | Success, no body |
| `400` | Malformed or failed validation |
| `401` | No credentials, or bad ones |
| `403` | Authenticated, not permitted |
| `404` | No such resource |
| `409` | Conflict — duplicate slug, out of stock |
| `410` | Existed, permanently gone; carries `redirect_to` |
| `422` | Well-formed but semantically invalid |
| `429` | Rate limited |
| `500` | Server fault — never leak internals |

`404` and `410` are not interchangeable. `404` says "no such resource", which a crawler
treats as possibly transient and will retry for months. `410` says "this existed and is
permanently gone", which it acts on. Using `404` for a discontinued product keeps a dead URL
in the index; using `410` for a typo tells a crawler a page it never had is now deleted.

`401` means "who are you?"; `403` means "I know who you are, no". Returning `403` for an
unauthenticated request tells an attacker the resource exists.

### Error shape

Every non-2xx response, without exception:

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Request failed validation.",
    "details": [
      { "field": "email", "issue": "must be a valid email address" }
    ]
  }
}
```

`code` is a stable machine-readable constant — clients branch on it. `message` is for
humans and may be reworded freely. `details` is optional and present mainly on `400`/`422`.

**A `500` never includes a stack trace, a SQL fragment, or a driver message.** Log those
server-side with a correlation id; return the id, not the cause.

### Pagination

Offset-based, matching the shop grid's page buttons:

```
GET /api/products?page=1&limit=16
```

`page` defaults to `1`, `limit` to `16` (the value `PRODUCTS_PER_PAGE` already uses),
**capped at 100** — an uncapped `limit` is a one-request denial of service.

```json
{
  "data": [ /* … */ ],
  "meta": { "page": 1, "limit": 16, "total": 32, "total_pages": 2 }
}
```

Collections always return `{ data, meta }`. Single resources return the object bare. Never
return a bare top-level array — it leaves nowhere to add `meta` later without a breaking
change.

---

## Products

> **Every product endpoint serves only products that pass the publish gate** (`CAT-03`).
> A product failing a blocking rule — no slug, a non-integer price, a missing image, an
> unknown category — is absent from listings, absent from `featured`, and returns `404` by
> slug. It is filtered once at the data boundary, so no endpoint can accidentally expose it
> and none needs a flag to opt in.
>
> This means **the catalogue can be smaller than the source data**, and that difference is
> deliberately loud rather than silent: the server logs `publish gate blocked products` with
> the offending slugs at startup, and `npm run completeness` prints why. Rules live in
> `Backend/src/modules/catalogue/publishGate.js`.

### `GET /api/products`

> ✅ **Implemented.** `Backend/src/modules/catalogue/`

Paginated catalogue. Backs the shop grid.

| Query param | Type | Default | Notes |
|---|---|---|---|
| `page` | integer | `1` | 1-indexed |
| `limit` | integer | `16` | Max 100 |
| `category` | string | — | Category slug; repeat for OR |
| `sort` | enum | `created_at:desc` | `price:asc`, `price:desc`, `name:asc`, `created_at:desc` |
| `q` | string | — | Substring match on name and description |
| `min_price` / `max_price` | integer | — | Minor units, inclusive |
| `slugs` | string | — | Comma-separated, max 50. Batch lookup for the cart |

`slugs` exists so the cart can re-read several products in one request rather than N. An
unknown slug is simply absent from the response, not an error — a discontinued product
should drop out of a cart, not break it.

`sort` is a closed enum validated against a whitelist. **Never interpolate it into SQL** —
a sort parameter passed through to an `ORDER BY` is a classic injection vector.

This endpoint is what makes the shop page's two dropdowns functional; they are inert today
because the data is a local array of formatted price strings.

```http
GET /api/products?page=1&limit=16&category=living-room&sort=price:asc
```

```json
{
  "data": [
    {
      "id": 1,
      "slug": "nordic-wooden-chair",
      "name": "Nordic Wooden Chair",
      "description": "Stylish cafe chair",
      "category": { "id": 3, "slug": "living-room", "name": "Living Room" },
      "price": 250000000,
      "old_price": 350000000,
      "image": "products/product1.jpg",
      "created_at": "2026-02-16T09:00:00Z"
    }
  ],
  "meta": { "page": 1, "limit": 16, "total": 32, "total_pages": 2 }
}
```

`category` is embedded as an object, not an id — it avoids an N+1 round trip for a grid
that always renders the category label.

**No `badge` field.** The client derives it from `price`, `old_price` and `created_at` via
`badgeFor()`. A stored badge drifts from the prices it describes.

### `GET /api/products/featured`

> ✅ **Implemented.** `Backend/src/modules/catalogue/`

The eight home-page products. A curated list, not a filter — `?limit=8` would return an
arbitrary eight and quietly change the home page whenever the catalogue changes. Same item
shape as above.

### `GET /api/products/:slug`

> ✅ **Implemented.** `Backend/src/modules/catalogue/`

One product by slug. Slug, not id, so URLs are readable and stable across a reseed.

**Three outcomes, and clients must distinguish them** (`CAT-08`):

| Status | Meaning | Client action |
|---|---|---|
| `200` | Live product | Render it |
| `410` | Existed, no longer sold | Redirect to `error.redirect_to` |
| `404` | Never existed | Show "not found" |

A `410` body carries two extra fields inside `error`:

```json
{
  "error": {
    "code": "GONE",
    "message": "Product \"pingky\" is no longer available.",
    "correlationId": "943d2c01-…",
    "redirect_to": "/shop/luxury-king-bed",
    "redirect_kind": "product"
  }
}
```

`redirect_kind` is `product`, `category` or `shop`, in descending order of how close the
alternative is. `redirect_to` is always present on a `410` — a redirect target that might be
missing is a 404 with extra steps.

**This endpoint deliberately does not answer with an HTTP `301`.** `fetch` follows redirects
transparently, so a 301 here would hand the caller a *different* product's JSON under the URL
it requested — the page would render "Luxury King Bed" at `/shop/pingky` and nothing would
report a substitution. The 301 belongs on the page URL, and `npm run build` generates
`dist/_redirects` so a host can serve it.

A product becomes `410` either by failing the publish gate or by carrying
`"discontinued": true` in the catalogue data.

Returns the item shape plus `gallery` (array of image keys) and `stock` (integer) once a
product detail page exists. There is no such page today.

### Write endpoints

> 🔴 **Not implemented, not designed.**

`POST`, `PATCH` and `DELETE` on products are admin-only and blocked on authentication.
Do not add them before [Authentication](#authentication) is real; an unauthenticated write
endpoint is a defacement waiting to happen.

---

## Categories

### `GET /api/categories`

> ✅ **Implemented.** `Backend/src/modules/catalogue/`

Flat list, unpaginated — there are seven.

```json
{
  "data": [
    { "id": 3, "slug": "living-room", "name": "Living Room", "product_count": 9 }
  ]
}
```

`product_count` lets the filter UI render counts without a second call.

---

## Blog

### `GET /api/posts`

> ✅ **Implemented.** `Backend/src/modules/content/`

Paginated, `limit` default `3`. Sorted `published_at:desc`.

`published_at` is a real timestamp; the current local data stores `"14 Oct 2022"`, a
display string that cannot be sorted. Format at render.

### `GET /api/posts/recent`

> ✅ **Implemented.** Not in the original contract.

The five most recent posts in a compact form — no `body`, which is the bulk of a post — for
the blog sidebar. Added because the sidebar needs titles and dates, not article text.

### `GET /api/posts/tags`

> ✅ **Implemented.** Not in the original contract.

```json
{ "data": [{ "name": "Wood", "slug": "wood", "count": 1 }] }
```

Counts are derived, never stored. The sidebar previously hard-coded them (Crafts 2,
Design 8, Handmade 7, Interior 1, Wood 6) against three real posts.

### `GET /api/posts/:slug`

> ✅ **Implemented.** `Backend/src/modules/content/`

---

## Client errors

### `POST /api/client-errors`

> ✅ **Implemented.** `Backend/src/platform/clientErrors.js`

Receives a crash from a visitor's browser and writes it to the structured log (`PLAT-04`).
**The only unauthenticated write in the API, and the only `POST`.**

```json
{
  "kind": "render",
  "message": "Cannot read properties of undefined",
  "path": "/shop",
  "stack": "…",
  "componentStack": "…",
  "release": "a1b2c3d"
}
```

`kind` is one of `render`, `unhandled-rejection`, `window-error`, `chunk-load`; anything else
is recorded as `unknown` rather than reflected. Every field is read from that allowlist and
truncated — `message` 500 characters, `stack` and `componentStack` 4000 each. Nothing else in
the body is read, so an invented key cannot grow a log line.

**Always answers `204` with no body**, including for a body that made no sense. There is
nothing useful a crashed page can do with a `400`, and returning validation detail to an
anonymous caller only describes the parser to whoever is probing it. A report with no
`message` is dropped rather than logged as an empty line.

`path` must be the path only. A query string can carry a search term, which is the visitor's
and not needed to fix a bug.

Rate-limited by `RATE_LIMIT_CLIENT_ERROR_MAX` (60/hour per IP), **not** by
`RATE_LIMIT_WRITE_MAX`. The write limit is five an hour, which suits a contact form and not
this: reports arrive without anyone choosing to send them, and the key is an IP, so behind a
corporate NAT or mobile CGNAT one budget covers an entire office. One log line per request is
still cheap for the caller and disk for us, hence a limit at all. Reports are logged at `warn`, not `error` — a visitor's browser extension
throwing is not a server fault, and burying real 500s under extension noise is how alerting
gets ignored.

## Contact

### `POST /api/contact`

> 🔴 **Not implemented.**

Backs the form in [contact.jsx](Frontend/src/pages/contact.jsx), which currently has no
`onSubmit` handler at all — submitting it reloads the page and drops the message.

```json
{
  "name": "Ada Lovelace",
  "email": "ada@example.com",
  "subject": "Bulk order enquiry",
  "message": "Do you ship to Jakarta?"
}
```

`201` on success. Validation rules — all enforced **server-side**, because client
validation is a convenience and not a control:

| Field | Rule |
|---|---|
| `name` | Required, 1–100 chars |
| `email` | Required, valid address, ≤ 254 chars |
| `subject` | Optional, ≤ 200 chars |
| `message` | Required, 1–5000 chars |

This is the first endpoint to accept public input, so it is the first that needs:

- **Rate limiting** — per IP, e.g. 5/hour. Without it the form is a free spam relay.
- **A bot check** — honeypot field or CAPTCHA.
- **Escaping on output.** The message is attacker-controlled text. Anywhere it is rendered
  — an admin panel, a notification email — it must be escaped for that context, or it is
  stored XSS.
- **A privacy basis.** It collects personal data; see [SECURITY.md](SECURITY.md).

---

## Cart and checkout

> 🔴 **Not implemented, not designed.**

Deferred until there is a cart in the front end. Two rules are fixed in advance because
retrofitting them is expensive and getting them wrong is a financial loss, not a bug:

1. **The client never sends a price.** It sends `product_id` and `quantity`. The server
   reads the price from the database. A price in a request body is an attacker-controlled
   number, and accepting it means accepting orders at whatever total the buyer chooses.
2. **Totals are computed server-side and snapshotted onto the order.** A later catalogue
   price change must never alter a historical order.

Payment provider secret keys live only on the server, never in a `VITE_`-prefixed variable.
See [SECURITY.md](SECURITY.md#payments).

---

## Authentication

> 🔴 **Not implemented.**

No endpoint requires auth today because none exists. Supabase Auth is the intended
mechanism — it is already a dependency and issues JWTs the API can verify.

When added:

- Bearer tokens in the `Authorization: Bearer <jwt>` header.
- **Verify the JWT signature on every request.** Decoding a token is not verifying it;
  an unverified token is a claim the client made about itself.
- No tokens in `localStorage` if they can be avoided — `httpOnly` cookies are not readable
  by injected script. If cookies are used, `SameSite=Lax` at minimum, plus CSRF protection
  on state-changing methods.
- Row-level security stays enabled in Postgres regardless. Application-tier checks and RLS
  are defence in depth, not alternatives.

---

## CORS

> ✅ **Configured.** `Backend/src/app.js`, from `ALLOWED_ORIGINS`.

**Do not ship `cors()` with no arguments** — the default reflects any origin, which means
any website can call the API with a user's credentials.

**A disallowed origin is not an error.** The allowlist callback returns `false` rather than
throwing: the response is sent without an `Access-Control-Allow-Origin` header and the
browser refuses to hand it to the page, which is where CORS is enforced. Throwing instead
produced a `500` with a stack trace for every bot that sent an `Origin` header, burying real
server faults. A single `WARN  CORS origin rejected` line names the origin.

CORS is a browser mechanism, not access control. It stops another site reading this API in a
visitor's browser; it does not stop `curl`, and it is not what makes an endpoint private.

Allowlist the known front-end origins, and read them from the environment so production
does not inherit `localhost`:

```js
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS.split(","),
  credentials: true,
}));
```

---

## Implementation checklist

Order matters — items 1–3 are the ones that are painful to add afterwards.

- [x] `"type": "module"` in `Backend/package.json`, `start`/`dev` scripts, `dotenv.config()` first
- [x] Error middleware last, four-arg signature, correlation ids, no internals in `500`s
- [x] CORS allowlist from environment — rate limiting still outstanding (no public write yet)
- [~] Validation at the edge — hand-rolled in the catalogue controller. A schema library is
      still the right answer once a second module needs it
- [x] `GET /api/products` with pagination, filter, whitelisted sort
- [x] `GET /api/categories`, `GET /api/products/featured`, `GET /api/products/:slug`
- [ ] `POST /api/contact` with rate limit and bot check
- [x] `GET /api/posts`, `GET /api/posts/:slug`, plus `/recent` and `/tags`
- [ ] Authentication, then admin writes
- [ ] Cart, orders, payments — server-computed totals only
- [ ] Generate OpenAPI from the route definitions and replace this file's hand-written
      endpoint sections with the generated reference; keep the conventions above by hand

Update the 🔴 markers as endpoints land, and record each in [CHANGELOG.md](CHANGELOG.md).
