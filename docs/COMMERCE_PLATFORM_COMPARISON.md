# Commerce platform comparison

**Status:** evaluation, 2026-10-01; payment evidence rechecked 2026-10-10.
[ADR 0012](decisions/0012-adopt-commerce-platform.md)
selects a platform approach; it does not select a provider.

The first release needs a provider-owned checkout, order record, payment handling and
inventory. Furniro keeps the React storefront, JSON-backed read API and `{slug, quantity}`
guest cart until an integration replaces the relevant data paths. The platform must own the
amount charged. The current catalogue prices are display data only.

| Criterion | Shopify | Medusa |
|---|---|---|
| Checkout path | Storefront Cart API accepts variant IDs and returns a URL for Shopify's hosted web checkout. [Source](https://shopify.dev/docs/storefronts/headless/building-with-the-storefront-api/cart/manage) | Storefront checkout is built through cart and payment-provider steps; Medusa supplies commerce modules and an admin. [Source](https://docs.medusajs.com/learn) |
| Operations | Hosted commerce service; Furniro still runs its storefront and read API. [Source](https://shopify.dev/docs/storefronts/headless/bring-your-own-stack) | The commerce application needs deployment and operations, either self-hosted or on Medusa Cloud. [Source](https://docs.medusajs.com/learn) |
| Cost model | Subscription plus payment fees; the [current US pricing page](https://www.shopify.com/pricing) lists Basic at $29/month billed yearly, but region and gateway costs must be checked for the actual business. | Hosting, database, payment-provider and engineering costs depend on deployment and providers; [Medusa's pricing page](https://medusajs.com/pricing) is the place to check a managed option. |
| Flexibility | Faster path to a hosted checkout, with platform-specific product, variant and cart APIs. | More control over the commerce application and its workflows, with more integration and operating work. [Source](https://docs.medusajs.com/learn) |

## Pakistan launch constraint

The merchant is based in Pakistan. Shopify's current [supported-country list](https://help.shopify.com/en/manual/payments/shopify-payments/supported-countries)
does not include Pakistan, so Shopify Payments cannot be assumed. Shopify does support
[third-party gateways](https://help.shopify.com/en/manual/payments/third-party-providers/payment-gateway-availability),
but a specific provider must be confirmed in the merchant's Shopify admin and with that
provider before implementation. Third-party [transaction fees](https://help.shopify.com/en/manual/payments/third-party-providers)
may apply. Medusa allows a [custom payment provider](https://docs.medusajs.com/resources/commerce-modules/payment/payment-provider),
which creates integration work rather than solving gateway availability by itself.

The first checkout market is **Pakistan only, charged in PKR**. The current catalogue
amounts were authored as Indonesian rupiah (`IDR`), so they are not PKR price data.
Reprice every product in integer PKR minor units and approve the amounts before a PKR
formatter or checkout is enabled. Relabelling the existing numbers would mislead buyers.

### Payment provider decision gate

Shopify's [provider setup guide](https://help.shopify.com/en/manual/payments/third-party-providers/configuring-providers)
says the available providers appear in the store's Payments settings. A listing on the
[country gateway page](https://help.shopify.com/en/manual/payments/third-party-providers/payment-gateway-availability)
does not guarantee that a provider can be activated for a particular store. Before choosing
Shopify, confirm a provider in a Pakistan-based merchant account and obtain the provider's
written confirmation that it can onboard this business, charge PKR, and settle to its bank.
Record supported customer methods, fees, refunds, test mode and dispute handling. A provider
name found in a search result is insufficient evidence of merchant eligibility.

If launch uses cash on delivery, Shopify documents it as a
[manual payment method](https://help.shopify.com/en/manual/payments/manual-payments).
Medusa's default [`system` payment provider](https://docs.medusajs.com/resources/commerce-modules/payment/payment-provider)
can represent manual payment, but it does not process an online charge. Decide whether
online payment is required at launch before treating either path as sufficient for `PAY-01`.

For a cash-on-delivery launch, Shopify's manual method creates an order marked unpaid;
an operator marks it paid after collecting the money. Shopify says its third-party
transaction fee does not apply to manual payments. This removes the need to activate an
online gateway for the first order, but it does not establish that the merchant can open
the required store or that shipping, tax and returns are configured correctly. An online
payment option still requires a confirmed eligible gateway in the merchant account.
Medusa's `system` provider likewise leaves collection to the merchant and requires an
operated Medusa service. These are provider capabilities, not an approved COD policy.

## Gates before selecting a provider

1. Obtain approved PKR prices for the 40 products and confirm whether prices include tax.
   Shopify's [payment availability](https://help.shopify.com/en/manual/payments/third-party-providers/payment-gateway-availability)
   is country-specific; Medusa still needs an available payment provider.
2. Confirm whether products are stocked, made to order or drop-shipped, and who owns tax,
   shipping rates and returns. This determines whether platform inventory and checkout can
   satisfy `INV`, `FUL`, `CHK` and `RET` requirements.
3. Map each published Furniro slug to a platform product and variant, including currency,
   price, availability and image. No mapping exists today. Do not expose an enabled checkout
   action for an unmapped cart. Generate a blank worksheet with
   `cd Backend; npm run mapping -- --template mapping.json`, then validate filled IDs with
   `npm run mapping -- --check mapping.json`. This checks local coverage and duplicate
   variants only; confirm currency, price, availability and image against the provider API
   separately. Keep the filled worksheet private until its identifiers and access model are
   reviewed; it is not a second product catalogue.
4. Run a test purchase through payment, order creation, cancellation/refund and webhook
   delivery. Requirements stay open until this works in a non-production environment.

**Provisional recommendation:** Shopify is the shorter implementation path if a suitable
third-party gateway accepts this Pakistan merchant and target market. Medusa is a
better candidate when required workflows cannot be represented in Shopify and the team can
operate another backend. The launch market and currency are settled; payment methods,
gateway eligibility and fulfilment remain open. This comparison is not a provider approval
or an authorization to create an account.
