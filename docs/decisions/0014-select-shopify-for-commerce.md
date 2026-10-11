# 0014 — Select Shopify for commerce

**Date:** 2026-10-11  
**Status:** Accepted

## Context

Furniro's first trading market is Pakistan, charged in PKR, with both cash on delivery and online payment ([ADR 0013](0013-offer-cod-and-online-payment-at-launch.md)). The current application has no checkout, order ledger or inventory. Its product amounts are IDR display data, not approved PKR prices.

Shopify provides a [hosted checkout reached through its Storefront Cart API](https://shopify.dev/docs/storefronts/headless/building-with-the-storefront-api/cart/manage) and supports [cash on delivery as a manual payment method](https://help.shopify.com/en/manual/payments/manual-payments). Pakistan is absent from the [Shopify Payments supported-country list](https://help.shopify.com/en/manual/payments/shopify-payments/supported-countries), so online payment needs an eligible third-party provider. [Safepay advertises Shopify payment apps](https://safepay.pk/pricing), including a card option, but that public claim does not establish eligibility for this merchant's account.

## Decision

Use Shopify as the target authority for checkout, orders, checkout totals and inventory. Configure COD as a manual payment method. Evaluate Safepay first for online PKR payments, including card acceptance, but treat it as a **candidate**, not an activated or approved gateway. Verify its availability in this merchant's Shopify admin and obtain merchant-specific confirmation of onboarding, PKR charging and settlement, payment methods, fees, refunds, disputes and test mode. If Safepay cannot satisfy these conditions, evaluate another Shopify-compatible Pakistan gateway before reconsidering the platform.

Until real product stock or lead-time information exists, treat every product as unavailable for purchase. Do not infer a stocked, made-to-order or dropship model. Enable no checkout action until approved PKR prices, provider variants, availability, shipping, tax, returns and both payment paths have been verified in a test purchase.

## Alternatives

- Medusa permits more custom commerce workflows, but requires operating the commerce service and integrating an eligible online payment provider. Its [system payment provider](https://docs.medusajs.com/resources/commerce-modules/payment/payment-provider) can model manual collection but does not process an online charge.
- A Furniro-owned checkout and order ledger would add payment and inventory responsibilities already assigned to a platform by [ADR 0012](0012-adopt-commerce-platform.md).
- A COD-only first release would not satisfy [ADR 0013](0013-offer-cod-and-online-payment-at-launch.md).

## Consequences

The existing read API and browser cart continue until a deliberate integration replaces their trading data paths. Furniro will map published slugs to Shopify variants on the server; Shopify will calculate the charge and own the order record. The gateway and store have not been connected. No purchase requirement is complete by this decision alone. The merchant must supply approved prices and factual fulfilment information, and complete provider onboarding before implementation can be verified.
