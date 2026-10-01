# Runbook: approve PKR catalogue prices

The first checkout market is Pakistan, in PKR. Current product amounts are IDR. A currency
label change is not a conversion or an approved price list. Do this before enabling any
checkout or changing the catalogue currency.

1. In `Backend/`, create a blank proposal outside this repository (PowerShell):

   ```powershell
   npm run prices:pkr -- --template "$env:USERPROFILE\furniro-pkr-prices.json"
   ```

   The file lists each slug once with `price_minor: null` and `old_price_minor: null`.
   It does not copy or convert IDR amounts. The command refuses to overwrite an existing
   proposal. Keep the file out of Git.

2. Have the catalogue owner approve the PKR selling price for every slug. Enter **integer
   minor units**: PKR 125,000.00 is `12500000`; PKR 125,000.50 is `12500050`. Enter
   `old_price_minor: null` unless a real, approved comparison price exists. When present,
   the old price must exceed the selling price. Check tax inclusion and any promotional
   claims under the applicable Pakistan rules before approval.

3. Validate without writing:

   ```powershell
   npm run prices:pkr -- --check "$env:USERPROFILE\furniro-pkr-prices.json"
   ```

   This must report a valid proposal for all 40 products. It rejects blanks, strings,
   duplicate/unknown/missing slugs, unsafe integers, invalid old prices and a proposal
   whose products fail the publish gate.

4. Review the complete proposal against the approved price sheet. Then run:

   ```powershell
   npm run prices:pkr -- --apply "$env:USERPROFILE\furniro-pkr-prices.json"
   npm run completeness
   ```

   `--apply` changes only the canonical `products.json` after full validation. Review the
   resulting Git diff product by product. The API and storefront will then display PKR.
   Run `npm run verify` and `npm run e2e` from `Frontend/`, and `npm run smoke` against a
   running API from `Backend/` before release. No checkout is enabled by this migration.

5. If any amount is wrong, restore the catalogue file from the previous reviewed Git
   revision, correct the proposal and repeat the validation. Do not patch individual
   displayed prices in the frontend.
