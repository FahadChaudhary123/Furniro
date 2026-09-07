# API

**Status: the catalogue endpoints are live; nothing else is.** `GET /api/products`,
`/api/products/featured`, `/api/products/:slug` and `/api/categories` are implemented and
covered by 29 smoke checks, and **the front end consumes them**. Everything else below is
still the contract to build against.

Conventions and error shapes here are binding once implementation starts — agreeing them
before the first route is written is the point of the document.

- Entity shapes: [DATA_MODEL.md](DATA_MODEL.md)
- Layering (`routes` → `controllers` → `models`): [ARCHITECTURE.md](ARCHITECTURE.md#back-end)

---

## Conventions

**Base URL** — `http://localhost:3000/api` in development, `PORT` from `Backend/.env`.
The front end must read this from `VITE_API_URL` and never hard-code a host.

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
| `422` | Well-formed but semantically invalid |
| `429` | Rate limited |
| `500` | Server fault — never leak internals |

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

One product by slug. `404` if absent. Slug, not id, so URLs are readable and stable across
a reseed.

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

> 🔴 **Not implemented.**

Paginated, `limit` default `3`. Sorted `published_at:desc`.

`published_at` is a real timestamp; the current local data stores `"14 Oct 2022"`, a
display string that cannot be sorted. Format at render.

### `GET /api/posts/:slug`

> 🔴 **Not implemented.**

---

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

`cors` is a dependency and currently unconfigured. **Do not ship `cors()` with no
arguments** — the default reflects any origin, which means any website can call the API
with a user's credentials.

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
- [ ] `GET /api/posts`, `GET /api/posts/:slug`
- [ ] Authentication, then admin writes
- [ ] Cart, orders, payments — server-computed totals only
- [ ] Generate OpenAPI from the route definitions and replace this file's hand-written
      endpoint sections with the generated reference; keep the conventions above by hand

Update the 🔴 markers as endpoints land, and record each in [CHANGELOG.md](CHANGELOG.md).
