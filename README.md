# JAVIRU Marketplace

A mobile-responsive marketplace storefront. This independent concept is not affiliated with Jumia.

## Supabase setup (no PostgreSQL connection string)

JAVIRU now uses **Supabase Auth + the Supabase REST API**. It does not require a database password, PostgreSQL URI, or service-role key.

### 1. Configure Supabase Auth
1. Open the [JAVIRU Supabase project](https://supabase.com/dashboard/project/vihbsfrwnslnmheowkhy).
2. In **Authentication → URL Configuration**, add `https://javiru-com.onrender.com` to the allowed redirect/site URLs.
3. If email confirmation is enabled, customers must confirm their email before signing in.

### 2. Create the orders table and security policies
1. Open **SQL Editor** in the Supabase dashboard.
2. Open the file `supabase/schema.sql` in this repository and copy all its SQL into a new query.
3. Run the query once. It creates `public.javiru_orders` and row-level security policies so signed-in customers can only read their own orders and can only insert orders under their own user ID.

### 3. Deploy on Render
The Render Blueprint sets these two environment variables:
- `SUPABASE_URL`: the Supabase project URL
- `SUPABASE_PUBLISHABLE_KEY`: the public publishable key

No `SUPABASE_DB_URL`, PostgreSQL password, `SESSION_SECRET`, or service-role key is required. Redeploy the service after applying the Blueprint/configuration changes.

Health check: `https://javiru-com.onrender.com/health`.

## Included
- Responsive marketplace layout, search, departments, product cards, cart and wishlist
- Supabase email/password authentication
- Customer orders stored in Supabase with row-level security
- Server-side validation of order items and prices against the starter catalogue
- Render health endpoint at `/health`

## Important limitations
- The starter product catalogue is currently hard-coded in the app; seller product publishing is not yet connected to a shared database.
- Checkout records orders as **Pay on delivery**. Online payment collection is not integrated.
- Real delivery tracking, seller registration/approval, seller payouts, refunds, customer notifications and a secure admin dashboard still need to be built.
- The seeded products are illustrative; verify product descriptions, prices, stock, warranty and delivery terms before selling.
- The publishable key is intended for client-side use; security comes from Supabase Auth and row-level security. Never put a Supabase secret/service-role key in the browser or commit it to GitHub.
