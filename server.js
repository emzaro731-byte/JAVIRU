const express = require('express');
const path = require('path');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const SUPABASE_URL = String(process.env.SUPABASE_URL || 'https://vihbsfrwnslnmheowkhy.supabase.co').replace(/\/$/, '');
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_HIMGxb-O6fj9O7OzT4ukuQ_jm5W8mWz';
const JAVIRU_ADMIN_EMAIL = 'jamesbishopemmanuel@gmail.com';
const JUMIA_SEARCH_API_URL = String(process.env.JUMIA_SEARCH_API_URL || '').trim();
const JUMIA_API_KEY = String(process.env.JUMIA_API_KEY || '').trim();

app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));
app.use((req, res, next) => {
  if (['/server.js', '/package.json', '/render.yaml', '/README.md'].includes(req.path)) return res.sendStatus(404);
  next();
});
app.get('/supabase-config.js', (_req, res) => {
  res.type('application/javascript').set('Cache-Control', 'no-store').send(
    'window.JAVIRU_SUPABASE_CONFIG=' + JSON.stringify({ url: SUPABASE_URL, key: SUPABASE_PUBLISHABLE_KEY }) + ';'
  );
});
app.get('/', (_req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.use(express.static(__dirname, { index: false, dotfiles: 'deny' }));

const publicProducts = [];

function bearer(req) {
  const value = String(req.headers.authorization || '');
  return value.startsWith('Bearer ') ? value.slice(7) : '';
}
async function supabaseFetch(resource, token, options = {}) {
  const response = await fetch(SUPABASE_URL + resource, {
    ...options,
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: 'Bearer ' + (token || SUPABASE_PUBLISHABLE_KEY),
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const raw = await response.text();
  let data = null;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = { message: raw }; }
  if (!response.ok) {
    const err = new Error(data?.message || data?.msg || data?.error_description || data?.hint || 'Supabase request failed.');
    err.status = response.status;
    throw err;
  }
  return data;
}
async function requireSupabaseUser(req, res, next) {
  const token = bearer(req);
  if (!token) return res.status(401).json({ error:'Please sign in to continue.' });
  try {
    const user = await supabaseFetch('/auth/v1/user', token);
    if (!user?.id) return res.status(401).json({ error:'Please sign in again.' });
    req.supabaseToken = token;
    req.authUser = user;
    next();
  } catch (err) {
    return res.status(err.status === 401 ? 401 : 503).json({ error: err.status === 401 ? 'Your session expired. Please sign in again.' : 'Could not verify your Supabase session. Check the Supabase configuration.' });
  }
}
app.get('/health', async (_req, res) => {
  try {
    const response = await fetch(SUPABASE_URL + '/auth/v1/health', { headers: { apikey: SUPABASE_PUBLISHABLE_KEY } });
    if (!response.ok) throw new Error('Supabase health check failed');
    res.json({ ok:true, service:'javiru-marketplace', database:'supabase-configured', auth:'reachable' });
  } catch (_err) {
    res.status(503).json({ ok:false, service:'javiru-marketplace', database:'unreachable', hint:'Check SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY in Render.' });
  }
});
async function requireProductAdmin(req, res, next) {
  const token = bearer(req);
  if (!token) return res.status(401).json({ error:'Please sign in with the JAVIRU administrator account.' });
  try {
    const user = await supabaseFetch('/auth/v1/user', token);
    if (!user?.id) return res.status(401).json({ error:'Please sign in again.' });
    if (String(user.email || '').toLowerCase() !== JAVIRU_ADMIN_EMAIL) return res.status(403).json({ error:'Product importing is restricted to the JAVIRU administrator account.' });
    req.supabaseToken = token;
    req.authUser = user;
    next();
  } catch (err) {
    return res.status(err.status === 401 ? 401 : 503).json({ error:'Could not verify your Supabase session.' });
  }
}
app.get('/api/products', async (_req, res) => {
  try {
    const rows = await supabaseFetch('/rest/v1/javiru_products?select=id,name,category,price,old_price,emoji,bg,tag,rating,stock,description,source_url,source_name,image_url&active=eq.true&order=created_at.desc', '');
    if (Array.isArray(rows) && rows.length) {
      return res.json(rows.map(p => ({ id:1000000 + Number(p.id), name:p.name, cat:p.category, price:Number(p.price), old:Number(p.old_price || p.price), emoji:p.emoji || '📦', bg:p.bg || '#f0f2ec', tag:p.tag || 'IMPORTED', rating:Number(p.rating || 0), stock:Number(p.stock || 0), description:p.description || '', source_url:p.source_url || '', source_name:p.source_name || 'JAVIRU', image:p.image_url || '' })));
    }
  } catch (err) {
    console.warn('Imported product catalogue unavailable:', err.status || '', err.message);
  }
  res.json([]);
});

// Search the user's configured Jumia product-search API. Keep supplier API credentials on the server.
app.get('/api/admin/jumia-search', requireProductAdmin, async (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 120);
  if (!q) return res.status(400).json({ error: 'Enter a product to search for.' });
  if (!JUMIA_SEARCH_API_URL) return res.status(503).json({ error: 'Set JUMIA_SEARCH_API_URL in Render to your existing live Jumia search API endpoint.' });
  try {
    const url = new URL(JUMIA_SEARCH_API_URL);
    url.searchParams.set('q', q);
    if (!url.searchParams.has('search')) url.searchParams.set('search', q);
    const headers = { Accept: 'application/json' };
    if (JUMIA_API_KEY) headers.Authorization = 'Bearer ' + JUMIA_API_KEY;
    const upstream = await fetch(url, { headers, signal: AbortSignal.timeout(20000) });
    const raw = await upstream.text();
    let payload;
    try { payload = JSON.parse(raw); } catch { throw new Error('Jumia search API did not return JSON.'); }
    if (!upstream.ok) return res.status(502).json({ error: 'Jumia search API returned HTTP ' + upstream.status + '.' });
    const candidates = Array.isArray(payload) ? payload : (payload?.data?.results || payload?.results || payload?.data?.products || payload?.products || payload?.data?.items || payload?.items || []);
    const results = candidates.slice(0, 40).map((p, i) => {
      const price = Number(p.price ?? p.price_min ?? p.sale_price ?? p.final_price);
      const old = Number(p.price_before_discount ?? p.original_price ?? p.old_price ?? price);
      return {
        product_id: String(p.product_id ?? p.sku ?? p.id ?? p.jumia_id ?? ''),
        name: String(p.name ?? p.title ?? p.product_name ?? '').slice(0, 180),
        brand: String(p.brand ?? ''),
        category: String(p.category ?? p.category_name ?? 'Electronics'),
        price, old_price: Number.isFinite(old) && old >= price ? old : price,
        rating: Number(p.rating ?? p.search_index_rating ?? 0),
        image_url: String(p.image_url ?? p.image ?? p.thumbnail ?? p.product_image ?? ''),
        source_url: String(p.product_url ?? p.url ?? p.link ?? p.product_link ?? ''),
        description: String(p.description ?? p.name ?? p.title ?? '').slice(0, 3000),
        stock: p.buyable === false || p.in_stock === false ? 0 : 1,
        emoji: '📦'
      };
    }).filter(p => p.name && Number.isFinite(p.price) && p.price > 0 && /^https?:$/.test((()=>{try{return new URL(p.image_url).protocol}catch{return ''}})()));
    res.json({ results, count: results.length });
  } catch (err) {
    console.error('Jumia search failed:', err.message);
    res.status(502).json({ error: err.name === 'TimeoutError' ? 'Jumia search timed out. Try again.' : (err.message || 'Could not search Jumia.') });
  }
});
app.post('/api/admin/products', requireProductAdmin, async (req, res) => {
  const body = req.body || {};
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const category = typeof body.category === 'string' ? body.category.trim() : '';
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  const sourceUrl = typeof body.source_url === 'string' ? body.source_url.trim() : '';
  const imageUrl = typeof body.image_url === 'string' ? body.image_url.trim() : '';
  const supplierProductId = typeof body.product_id === 'string' ? body.product_id.trim().slice(0,180) : '';
  const price = Number(body.price), oldPrice = Number(body.old_price || body.price), stock = Number(body.stock || 0);
  if (!name || name.length > 180 || !category || category.length > 80 || !description || description.length > 3000 || !Number.isFinite(price) || price <= 0 || !Number.isFinite(oldPrice) || oldPrice < price || !Number.isInteger(stock) || stock < 0 || stock > 100000) {
    return res.status(400).json({ error:'Enter a product name, category, description, valid price, old price and stock.' });
  }
  if (sourceUrl) {
    try { const u = new URL(sourceUrl); const host = u.hostname.toLowerCase(); if (!['http:', 'https:'].includes(u.protocol) || !['jumia.com.ng','www.jumia.com.ng','jumia.com','www.jumia.com'].includes(host)) throw new Error(); }
    catch { return res.status(400).json({ error:'Enter a valid Jumia product URL, or leave the source URL blank.' }); }
  }
  const row = { name, category, description, price, old_price:oldPrice, stock, source_url:sourceUrl || null, source_name:sourceUrl ? 'Jumia' : 'JAVIRU', image_url:imageUrl || null, supplier_product_id:supplierProductId || null, emoji:typeof body.emoji === 'string' ? body.emoji.slice(0,12) : '📦', bg:'#f0f2ec', tag:'IMPORTED', active:true, created_by:req.authUser.id };
  try {
    const created = await supabaseFetch('/rest/v1/javiru_products?on_conflict=supplier_product_id&select=id,name,category,price,old_price,emoji,bg,tag,rating,stock,description,source_url,source_name,image_url', req.supabaseToken, { method:'POST', headers:{ Prefer:'resolution=merge-duplicates,return=representation' }, body:JSON.stringify(row) });
    const p = Array.isArray(created) ? created[0] : created;
    res.status(201).json({ product:{ id:1000000 + Number(p.id), name:p.name, cat:p.category, price:Number(p.price), old:Number(p.old_price || p.price), emoji:p.emoji || '📦', bg:p.bg || '#f0f2ec', tag:p.tag || 'IMPORTED', rating:Number(p.rating || 4.5), stock:Number(p.stock || 0), description:p.description || '', source_url:p.source_url || '', source_name:p.source_name || 'JAVIRU', image:p.image_url || '' } });
  } catch (err) {
    console.error('Product import failed:', err.status || '', err.message);
    res.status(err.status === 401 ? 401 : err.status === 403 ? 403 : 503).json({ error:'Could not save product. Apply supabase/products.sql and confirm your administrator role is enabled.' });
  }
});
app.get('/api/auth/me', async (req, res) => {
  const token = bearer(req);
  if (!token) return res.json({ user:null });
  try {
    const user = await supabaseFetch('/auth/v1/user', token);
    res.json({ user: user ? { id:user.id, email:user.email, name:user.user_metadata?.full_name || user.user_metadata?.name || user.email, phone:user.phone || '', isProductAdmin:String(user.email || '').toLowerCase() === JAVIRU_ADMIN_EMAIL } : null });
  } catch (_err) { res.json({ user:null }); }
});
app.get('/api/orders', requireSupabaseUser, async (req, res) => {
  try {
    const rows = await supabaseFetch('/rest/v1/javiru_orders?select=id,reference,full_name,phone,email,address,state,payment_method,status,total,items,created_at&order=created_at.desc&limit=100', req.supabaseToken);
    res.json((rows || []).map(o => ({ ...o, date:new Date(o.created_at).toLocaleString('en-NG') })));
  } catch (err) {
    console.error('Supabase orders read failed:', err.status || '', err.message);
    res.status(err.status === 401 ? 401 : 503).json({ error:'Could not load orders. Confirm the JAVIRU Supabase SQL setup has been run.' });
  }
});
app.post('/api/orders', requireSupabaseUser, async (req, res) => {
  const { items, fullName, phone, email, address, state, paymentMethod } = req.body || {};
  if (!Array.isArray(items) || !items.length || items.length > 50) return res.status(400).json({ error:'Your cart is empty or too large.' });
  if (![fullName,phone,email,address,state].every(v => typeof v === 'string' && v.trim()) || address.length > 1000) return res.status(400).json({ error:'Complete all delivery details.' });
  const allowedStates = ['Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno','Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu','FCT Abuja','Gombe','Imo','Jigawa','Kaduna','Kano','Katsina','Kebbi','Kogi','Kwara','Lagos','Nasarawa','Niger','Ogun','Ondo','Osun','Oyo','Plateau','Rivers','Sokoto','Taraba','Yobe','Zamfara'];
  if (!allowedStates.includes(state)) return res.status(400).json({ error:'Choose a valid Nigerian state.' });
  const quantities = new Map();
  for (const item of items) {
    const id = Number(item.id), qty = Number(item.qty);
    if (!Number.isSafeInteger(id) || !Number.isInteger(qty) || qty < 1 || qty > 99) return res.status(400).json({ error:'Invalid item quantity.' });
    quantities.set(id, (quantities.get(id) || 0) + qty);
  }
  const lines = [];
  for (const [id, qty] of quantities) {
    let product = publicProducts.find(p => p.id === id);
    if (!product && id >= 1000000) {
      try {
        const imported = await supabaseFetch('/rest/v1/javiru_products?select=id,name,price,stock,active&id=eq.' + encodeURIComponent(id - 1000000) + '&active=eq.true&limit=1', req.supabaseToken);
        if (Array.isArray(imported) && imported[0]) {
          const p = imported[0];
          product = { id:1000000 + Number(p.id), name:p.name, price:Number(p.price), stock:Number(p.stock || 0) };
        }
      } catch (_err) {}
    }
    if (!product || qty > 99 || Number(product.stock ?? 0) < qty) return res.status(400).json({ error:'One or more products are unavailable or out of stock.' });
    lines.push({ id:product.id, name:product.name, price:product.price, qty });
  }
  const total = lines.reduce((sum, item) => sum + item.price * item.qty, 0);
  const reference = 'JVR-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2,7).toUpperCase();
  const row = {
    user_id:req.authUser.id, reference, full_name:fullName.trim(), phone:phone.trim(),
    email:email.trim(), address:address.trim(), state,
    payment_method:paymentMethod === 'Online payment' ? 'Online payment (not enabled)' : 'Pay on delivery',
    status:'Pending', total, items:lines
  };
  try {
    const created = await supabaseFetch('/rest/v1/javiru_orders?select=*', req.supabaseToken, {
      method:'POST', headers:{ Prefer:'return=representation' }, body:JSON.stringify(row)
    });
    const order = Array.isArray(created) ? created[0] : created;
    res.status(201).json({ order:{ ...order, id:order.reference, date:new Date(order.created_at).toLocaleString('en-NG') } });
  } catch (err) {
    console.error('Supabase order insert failed:', err.status || '', err.message);
    res.status(err.status === 401 ? 401 : 503).json({ error:'Could not save your order. Check that the JAVIRU Supabase SQL setup has been run.' });
  }
});
app.listen(PORT, () => console.log('JAVIRU listening on port ' + PORT));
