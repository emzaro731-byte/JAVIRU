const express = require('express');
const path = require('path');
const crypto = require('crypto');
const { Pool } = require('pg');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
if (!process.env.SESSION_SECRET) console.warn('SESSION_SECRET is not set; sessions will reset when the server restarts.');
const pool = process.env.DATABASE_URL ? new Pool({
  connectionString: process.env.DATABASE_URL,
  ...(process.env.PGSSL === 'true' ? { ssl: { rejectUnauthorized: false } } : {})
}) : null;

app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));
app.use((req,res,next)=>{
  if(['/server.js','/package.json','/render.yaml','/README.md'].includes(req.path)) return res.sendStatus(404);
  next();
});
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

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return salt + ':' + hash;
}
function verifyPassword(password, stored) {
  const [salt, hash] = String(stored || '').split(':');
  if (!salt || !hash) return false;
  const actual = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}
function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(body).digest('base64url');
  return body + '.' + sig;
}
function readSession(req) {
  const raw = String(req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith('javiru_session='));
  if (!raw) return null;
  const token = decodeURIComponent(raw.slice('javiru_session='.length));
  const [body, signature] = token.split('.');
  if (!body || !signature) return null;
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(body).digest();
  let supplied;
  try { supplied = Buffer.from(signature, 'base64url'); } catch { return null; }
  if (expected.length !== supplied.length || !crypto.timingSafeEqual(expected, supplied)) return null;
  try {
    const data = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (!data.uid || data.exp < Date.now()) return null;
    return data;
  } catch { return null; }
}
async function requireUser(req, res, next) {
  if (!pool) return res.status(503).json({ error: 'Database is not configured. Add DATABASE_URL in Render.' });
  const session = readSession(req);
  if (!session) return res.status(401).json({ error: 'Please sign in to continue.' });
  try {
    const { rows } = await pool.query('SELECT id,name,email,phone,created_at FROM users WHERE id=$1', [session.uid]);
    if (!rows[0]) return res.status(401).json({ error: 'Please sign in again.' });
    req.user = rows[0];
    next();
  } catch (err) { console.error(err); res.status(500).json({ error: 'Could not verify your account.' }); }
}
function setSession(res, userId) {
  const token = sign({ uid: userId, exp: Date.now() + 1000 * 60 * 60 * 24 * 7 });
  res.setHeader('Set-Cookie', 'javiru_session=' + encodeURIComponent(token) + '; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800');
}
function clearSession(res) {
  res.setHeader('Set-Cookie', 'javiru_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0');
}
function publicProduct(row) {
  return { id:Number(row.id), name:row.name, cat:row.category, price:Number(row.price), old:Number(row.old_price), emoji:row.emoji, bg:row.bg, tag:row.tag, rating:Number(row.rating), stock:Number(row.stock), description:row.description || '' };
}
async function initDb() {
  if (!pool) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGSERIAL PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
      phone TEXT NOT NULL DEFAULT '', password_hash TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS products (
      id BIGINT PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL, price NUMERIC(12,2) NOT NULL CHECK(price >= 0),
      old_price NUMERIC(12,2) NOT NULL DEFAULT 0, emoji TEXT NOT NULL DEFAULT '📦', bg TEXT NOT NULL DEFAULT '#f0f2ec',
      tag TEXT NOT NULL DEFAULT 'JAVIRU PICK', rating NUMERIC(2,1) NOT NULL DEFAULT 4.5,
      stock INTEGER NOT NULL DEFAULT 0 CHECK(stock >= 0), description TEXT NOT NULL DEFAULT '', active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS orders (
      id BIGSERIAL PRIMARY KEY, reference TEXT NOT NULL UNIQUE, user_id BIGINT NOT NULL REFERENCES users(id),
      full_name TEXT NOT NULL, phone TEXT NOT NULL, email TEXT NOT NULL, address TEXT NOT NULL, state TEXT NOT NULL,
      payment_method TEXT NOT NULL DEFAULT 'Pay on delivery', status TEXT NOT NULL DEFAULT 'Pending',
      total NUMERIC(12,2) NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS order_items (
      id BIGSERIAL PRIMARY KEY, order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id BIGINT NOT NULL REFERENCES products(id), product_name TEXT NOT NULL, unit_price NUMERIC(12,2) NOT NULL,
      quantity INTEGER NOT NULL CHECK(quantity > 0)
    );
  `);
  for (const p of seed) {
    await pool.query(`INSERT INTO products(id,name,category,price,old_price,emoji,bg,tag,rating,stock,description)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,4.5,25,$9) ON CONFLICT(id) DO NOTHING`,
      [...p.slice(0,8), 'A useful everyday pick from JAVIRU. Please confirm specifications, availability and warranty before purchase.']);
  }
  console.log('JAVIRU database ready');
}
app.get('/health', async (_req, res) => {
  try {
    if (pool) await pool.query('SELECT 1');
    res.json({ ok:true, service:'javiru-marketplace', database:pool ? 'connected' : 'not_configured' });
  } catch (err) { res.status(503).json({ ok:false, service:'javiru-marketplace', database:'error' }); }
});
app.get('/api/products', async (_req, res) => {
  if (!pool) return res.json(seed.map(p=>({id:p[0],name:p[1],cat:p[2],price:p[3],old:p[4],emoji:p[5],bg:p[6],tag:p[7],rating:4.5,stock:25,description:''})));
  try {
    const { rows } = await pool.query('SELECT * FROM products WHERE active=TRUE ORDER BY id');
    res.json(rows.map(publicProduct));
  } catch (err) { console.error(err); res.status(500).json({error:'Could not load products.'}); }
});
app.get('/api/auth/me', async (req, res) => {
  if (!pool) return res.status(503).json({error:'Database is not configured.'});
  const session = readSession(req);
  if (!session) return res.json({user:null});
  try {
    const { rows } = await pool.query('SELECT id,name,email,phone FROM users WHERE id=$1', [session.uid]);
    res.json({user:rows[0] || null});
  } catch (err) { console.error(err); res.status(500).json({error:'Could not load account.'}); }
});
app.post('/api/auth/register', async (req, res) => {
  if (!pool) return res.status(503).json({error:'Database is not configured. Add DATABASE_URL in Render.'});
  const name=String(req.body.name||'').trim(), email=String(req.body.email||'').trim().toLowerCase(), phone=String(req.body.phone||'').trim(), password=String(req.body.password||'');
  if (name.length<2 || name.length>100) return res.status(400).json({error:'Enter your full name.'});
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length>254) return res.status(400).json({error:'Enter a valid email address.'});
  if (password.length<8 || password.length>200) return res.status(400).json({error:'Password must be at least 8 characters.'});
  if (phone.length>40) return res.status(400).json({error:'Phone number is too long.'});
  try {
    const { rows } = await pool.query('INSERT INTO users(name,email,phone,password_hash) VALUES($1,$2,$3,$4) RETURNING id,name,email,phone', [name,email,phone,hashPassword(password)]);
    setSession(res, rows[0].id);
    res.status(201).json({user:rows[0]});
  } catch (err) {
    if (err.code==='23505') return res.status(409).json({error:'An account with this email already exists. Sign in instead.'});
    console.error(err); res.status(500).json({error:'Could not create account.'});
  }
});
app.post('/api/auth/login', async (req, res) => {
  if (!pool) return res.status(503).json({error:'Database is not configured. Add DATABASE_URL in Render.'});
  const email=String(req.body.email||'').trim().toLowerCase(), password=String(req.body.password||'');
  try {
    const { rows } = await pool.query('SELECT id,name,email,phone,password_hash FROM users WHERE email=$1', [email]);
    const row=rows[0];
    if (!row || !verifyPassword(password,row.password_hash)) return res.status(401).json({error:'Email or password is incorrect.'});
    setSession(res,row.id);
    delete row.password_hash;
    res.json({user:row});
  } catch (err) { console.error(err); res.status(500).json({error:'Could not sign in.'}); }
});
app.post('/api/auth/logout', (_req,res) => { clearSession(res); res.json({ok:true}); });
app.get('/api/orders', requireUser, async (req,res) => {
  try {
    const { rows } = await pool.query(`
      SELECT o.id,o.reference,o.full_name,o.phone,o.email,o.address,o.state,o.payment_method,o.status,o.total,o.created_at,
        COALESCE(json_agg(json_build_object('name',i.product_name,'price',i.unit_price,'qty',i.quantity)) FILTER (WHERE i.id IS NOT NULL),'[]') AS items
      FROM orders o LEFT JOIN order_items i ON i.order_id=o.id WHERE o.user_id=$1
      GROUP BY o.id ORDER BY o.created_at DESC LIMIT 100
    `, [req.user.id]);
    res.json(rows.map(o=>({...o,total:Number(o.total),date:new Date(o.created_at).toLocaleString('en-NG'),id:o.reference,items:o.items})));
  } catch(err) { console.error(err); res.status(500).json({error:'Could not load orders.'}); }
});
app.post('/api/orders', requireUser, async (req,res) => {
  const {items,fullName,phone,email,address,state,paymentMethod}=req.body||{};
  if (!Array.isArray(items)||!items.length||items.length>50) return res.status(400).json({error:'Your cart is empty or too large.'});
  if (![fullName,phone,email,address,state].every(v=>typeof v==='string'&&v.trim()) || address.length>1000) return res.status(400).json({error:'Complete all delivery details.'});
  const allowedStates=['Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno','Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu','FCT Abuja','Gombe','Imo','Jigawa','Kaduna','Kano','Katsina','Kebbi','Kogi','Kwara','Lagos','Nasarawa','Niger','Ogun','Ondo','Osun','Oyo','Plateau','Rivers','Sokoto','Taraba','Yobe','Zamfara'];
  if (!allowedStates.includes(state)) return res.status(400).json({error:'Choose a valid Nigerian state.'});
  const cleanItems=[];
  for (const it of items) {
    const id=Number(it.id), qty=Number(it.qty);
    if (!Number.isSafeInteger(id)||!Number.isInteger(qty)||qty<1||qty>99) return res.status(400).json({error:'Invalid item quantity.'});
    const existing=cleanItems.find(x=>x.id===id); if(existing) existing.qty+=qty; else cleanItems.push({id,qty});
  }
  const client=await pool.connect();
  try {
    await client.query('BEGIN');
    const ids=cleanItems.map(x=>x.id);
    const {rows:products}=await client.query('SELECT * FROM products WHERE id=ANY($1::bigint[]) AND active=TRUE FOR UPDATE',[ids]);
    if(products.length!==ids.length) throw Object.assign(new Error('One or more products are no longer available.'),{status:400});
    let total=0;
    for(const it of cleanItems){const p=products.find(x=>Number(x.id)===it.id);if(!p||Number(p.stock)<it.qty)throw Object.assign(new Error('Not enough stock for '+(p?.name||'an item')+'.'),{status:409});total+=Number(p.price)*it.qty;}
    const reference='JVR-'+crypto.randomBytes(4).toString('hex').toUpperCase();
    const {rows:orderRows}=await client.query(`INSERT INTO orders(reference,user_id,full_name,phone,email,address,state,payment_method,total)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id,reference,status,total,created_at`,
      [reference,req.user.id,fullName.trim(),phone.trim(),email.trim().toLowerCase(),address.trim(),state,paymentMethod==='Online payment'?'Online payment (not enabled)':'Pay on delivery',total]);
    const order=orderRows[0];
    for(const it of cleanItems){
      const p=products.find(x=>Number(x.id)===it.id);
      await client.query('INSERT INTO order_items(order_id,product_id,product_name,unit_price,quantity) VALUES($1,$2,$3,$4,$5)',[order.id,p.id,p.name,p.price,it.qty]);
      await client.query('UPDATE products SET stock=stock-$1 WHERE id=$2',[it.qty,p.id]);
    }
    await client.query('COMMIT');
    res.status(201).json({order:{id:order.reference,reference:order.reference,status:order.status,total:Number(order.total),date:new Date(order.created_at).toLocaleString('en-NG')}});
  } catch(err) {
    await client.query('ROLLBACK').catch(()=>{});
    if(err.status)return res.status(err.status).json({error:err.message});
    console.error(err);res.status(500).json({error:'Could not save your order.'});
  } finally {client.release();}
});
app.get('*', (req,res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({error:'API route not found.'});
  res.sendFile(path.join(__dirname,'index.html'));
});
initDb().catch(err=>{console.error('Database initialization failed:',err.message);}).finally(()=>{
  app.listen(PORT,'0.0.0.0',()=>console.log('JAVIRU listening on port '+PORT));
});
