# Data model

The app has no database. Entities are JavaScript array literals. This document records
those shapes, the conflicts between them, and the Postgres schema they imply.

> **Products are now resolved and served over HTTP.** The catalogue lives in
> `Backend/src/modules/catalogue/data/products.json` — 40 products, one canonical shape,
> integer minor units, derived badges — and the front end fetches it from
> `GET /api/products`. There is no second copy anywhere. The conflict analysis below is kept
> as the record of why the shape is what it is; everything else on this page still describes
> the current state.

---

## Current state: six literals across five files

| Entity | Defined in | Rows | Scope |
|---|---|---|---|
| ~~Shop products~~ | **Now** `Backend/…/catalogue/data/products.json`, over the API | 40 | One source |
| ~~Featured products~~ | **Now** `featured` in the same file | 8 | Curated slug list |
| Range categories | [BrowseRange.jsx](Frontend/src/sections/BrowseRange.jsx) | 3 | Module-level `const` |
| Room inspiration | [RoomsInspiration.jsx](Frontend/src/sections/RoomsInspiration.jsx) | 3 | Module-level `const` |
| Blog posts | [BlogSection.jsx](Frontend/src/sections/BlogSection.jsx) | 3 | Inside the component body |
| Setup gallery | [ShareSetup.jsx](Frontend/src/sections/ShareSetup.jsx) | 8 | Imported images |

`blogPosts` being declared inside the component body means it is reallocated on every
render. Harmless at this size, and it becomes a real cost the moment it is passed to a
memoised child — hoist it to module scope like the others.

---

## The product shape conflict (resolved)

> **Fixed 2026-09-07.** Both consumers now import from `modules/catalogue`. Retained
> because the reasoning still governs the schema and the API response shape.

**Two files described products. They disagree on nearly every field.** Neither can consume
the other's data. They do not collide today only because `ProductsSection` renders its own
inline card markup instead of reusing
[ProductCard.jsx](Frontend/src/components/ProductCard.jsx) — which is itself duplication,
and it means the shared card has never been tested against half the product data in the
repo.

| Concern | `ProductGrid.jsx` (shop, 32 rows) | `ProductsSection.jsx` (home, 8 rows) |
|---|---|---|
| Display name | `title` | `name` |
| Secondary text | `category` — `"Living Room"` | `desc` — `"Stylish cafe chair"` |
| Price | `2500000` — number | `"Rp 2.500.000"` — formatted string |
| Old price | `3500000` — number | `"Rp 3.500.000"` — formatted string |
| Image | `"/images/product1.png"` — public path | `product1` — imported module |
| Badge | `"-30%"` \| `"New"` \| absent | same |
| `id` | present | present |

### Why this is load-bearing

1. **`ProductCard` calls `product.price.toLocaleString()`.** That is a number method. Pass
   it a `ProductsSection` row and the string `"Rp 2.500.000"` returns itself unchanged, so
   the card silently renders `Rp Rp 2.500.000`. Pass it a row where `price` is absent and
   it throws. The component is only safe with `ProductGrid`'s shape.

2. **The 32 shop rows point at images that do not exist.** They reference
   `/images/product1.png` through `/images/product4.png`, which resolve against
   `Frontend/public/`. That directory contains one file, `vite.svg`. **Every image on the
   shop page is a 404.** The real files are at
   `Frontend/src/assets/Products/product1.jpg` … `product8.jpg` — note `.jpg`, not `.png`,
   and note there are eight of them, not four.

3. **Formatted price strings cannot be sorted, filtered or summed.** The shop's
   "Price: Low to High" dropdown cannot ever work against them, and neither can a cart
   subtotal.

4. **`category` and `desc` are different concepts.** A product has both — a taxonomy slot
   and a one-line description. The two files each kept one and dropped the other.

### Resolution

Adopt `ProductGrid`'s numeric-price shape as canonical, add the fields it is missing, and
format at the render boundary rather than in the data. Concretely:

- `price` and `old_price` stay integers, **in minor units** (see [Money](#money)).
- Keep both `category` and `description`.
- Rename `title` to `name` — it matches the eventual database column and reads better.
- Store an image **key**, not a path; let a single helper resolve it. Baking
  `/images/...` into rows is what produced the 404s.
- Derive the badge rather than storing it: `-30%` is a function of `price` and `old_price`,
  and storing it separately guarantees the two drift apart. `"New"` is a function of
  `created_at`.

```js
// The canonical shape. One definition, both call sites.
{
  id: 1,
  slug: "syltherine",              // URL-safe, for /shop/:slug
  name: "Syltherine",
  description: "Stylish cafe chair",
  category: "Living Room",
  price: 250000000,                // minor units — Rp 2.500.000
  old_price: 350000000,            // null when not discounted
  image: "products/product1.jpg",  // key, resolved by a helper
  created_at: "2026-02-16T00:00:00Z"
}
```

```js
// Badge, derived — never stored.
function badgeFor(product, now = Date.now()) {
  if (product.old_price && product.old_price > product.price) {
    const off = Math.round((1 - product.price / product.old_price) * 100);
    return { kind: "discount", label: `-${off}%` };
  }
  const age = now - new Date(product.created_at).getTime();
  if (age < 30 * 24 * 60 * 60 * 1000) return { kind: "new", label: "New" };
  return null;
}
```

---

## Money

**Store integers in minor units. Never floats, never formatted strings.**

Prices are Indonesian rupiah — the UI renders `Rp`. IDR has no minor unit in practice, but
the storefront also renders `Rs` on the same card (see below), so the currency question is
unsettled and a fixed 2-decimal minor unit keeps every option open. `2_500_000.00` rupiah
is stored as `250000000`.

Floats are disqualified outright: `0.1 + 0.2 !== 0.3`, and money that does not add up is a
defect a customer notices.

Formatting belongs in exactly one helper:

```js
const IDR = new Intl.NumberFormat("id-ID", {
  style: "currency", currency: "IDR", minimumFractionDigits: 0,
});
export const formatPrice = (minorUnits) => IDR.format(minorUnits / 100);
```

### Currency inconsistency (fixed)

`ProductCard` rendered the current price with `Rp` and the struck-through old price with
**`Rs`** — two currencies on one card, two lines apart. Both now go through
`shared/lib/money.js`, which makes the class of bug impossible rather than fixing one
instance of it.

### Stored badges were already wrong (fixed)

Replacing stored badges with `badgeFor()` surfaced two that had drifted from the prices they
described, exactly as predicted above:

| Product | Was labelled | Actually |
|---|---|---|
| Syltherine (2.5M / 3.5M) | `-30%` | **`-29%`** |
| Fabric Recliner (5.4M / 6.2M) | `-10%` | **`-13%`** |

Both were visible to customers. Neither would have been found by reading the code.

---

## Entities

### Product

The catalogue item. Canonical shape above.

| Field | Type | Notes |
|---|---|---|
| `id` | integer | Primary key |
| `slug` | text | Unique, URL-safe |
| `name` | text | Display name |
| `description` | text | One line, shown under the name |
| `category` | text | See [Category](#category) — a foreign key once normalised |
| `price` | integer | Minor units, `>= 0` |
| `old_price` | integer \| null | Must exceed `price` when present |
| `image` | text | Storage key |
| `created_at` | timestamptz | Drives the "New" badge |

Observed categories across the 32 shop rows: **Living Room, Bedroom, Dining, Office,
Outdoor, Decor, Storage** — seven values, free text today. Free text means `"Living Room"`,
`"living room"` and `"Livingroom"` are three different categories to a `WHERE` clause; the
filter UI will silently miss rows. Normalise before the catalogue grows.

### Category

Two different things currently share the word.

**Product taxonomy** — the seven strings above, used for filtering.

**Range categories** — [BrowseRange.jsx](Frontend/src/sections/BrowseRange.jsx), a
marketing block of three (Dining, Living, Bedroom), each with a description and a
three-image carousel:

```js
{ title: "Dining", description: "Where moments are shared…", images: [img, img, img] }
```

These overlap but are not the same set — the taxonomy has seven values, the marketing block
three, and only Dining and Bedroom match by name ("Living" vs "Living Room" do not). Keep
them as separate tables; collapsing them couples a merchandising decision to the product
taxonomy.

### Room inspiration

[RoomsInspiration.jsx](Frontend/src/sections/RoomsInspiration.jsx). Presentational only.

```js
{ id: 1, title: "Inner Peace", category: "Bed Room", image: bedroom }
```

Note `"Bed Room"` here versus `"Bedroom"` in the product taxonomy — a third spelling of the
same concept. Presentational today, a join failure the moment these link to filtered
listings.

### Blog post

[BlogSection.jsx](Frontend/src/sections/BlogSection.jsx).

```js
{ title: "…", text: "…", img: blogImg, author: "Admin", date: "14 Oct 2022", tag: "Wood" }
```

Two issues for persistence: no `id`, so React keys fall back to array index; and `date` is
a display string (`"14 Oct 2022"`), which cannot be sorted or compared. Store `timestamptz`
and format at render.

---

## Proposed schema

Postgres, for Supabase. Enable row-level security on every table — in Supabase the anon key
is public, and RLS is the only thing standing between it and your data.

```sql
create table categories (
  id          serial primary key,
  slug        text not null unique,
  name        text not null,
  description text
);

create table products (
  id          serial primary key,
  slug        text not null unique,
  name        text not null,
  description text,
  category_id integer not null references categories(id),
  price       integer not null check (price >= 0),   -- minor units
  old_price   integer check (old_price > price),
  image       text not null,
  created_at  timestamptz not null default now()
);

create index products_category_id_idx on products (category_id);
create index products_created_at_idx  on products (created_at desc);

create table blog_posts (
  id           serial primary key,
  slug         text not null unique,
  title        text not null,
  body         text not null,
  author       text not null,
  tag          text,
  image        text,
  published_at timestamptz not null default now()
);

alter table products   enable row level security;
alter table categories enable row level security;
alter table blog_posts enable row level security;

create policy "public read" on products   for select using (true);
create policy "public read" on categories for select using (true);
create policy "public read" on blog_posts for select using (true);
-- No insert/update/delete policy: writes are denied to the anon key by default.
```

`old_price > price` is enforced by the database, not by convention — a discount that raises
the price is nonsense, and a check constraint is cheaper than the bug report.

### Not yet designed

`carts`, `cart_items`, `orders`, `order_items`, `users`. Deferred until checkout is real,
but two constraints are worth fixing now because they are expensive to retrofit:

- **`order_items` snapshots price at purchase time.** It never joins to `products.price`
  for a historical order — a later price change must not rewrite what a customer paid.
- **Order totals are computed server-side from those snapshots.** A total submitted by the
  client is an attacker-controlled number. See [SECURITY.md](SECURITY.md).

---

## Migration path

The sequence that avoids doing the work twice:

1. ~~**Reconcile the product shape.**~~ **Done.** One canonical set of 40 products, now in
   `Backend/src/modules/catalogue/data/products.json`. Image paths fixed; all 404s gone.
2. ~~**Introduce the formatter.**~~ **Done.** `Frontend/src/shared/lib/money.js`. Every
   inline `toLocaleString()` and the `Rs` typo are gone.
3. ~~**Derive badges**~~ **Done.** `modules/catalogue/lib/badge.js`. Two stored badges were
   already wrong when replaced — see [Currency inconsistency](#currency-inconsistency-fixed).
4. **Create the tables and seed them** from `products.json` — it is already the right shape,
   so the seed is a script, not a rewrite. **Still outstanding: there is no database.**
5. ~~**Implement the read endpoints**~~ **Done** — see [API.md](API.md). The repository is
   the only file that would change when the tables exist.
6. ~~**Swap the import for a `useProducts()` hook.**~~ **Done.** Because steps 1–3 froze the
   shape, this touched the fetch boundary and nothing else — no component changed its
   understanding of a product.

Steps 1–3 are worth doing even if the back end is never built.
