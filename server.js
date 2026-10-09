const http = require('http');
const fs = require('fs');
const path = require('path');
const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const TYPES = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon'};
http.createServer((req,res)=>{
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  if (urlPath === '/health' || urlPath === '/healthz') {
    res.writeHead(200, {'Content-Type':'application/json; charset=utf-8'});
    return res.end(JSON.stringify({ok:true,service:'javiru-marketplace'}));
  }
  let requested = urlPath === '/' ? '/index.html' : urlPath;
  let file = path.resolve(ROOT, '.' + requested);
  if (!file.startsWith(ROOT + path.sep) && file !== path.join(ROOT,'index.html')) {
    res.writeHead(403, {'Content-Type':'text/plain; charset=utf-8'}); return res.end('Forbidden');
  }
  fs.stat(file,(err,stat)=>{
    if (err || !stat.isFile()) {
      res.writeHead(404, {'Content-Type':'text/plain; charset=utf-8'}); return res.end('Not found');
    }
    res.writeHead(200, {'Content-Type':TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream','X-Content-Type-Options':'nosniff'});
    fs.createReadStream(file).pipe(res);
  });
}).listen(PORT,'0.0.0.0',()=>console.log('JAVIRU listening on port '+PORT));
