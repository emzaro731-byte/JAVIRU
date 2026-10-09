# JAVIRU Marketplace

A mobile-responsive marketplace storefront inspired by common e-commerce patterns. This independent concept is not affiliated with Jumia.

## Included
- Responsive marketplace layout, search, departments, sorting, product cards, cart and wishlist
- PostgreSQL-backed product catalogue and inventory
- Customer registration and sign-in with password hashing and signed HttpOnly session cookies
- Customer orders saved to PostgreSQL and visible only to the signed-in customer
- Server-side price and stock validation when placing orders
- Render health endpoint at `/health`

## Deploy on Render

The `render.yaml` Blueprint defines the Node web service, a PostgreSQL database, `DATABASE_URL`, and a generated `SESSION_SECRET`.

1. Open the Render Dashboard and choose **New + → Blueprint**.
2. Connect GitHub and select `emzaro731-byte/JAVIRU`.
3. Review the resources in `render.yaml`, then apply the Blueprint.
4. Wait for the web service and database to finish provisioning.
5. Open the JAVIRU web service URL and test account registration and checkout.

If you already created a regular Render Web Service instead of a Blueprint, add a Render PostgreSQL database and set these environment variables on the web service:
- `DATABASE_URL`: the database's internal connection string (use an external connection string only if required by your setup)
- `SESSION_SECRET`: a long, random secret value

After changing environment variables, redeploy the web service. The server creates its tables and initial catalogue on startup.

## Important limitations
- Checkout currently records an order using **Pay on delivery**; online payment is not integrated, so the site does not collect money.
- Real delivery tracking, seller registration/approval, seller payouts, refunds, customer notifications, and a secure admin dashboard still need to be built.
- The seeded products are illustrative; replace them with accurate product descriptions, images, prices, stock, warranty and delivery terms before selling.
- Do not publish database credentials or the session secret in source control.
