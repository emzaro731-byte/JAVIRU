# JAVIRU Marketplace

A mobile-responsive marketplace storefront inspired by common e-commerce patterns. This independent concept is not affiliated with Jumia.

## Included in the front-end starter
- Multi-department catalogue, product search, category filters, sorting, discount labels and stock display
- Shopping cart with quantity controls and browser persistence
- Wishlist
- Customer profile saved locally in the browser
- Demo checkout form, Nigerian state selector, order references and local order history
- Seller Centre demo for creating product listings
- Store Admin demo for managing the local catalogue and exporting JSON
- Responsive mobile/desktop layout and naira formatting

## Publish with GitHub Pages
1. Open **Settings → Pages** in this repository.
2. Select **Deploy from a branch**.
3. Choose the `main` branch and `/(root)`, then Save.
4. Wait for the Pages deployment to finish.

Expected URL: https://emzaro731-byte.github.io/JAVIRU/

## Important: this is not yet a production marketplace
The current site uses browser localStorage. Profiles, product changes, cart contents and demo orders only exist in the visitor's browser. There is no shared database, real authentication, actual payment processing, live delivery tracking, seller payouts, refunds or automated dropshipping. The demo checkout does not charge customers or notify the store. Product data is illustrative and should be verified/replaced.

Before accepting real orders, build and deploy a secure backend/database, implement verified user/seller accounts and role-based admin access, connect a Nigerian payment provider with server-side webhook verification, and add order fulfilment, delivery, return/refund and customer-support workflows. Never put secret API keys in `index.html`.
