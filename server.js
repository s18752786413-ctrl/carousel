/**
 * 图片轮播展示 — 一键启动服务器（Node.js 版）
 * 零依赖，Node.js 内置模块即可运行。
 *
 * 用法：
 *   node server.js              # 默认端口 8080
 *   node server.js 3000         # 指定端口
 *   PORT=3000 node server.js    # 环境变量指定端口
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = parseInt(process.argv[2] || process.env.PORT || 8080, 10);
const ROOT = __dirname;

// 获取本机局域网 IP
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return null;
}

const localIP = getLocalIP();

// MIME 类型
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
};

const server = http.createServer((req, res) => {
  // 解析 URL，去掉查询参数
  let urlPath = req.url.split('?')[0];
  // 默认首页
  if (urlPath === '/') urlPath = '/index.html';

  const filePath = path.join(ROOT, urlPath);

  // 安全检查：防止目录穿越
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<h2>404 - 页面未找到</h2><p><a href="/">返回展示页</a> | <a href="/admin.html">管理页</a></p>');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const mime = MIME[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime });
    res.end(data);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log();
  console.log('='.repeat(56));
  console.log('  🖼️  图片轮播展示 — 服务器已启动 (Node.js)');
  console.log('='.repeat(56));
  console.log();
  console.log('  📺 展示页（轮播观看）：');
  console.log(`     http://localhost:${PORT}/`);
  if (localIP) console.log(`     http://${localIP}:${PORT}/`);
  console.log();
  console.log('  🔧 管理页（上传图片）：');
  console.log(`     http://localhost:${PORT}/admin.html`);
  if (localIP) console.log(`     http://${localIP}:${PORT}/admin.html`);
  console.log();
  console.log('  💡 手机/平板连同一 WiFi，打开上面局域网地址即可');
  console.log('  🛑 按 Ctrl+C 停止服务器');
  console.log();
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ 端口 ${PORT} 已被占用，请尝试其他端口：`);
    console.error(`   node server.js ${PORT + 1}`);
  } else {
    console.error(err);
  }
  process.exit(1);
});