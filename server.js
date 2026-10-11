const express = require('express');
const path = require('path');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const SUPABASE_URL = String(process.env.SUPABASE_URL || 'https://vihbsfrwnslnmheowkhy.supabase.co').replace(/\/$/, '');
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_HIMGxb-O6fj9O7OzT4ukuQ_jm5W8mWz';

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

const seed = [
  [1,'Infinix-Style Android Smartphone 128GB','Phones & Tablets',149900,179900,'📱','#e4eaf4','HOT DEAL'],
  [2,'Wireless Noise-Cancelling Headphones','Electronics',28500,35000,'🎧','#e7eaf4','BESTSELLER'],
  [3,'50000mAh Fast-Charge Power Bank','Phones & Tablets',32000,39000,'🔋','#ece8e2','POPULAR'],
  [4,'Smart Watch with Fitness Tracker','Electronics',22000,28000,'⌚','#e8eee7','TRENDING'],
  [5,'Everyday Sneakers','Fashion',27000,33000,'👟','#e8e8ed','NEW'],
  [6,'Minimal Everyday Backpack','Fashion',18500,24000,'🎒','#eee5da','GOOD FIND'],
  [7,'Portable Bluetooth Speaker','Electronics',16000,20000,'🔊','#e1ecec','TOP PICK'],
  [8,'Insulated Travel Bottle','Home & Living',8500,11000,'🧴','#e9efdc','VALUE'],
  [9,'Soft Glow Table Lamp','Home & Living',14500,18000,'💡','#f1e6d8','COZY PICK'],
  [10,'Skincare Essentials Set','Beauty',12500,16000,'✨','#f2e3e8','SELF CARE'],
  [11,'Compact Home Blender','Home & Living',24500,30000,'🥤','#e6ede6','KITCHEN'],
  [12,'Phone Tripod & Creator Kit','Electronics',13500,17000,'📷','#e5e9f1','CREATOR FAV'],
  [13,'Laptop for Work and Study','Computing',389000,429000,'💻','#e4eaf0','TOP PICK'],
  [14,'Wireless Keyboard and Mouse','Computing',18500,23000,'⌨️','#e8e9ee','DEAL'],
  [15,'Casual Crossbody Bag','Fashion',15500,19500,'👜','#eee5df','STYLE PICK'],
  [16,'Kids Learning Toy Set','Baby & Kids',12000,15000,'🧸','#f2e5d9','FAMILY'],
  [17,'Pantry Essentials Bundle','Groceries',9500,11500,'🛍️','#e5eddb','DAILY NEED'],
  [18,'Rechargeable Standing Fan','Home & Living',58000,68000,'🌀','#e3ebef','POPULAR'],
  [19,'Men’s Everyday Polo Shirt','Fashion',9500,12500,'👕','#e8e6df','EVERYDAY'],
  [20,'Home Security Camera','Electronics',27500,34000,'📹','#e2e8e8','SMART HOME']
];
const publicProducts = seed.map(p => ({ id:p[0], name:p[1], cat:p[2], price:p[3], old:p[4], emoji:p[5], bg:p[6], tag:p[7], rating:4.5, stock:25, description:'A useful everyday pick from JAVIRU. Confirm specifications and availability before purchase.' }));

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
    if (user.app_metadata?.javiru_product_admin !== true) return res.status(403).json({ error:'Product importing is restricted to the JAVIRU administrator.' });
    req.supabaseToken = token;
    req.authUser = user;
    next();
  } catch (err) {
    return res.status(err.status === 401 ? 401 : 503).json({ error:'Could not verify your Supabase session.' });
  }
}
app.get('/api/products', async (_req, res) => {
  try {
    const rows = await supabaseFetch('/rest/v1/javiru_products?select=id,name,category,price,old_price,emoji,bg,tag,rating,stock,description,source_url,source_name&active=eq.true&order=created_at.desc', '');
    if (Array.isArray(rows) && rows.length) {
      return res.json(rows.map(p => ({ id:Number(p.id), name:p.name, cat:p.category, price:Number(p.price), old:Number(p.old_price || p.price), emoji:p.emoji || '📦', bg:p.bg || '#f0f2ec', tag:p.tag || 'IMPORTED', rating:Number(p.rating || 4.5), stock:Number(p.stock || 0), description:p.description || '', source_url:p.source_url || '', source_name:p.source_name || 'JAVIRU' })));
    }
  } catch (err) {
    console.warn('Imported product catalogue unavailable; using seed products:', err.status || '', err.message);
  }
  res.json(publicProducts);
});
app.post('/api/admin/products', requireProductAdmin, async (req, res) => {
  const body = req.body || {};
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const category = typeof body.category === 'string' ? body.category.trim() : '';
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  const sourceUrl = typeof body.source_url === 'string' ? body.source_url.trim() : '';
  const price = Number(body.price), oldPrice = Number(body.old_price || body.price), stock = Number(body.stock || 0);
  if (!name || name.length > 180 || !category || category.length > 80 || !description || description.length > 3000 || !Number.isFinite(price) || price <= 0 || !Number.isFinite(oldPrice) || oldPrice < price || !Number.isInteger(stock) || stock < 0 || stock > 100000) {
    return res.status(400).json({ error:'Enter a product name, category, description, valid price, old price and stock.' });
  }
  if (sourceUrl) {
    try { const u = new URL(sourceUrl); if (!['http:', 'https:'].includes(u.protocol) || !/(^|\\.)jumia\\./i.test(u.hostname)) throw new Error(); }
    catch { return res.status(400).json({ error:'Enter a valid Jumia product URL, or leave the source URL blank.' }); }
  }
  const row = { name, category, description, price, old_price:oldPrice, stock, source_url:sourceUrl || null, source_name:sourceUrl ? 'Jumia' : 'JAVIRU', emoji:typeof body.emoji === 'string' ? body.emoji.slice(0,12) : '📦', bg:'#f0f2ec', tag:'IMPORTED', active:true, created_by:req.authUser.id };
  try {
    const created = await supabaseFetch('/rest/v1/javiru_products?select=id,name,category,price,old_price,emoji,bg,tag,rating,stock,description,source_url,source_name', req.supabaseToken, { method:'POST', headers:{ Prefer:'return=representation' }, body:JSON.stringify(row) });
    const p = Array.isArray(created) ? created[0] : created;
    res.status(201).json({ product:{ id:Number(p.id), name:p.name, cat:p.category, price:Number(p.price), old:Number(p.old_price || p.price), emoji:p.emoji || '📦', bg:p.bg || '#f0f2ec', tag:p.tag || 'IMPORTED', rating:Number(p.rating || 4.5), stock:Number(p.stock || 0), description:p.description || '', source_url:p.source_url || '', source_name:p.source_name || 'JAVIRU' } });
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
    res.json({ user: user ? { id:user.id, email:user.email, name:user.user_metadata?.full_name || user.user_metadata?.name || user.email, phone:user.phone || '' } : null });
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
    const product = publicProducts.find(p => p.id === id);
    if (!product || qty > 99) return res.status(400).json({ error:'One or more products are unavailable.' });
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
