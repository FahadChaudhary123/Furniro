# 0013 — Offer cash on delivery and online payment at launch

**Date:** 2026-10-11  
**Status:** Accepted

## Context

Furniro's first checkout is planned for customers in Pakistan, charged in PKR. The merchant
has chosen to offer both cash on delivery and online payment in that first checkout. The
commerce provider, online gateway, fulfilment model and approved PKR prices are still open.

## Decision

Configure both methods in the selected commerce platform for the first trading release.
The platform must create a durable order for either method and calculate the authoritative
PKR total. Cash on delivery is a manual, unpaid-until-collected path; an operator must
record collection and resolve failed deliveries. Online payment requires an eligible
gateway that can charge PKR for this Pakistan merchant and support the chosen checkout.
The exact online method (card, wallet or another supported method) remains to be selected;
this decision does not assume a particular gateway or payment instrument.

No checkout action goes live until both paths are configured and tested in a real
non-production environment. If one method cannot be enabled, revisit this decision rather
than silently launching only the other.

## Alternatives

- Cash on delivery only: avoids a gateway at launch, but does not meet the chosen online
  payment requirement.
- Online payment only: omits the chosen pay-on-delivery option and its manual fulfilment
  workflow.

## Consequences

- Provider selection must verify online gateway eligibility, PKR charging, settlement,
  fees, refunds and test mode in the merchant's account. A provider listing alone is not
  evidence of eligibility.
- Checkout must let an operator disable either method independently during an incident;
  order/payment states and confirmations must distinguish unpaid COD from paid online
  orders.
- The fulfilment model, shipping rules, returns policy and approved PKR price list remain
  separate decisions. This record does not mark `PAY-01`, `PAY-03` or `CHK-03` complete.
