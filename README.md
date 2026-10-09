# JAVIRU Marketplace

A mobile-responsive marketplace storefront inspired by common e-commerce patterns. This independent concept is not affiliated with Jumia.

## Included
- Responsive marketplace layout, search, departments, sorting, product cards, cart and wishlist
- PostgreSQL-backed product catalogue and inventory
- Customer registration and sign-in with password hashing and signed HttpOnly session cookies
- Customer orders saved to PostgreSQL and visible only to the signed-in customer
- Server-side price and stock validation when placing orders
- Render health endpoint at `/health`
- Automatic database table creation and starter product seeding on server startup

## Use Supabase with Render

The Render Blueprint configures the web service to expect `SUPABASE_DB_URL` and generates `SESSION_SECRET`. For security, the Supabase database connection string is entered in Render and is not stored in this repository.

1. Open the [Supabase project](https://supabase.com/dashboard/project/vihbsfrwnslnmheowkhy).
2. Open **Project Settings → Database** and find the PostgreSQL connection string. Use the connection-pooler connection string if your hosting network requires it. Keep the database password private.
3. Open the [Render Dashboard](https://dashboard.render.com/), select the JAVIRU web service, then open **Environment**.
4. Add `SUPABASE_DB_URL` and paste the full PostgreSQL connection string from Supabase. Keep the generated `SESSION_SECRET` set.
5. Save the changes and redeploy the service.
6. Open `https://javiru-com.onrender.com/health`. A healthy connection should return JSON with `"database":"connected"`.

When the server starts with `SUPABASE_DB_URL` configured, it automatically creates the `users`, `products`, `orders`, and `order_items` tables if they do not exist, and inserts starter products without overwriting existing products. You do not need to create these tables manually.

If you deploy through **New + → Blueprint**, connect the `emzaro731-byte/JAVIRU` repository and apply the Blueprint. Render will ask you to provide the value for `SUPABASE_DB_URL`. If you already have a Render service, add the variable in its Environment settings instead.

## Important limitations
- Do not use the Supabase project URL or public anon key as `SUPABASE_DB_URL`; this variable must contain a PostgreSQL connection string.
- Never put the database password, service-role key, or session secret in frontend code or commit them to GitHub.
- Checkout currently records an order using **Pay on delivery**; online payment is not integrated, so the site does not collect money.
- Real delivery tracking, seller registration/approval, seller payouts, refunds, customer notifications, and a secure admin dashboard still need to be built.
- The seeded products are illustrative; replace them with accurate product descriptions, images, prices, stock, warranty and delivery terms before selling.
