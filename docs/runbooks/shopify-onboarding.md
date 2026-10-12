# Runbook: prepare Shopify for Furniro

**Status:** preparation only, 2026-10-12. No store, gateway or API connection has been
verified. Deployment remains deferred. This procedure prepares Milestone 2; completing
it does not enable checkout or complete the purchase requirements.

Decision: [ADR 0014](../decisions/0014-select-shopify-for-commerce.md). Market: Pakistan
only, PKR, with COD and online payment. Use a test environment and synthetic customer
details for verification. The merchant completes identity and bank verification directly
with the providers; never put those documents or credentials in this repository.

## Procedure

1. **Establish the store and its owner.** Record the store's `myshopify.com` domain,
   accountable owner, backup and test environment in a private operating record. Confirm
   plan costs with the merchant before subscribing. Configure the merchant's actual
   Pakistan business details, PKR store currency and Pakistan-only selling/shipping
   scope. Verify that a non-Pakistan shipping destination cannot complete checkout.

2. **Verify the online gateway before integration.** Check Safepay availability in this
   store's payment settings and complete the provider's merchant review. Safepay
   [advertises Shopify payment apps](https://safepay.pk/pricing), including card payments;
   verify the specific app supports the chosen methods. A Raast-only app is not proof of
   card acceptance. Record dated evidence of PKR charging and bank settlement, accepted
   methods, fees including Shopify fees, payout timing, refunds, disputes and test mode.
   If eligibility fails, leave the online path blocked and evaluate another compatible
   gateway. Do not treat an app installation as onboarding approval.

3. **Prepare COD operations.** Configure Shopify's
   [manual COD method](https://help.shopify.com/en/manual/payments/manual-payments) in the
   test environment, with instructions confirmed by the delivery operator. Verify the
   order is unpaid until collection is confirmed. Define who confirms collection,
   records payment and handles failed delivery. COD cannot stand in for the online test.

4. **Approve the trading data.** Follow [PKR repricing](pkr-repricing.md). Obtain real
   product availability or made-to-order lead times, weights, tax treatment, shipping
   charges and returns terms. Keep unverified products unavailable for purchase. Do not
   upload the current IDR amounts as PKR. Configure approved products and variants in
   Shopify; preserve the local catalogue as the source of descriptions until its
   ownership is deliberately changed.

5. **Prepare Storefront API access.** Follow Shopify's
   [Headless channel setup](https://shopify.dev/docs/storefronts/headless/building-with-the-storefront-api/getting-started).
   Create the storefront and grant only permissions required by the planned integration.
   Keep its private token in the merchant's secret manager for eventual server use; do
   not paste it into chat, docs, Git or any `VITE_` variable. Record the credential owner
   and rotation procedure. The running API has no Shopify integration yet. The optional
   read-only mapping command below is the only consumer of these settings.

6. **Prepare and check the mapping.** From `Backend/`, use a private file outside the
   repository (PowerShell):

   ```powershell
   npm run mapping -- --template "$env:USERPROFILE\furniro-shopify-mapping.json"
   npm run mapping -- --check "$env:USERPROFILE\furniro-shopify-mapping.json"
   ```

   Between these commands, fill each row with the real Shopify Product and ProductVariant
   global IDs. The template refuses to overwrite a file. A check on the blank template
   must fail. A filled worksheet passes only local coverage, uniqueness and ID-shape
   validation. Verify remotely that every variant belongs to the named product, is
   visible to the intended storefront and matches its approved PKR price, image and
   availability. Record discrepancies and correct them before using the mapping.

   After approved PKR prices are applied, configure `SHOPIFY_STORE_DOMAIN` (bare
   `your-store.myshopify.com`) and `SHOPIFY_STOREFRONT_PRIVATE_TOKEN` privately in the
   command environment or ignored `Backend/.env`, using `.env.example` for key names.
   Never pass the token as a command argument. Run:

   ```powershell
   npm run mapping:shopify -- "$env:USERPROFILE\furniro-shopify-mapping.json"
   ```

   This queries Storefront API `2026-10` in Pakistan context and makes no mutations.
   It checks accessible variants, their parent products, PKR selling prices against
   the canonical catalogue, availability and image presence. IDR catalogues, missing
   access, API errors and mismatches fail with a nonzero exit code. Requests time out
   after 15 seconds per batch; redirects and unexpected API versions are rejected.
   It does not verify image identity, comparison prices, actual stock or lead times,
   reservations, shipping, tax, payment eligibility or checkout. Review those separately.
   See Shopify's [nodes query](https://shopify.dev/docs/api/storefront/2026-10/queries/nodes)
   and [variant fields](https://shopify.dev/docs/api/storefront/2026-10/objects/ProductVariant).

7. **Hand off verified inputs.** Update the provider and processing registers with the
   actual account, retention, access, deletion/export, support and operational details.
   Store only non-sensitive evidence references in Git. The engineering handoff needs
   verified store access, a complete mapping, approved prices and fulfilment rules, and
   working gateway test mode. Then implement Milestone 3 and exercise successful and
   failed payment, COD, cancellation/refund, order confirmation and webhook handling.
   A provider dashboard test alone does not verify Furniro's purchase path.

## Evidence to retain privately

| Evidence | Current state |
|---|---|
| Store domain, owner and backup; plan and costs | Missing |
| Pakistan/PKR settings; excluded shipping destinations | Unverified |
| Gateway onboarding, methods, settlement and test mode | Unverified |
| COD collection and delivery-failure procedure | Missing |
| Approved PKR prices, tax, shipping, availability and returns | Missing |
| Headless access and credential rotation ownership | Unverified |
| Complete mapping with remote product/variant checks | Missing |
| Provider processing and operational review | Missing |

If a step fails, retain its unresolved state and keep ordering disabled. Revoke unused
tokens through the provider dashboard and remove abandoned test apps after checking that
no other integration uses them. Do not delete store products or orders as cleanup.
