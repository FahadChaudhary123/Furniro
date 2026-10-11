# Commerce data boundary

**Status:** draft for Milestone 2, 2026-10-11. Shopify is selected but not connected.
This describes the intended boundary from [ADR 0012](decisions/0012-adopt-commerce-platform.md);
it does not mark any purchase requirement complete.

## Authority by data type

| Data | Current authority | Intended trading authority |
|---|---|---|
| Product slug, name, description, category and local media key | `Backend/src/modules/catalogue/data/products.json` | Furniro catalogue until an ERP/PIM decision deliberately changes it |
| Display price | IDR amount in the same JSON file | Approved PKR value projected from the commerce platform; never inferred from IDR |
| Checkout price, discounts, tax, shipping and amount charged | None | Commerce platform, calculated for the current cart and destination |
| Availability and reservations | None | Commerce platform inventory rules, according to the chosen fulfilment model |
| Guest cart | Browser storage containing only `{slug, quantity}` | Same until checkout; the server resolves slugs to verified provider variants |
| Customer identity, addresses, payments and orders | None | Commerce platform and its configured payment provider; Furniro must not create a second order ledger |
| Blog posts | `Backend/src/modules/content/data/posts.json` | Furniro content until a CMS decision changes it |

The local JSON file remains the only Furniro product definition. A slug-to-variant mapping
will link that catalogue to the selected provider, but is not a second price list. Provider
IDs and any API credentials must stay server-side. Mapping coverage follows the catalogue
publish gate and excludes discontinued products. The browser must never submit a price,
trust a cached amount for checkout, or receive a private provider credential.

## Trading data flow to build after provider selection

1. Approve PKR prices and the fulfilment model. Configure each published product and
   variant in the platform; validate mapping coverage, currency, price, image and
   availability against its API. Do not infer PKR from the current IDR amounts.
2. Before showing an enabled purchase action, replace or reconcile the storefront's local
   display price and availability with provider data. If reconciliation fails or the
   provider is unavailable, suppress purchase actions for affected items rather than
   displaying a stale amount as a purchasable offer.
3. At checkout, send `{slug, quantity}` to Furniro's server. The server resolves each slug
   to a verified variant, rejects missing or unavailable lines, and asks the platform to
   calculate the current total. The platform owns the checkout session and order record.
4. Preserve the browser cart when checkout creation fails. Clear it only after a verified
   successful order outcome; a redirect or browser return alone is insufficient proof.
5. Treat provider webhooks as untrusted input until signatures are verified. Handle retries
   idempotently and reconcile order and payment state with the provider. Do not log card
   details, raw customer payloads or provider secrets.

## Privacy and operations boundary

Before collecting customer data, record the selected platform and payment processor in
[THIRD_PARTY_REGISTER.md](THIRD_PARTY_REGISTER.md) and add their actual processing,
retention, access and deletion/export paths to
[PROCESSING_REGISTER.md](PROCESSING_REGISTER.md). Publish reviewed privacy and legal copy.
Subject requests must cover Furniro logs/browser storage and every provider that holds the
person's data; the platform's export or deletion button alone is not a complete process.

## Decisions still required

- Both cash on delivery and online payment are required at launch by
  [ADR 0013](decisions/0013-offer-cod-and-online-payment-at-launch.md). An eligible
  Pakistan PKR online gateway and real merchant account are still needed.
- Stocked, made-to-order or dropship fulfilment; reservation and lead-time rules.
- Approved PKR prices, tax treatment, shipping regions/rates and returns policy.
- Whether an ERP/PIM owns long-term product and stock updates. Shopify is selected in
  [ADR 0014](decisions/0014-select-shopify-for-commerce.md), but its store and gateway
  have not been verified.
- Provider-specific data sync, failure behavior, reconciliation interval, webhook events
  and subject-request procedure. Verify these in a working environment before checkout.
