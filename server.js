/**
 * 图片/视频轮播 — 全功能 API 服务器 (Node.js)
 * 零依赖，Node.js 内置模块即可运行。
 *
 * 用法：
 *   node server.js              # 默认端口 8080
 *   node server.js 3000         # 指定端口
 *   PORT=3000 node server.js    # 环境变量指定端口
 */

const http = require('http');
const fs   = require('fs');
const path = require('path');
const os   = require('os');

const PORT = parseInt(process.argv[2] || process.env.PORT || 8080, 10);
const ROOT = __dirname;
const DATA_FILE = path.join(ROOT, 'data.json');
const UPLOADS_DIR = path.join(ROOT, 'uploads');
const MAX_ITEMS = 20;

// ============================================================
//  工具函数
// ============================================================

function getLocalIP() {
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return null;
}

function readData() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8')); }
  catch { return { images: [], nextId: 1 }; }
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

function sendJSON(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(obj));
}

function getBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => resolve(body));
  });
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.webp': 'image/webp',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.mp4':  'video/mp4',
  '.webm': 'video/webm',
  '.mov':  'video/quicktime',
  '.avi':  'video/x-msvideo',
};

// ============================================================
//  路由处理器
// ============================================================

// GET  /api/images
function handleGetImages(req, res) {
  const data = readData();
  sendJSON(res, 200, data.images);
}

// POST  /api/upload  { name, data: "data:image/jpeg;base64,...", mediaType }
async function handleUpload(req, res) {
  const body = await getBody(req);
  let payload;
  try { payload = JSON.parse(body); } catch { return sendJSON(res, 400, { error: 'Invalid JSON' }); }

  if (!payload.data) return sendJSON(res, 400, { error: 'Missing data field' });

  const dataInfo = readData();
  if (dataInfo.images.length >= MAX_ITEMS) {
    return sendJSON(res, 400, { error: `Max ${MAX_ITEMS} items reached` });
  }

  // 解析 data URL
  const matches = payload.data.match(/^data:(image|video)\/[^;]+;base64,(.+)$/);
  if (!matches) return sendJSON(res, 400, { error: 'Invalid data URL format' });

  const mimeType = matches[1]; // 'image' or 'video'
  const base64 = matches[2];
  const buffer = Buffer.from(base64, 'base64');

  // 生成文件名
  const ext = payload.name ? path.extname(payload.name) : (mimeType === 'video' ? '.mp4' : '.jpg');
  const id = dataInfo.nextId;
  const safeName = `${id}_${Date.now()}${ext}`;
  const filePath = path.join(UPLOADS_DIR, safeName);

  fs.writeFileSync(filePath, buffer);

  const entry = {
    id,
    name: payload.name || 'untitled',
    mediaType: payload.mediaType || 'image',
    source: 'local',
    path: '/uploads/' + safeName,
    createdAt: Date.now()
  };

  dataInfo.images.push(entry);
  dataInfo.nextId = id + 1;
  writeData(dataInfo);

  sendJSON(res, 201, entry);
}

// POST  /api/urls  { urls: ["https://..."] }
async function handleAddUrls(req, res) {
  const body = await getBody(req);
  let payload;
  try { payload = JSON.parse(body); } catch { return sendJSON(res, 400, { error: 'Invalid JSON' }); }

  if (!payload.urls || !Array.isArray(payload.urls)) return sendJSON(res, 400, { error: 'Missing urls array' });

  const dataInfo = readData();
  const remaining = MAX_ITEMS - dataInfo.images.length;
  const urls = payload.urls.slice(0, remaining);

  const VIDEO_EXTS = /\.(mp4|webm|mov|mkv|avi|flv|wmv|m4v|ogv|3gp)(\?.*)?$/i;

  const added = [];
  urls.forEach(u => {
    if (!/^https?:\/\//.test(u)) return;
    let name = '';
    try { name = new URL(u).pathname.split('/').pop() || u; } catch { name = u; }
    const isVideo = VIDEO_EXTS.test(u);
    const entry = {
      id: dataInfo.nextId,
      name,
      mediaType: isVideo ? 'video' : 'image',
      source: 'remote',
      url: u,
      createdAt: Date.now()
    };
    added.push(entry);
    dataInfo.images.push(entry);
    dataInfo.nextId++;
  });

  writeData(dataInfo);
  sendJSON(res, 201, { added: added.length, entries: added });
}

// DELETE  /api/images/:id
function handleDeleteImage(req, res, id) {
  const dataInfo = readData();
  const idx = dataInfo.images.findIndex(img => img.id === id);
  if (idx === -1) return sendJSON(res, 404, { error: 'Not found' });

  const img = dataInfo.images[idx];

  // 删除本地文件
  if (img.source === 'local' && img.path) {
    const filePath = path.join(ROOT, img.path);
    try { fs.unlinkSync(filePath); } catch {}
  }

  dataInfo.images.splice(idx, 1);
  writeData(dataInfo);
  sendJSON(res, 200, { ok: true });
}

// DELETE  /api/images (全部清空)
function handleClearAll(req, res) {
  // 删除所有本地文件
  const dataInfo = readData();
  dataInfo.images.forEach(img => {
    if (img.source === 'local' && img.path) {
      try { fs.unlinkSync(path.join(ROOT, img.path)); } catch {}
    }
  });
  dataInfo.images = [];
  writeData(dataInfo);
  sendJSON(res, 200, { ok: true });
}

// 静态文件
function serveStatic(req, res, filePath) {
  const fullPath = path.join(ROOT, filePath === '/' ? '/index.html' : filePath);
  // 安全检查
  if (!fullPath.startsWith(ROOT)) { res.writeHead(403); return res.end('Forbidden'); }

  fs.readFile(fullPath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end('<h2>404</h2><p><a href="/">展示页</a> | <a href="/admin.html">管理页</a></p>');
    }
    const ext = path.extname(fullPath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

// ============================================================
//  主路由
// ============================================================

function handleRequest(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const pathname = url.pathname;

  // CORS 预检
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' });
    return res.end();
  }

  // API 路由
  if (req.method === 'GET' && pathname === '/api/images') return handleGetImages(req, res);

  if (req.method === 'POST' && pathname === '/api/upload') return handleUpload(req, res);
  if (req.method === 'POST' && pathname === '/api/urls')   return handleAddUrls(req, res);

  if (req.method === 'DELETE' && pathname === '/api/images') return handleClearAll(req, res);

  const delMatch = pathname.match(/^\/api\/images\/(\d+)$/);
  if (req.method === 'DELETE' && delMatch) return handleDeleteImage(req, res, parseInt(delMatch[1]));

  // 静态文件
  serveStatic(req, res, pathname);
}

const server = http.createServer(handleRequest);

server.listen(PORT, '0.0.0.0', () => {
  const localIP = getLocalIP();
  console.log('');
  console.log('='.repeat(56));
  console.log('  🖼️  图片/视频轮播 — API 服务器已启动 (Node.js)');
  console.log('='.repeat(56));
  console.log('');
  console.log('  📺 展示页:  http://localhost:' + PORT + '/');
  if (localIP) console.log('             http://' + localIP + ':' + PORT + '/');
  console.log('');
  console.log('  🔧 管理页:  http://localhost:' + PORT + '/admin.html');
  if (localIP) console.log('             http://' + localIP + ':' + PORT + '/admin.html');
  console.log('');
  console.log('  💡 不同设备打开相同网址即可看到相同内容');
  console.log('  🛑 按 Ctrl+C 停止');
  console.log('');
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error('\n❌ 端口 ' + PORT + ' 已被占用，请尝试：node server.js ' + (PORT + 1));
  } else {
    console.error(err);
  }
  process.exit(1);
});