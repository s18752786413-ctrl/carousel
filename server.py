#!/usr/bin/env python3
"""
图片/视频轮播 — 全功能 API 服务器 (Python)
零依赖，Python 3 内置库即可运行。

用法：
    python server.py              # 默认端口 8080
    python server.py 3000         # 指定端口
"""

import http.server
import json
import os
import re
import socket
import sys
import base64
import time
from urllib.parse import urlparse

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
ROOT = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(ROOT, 'data.json')
UPLOADS_DIR = os.path.join(ROOT, 'uploads')
MAX_ITEMS = 20

os.makedirs(UPLOADS_DIR, exist_ok=True)

def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except:
        return None

def read_data():
    try:
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except:
        return {'images': [], 'nextId': 1}

def write_data(data):
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

VIDEO_EXTS = re.compile(r'\.(mp4|webm|mov|mkv|avi|flv|wmv|m4v|ogv|3gp)(\?.*)?$', re.IGNORECASE)

MIME = {
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
}

class Handler(http.server.BaseHTTPRequestHandler):

    def log_message(self, format, *args):
        print(f"  [{self.address_string()}] {args[0]}")

    def send_json(self, status, obj):
        body = json.dumps(obj, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Content-Length', len(body))
        self.end_headers()
        self.wfile.write(body)

    def read_body(self):
        length = int(self.headers.get('Content-Length', 0))
        return self.rfile.read(length).decode('utf-8')

    # ---- API routes ----

    def handle_get_images(self):
        data = read_data()
        self.send_json(200, data['images'])

    def handle_upload(self):
        body = self.read_body()
        try:
            payload = json.loads(body)
        except:
            return self.send_json(400, {'error': 'Invalid JSON'})

        if 'data' not in payload:
            return self.send_json(400, {'error': 'Missing data field'})

        data_info = read_data()
        if len(data_info['images']) >= MAX_ITEMS:
            return self.send_json(400, {'error': f'Max {MAX_ITEMS} items reached'})

        match = re.match(r'^data:(image|video)/[^;]+;base64,(.+)$', payload['data'])
        if not match:
            return self.send_json(400, {'error': 'Invalid data URL format'})

        mime_type = match.group(1)
        b64data = match.group(2)
        buffer = base64.b64decode(b64data)

        ext = os.path.splitext(payload.get('name', ''))[1] or ('.mp4' if mime_type == 'video' else '.jpg')
        item_id = data_info['nextId']
        safe_name = f"{item_id}_{int(time.time() * 1000)}{ext}"
        file_path = os.path.join(UPLOADS_DIR, safe_name)

        with open(file_path, 'wb') as f:
            f.write(buffer)

        entry = {
            'id': item_id,
            'name': payload.get('name', 'untitled'),
            'mediaType': payload.get('mediaType', 'image'),
            'source': 'local',
            'path': '/uploads/' + safe_name,
            'createdAt': int(time.time() * 1000)
        }

        data_info['images'].append(entry)
        data_info['nextId'] = item_id + 1
        write_data(data_info)
        self.send_json(201, entry)

    def handle_add_urls(self):
        body = self.read_body()
        try:
            payload = json.loads(body)
        except:
            return self.send_json(400, {'error': 'Invalid JSON'})

        if 'urls' not in payload or not isinstance(payload['urls'], list):
            return self.send_json(400, {'error': 'Missing urls array'})

        data_info = read_data()
        remaining = MAX_ITEMS - len(data_info['images'])
        urls = payload['urls'][:remaining]

        added = []
        for u in urls:
            if not re.match(r'^https?://', u):
                continue
            try:
                name = urlparse(u).path.split('/')[-1] or u
            except:
                name = u
            is_video = bool(VIDEO_EXTS.search(u))
            entry = {
                'id': data_info['nextId'],
                'name': name,
                'mediaType': 'video' if is_video else 'image',
                'source': 'remote',
                'url': u,
                'createdAt': int(time.time() * 1000)
            }
            added.append(entry)
            data_info['images'].append(entry)
            data_info['nextId'] += 1

        write_data(data_info)
        self.send_json(201, {'added': len(added), 'entries': added})

    def handle_delete_image(self, item_id):
        data_info = read_data()
        idx = next((i for i, img in enumerate(data_info['images']) if img['id'] == item_id), -1)
        if idx == -1:
            return self.send_json(404, {'error': 'Not found'})

        img = data_info['images'][idx]
        if img.get('source') == 'local' and img.get('path'):
            try:
                os.unlink(os.path.join(ROOT, img['path'].lstrip('/')))
            except:
                pass

        data_info['images'].pop(idx)
        write_data(data_info)
        self.send_json(200, {'ok': True})

    def handle_clear_all(self):
        data_info = read_data()
        for img in data_info['images']:
            if img.get('source') == 'local' and img.get('path'):
                try:
                    os.unlink(os.path.join(ROOT, img['path'].lstrip('/')))
                except:
                    pass
        data_info['images'] = []
        write_data(data_info)
        self.send_json(200, {'ok': True})

    # ---- Static files ----

    def serve_static(self, file_path):
        if file_path == '/':
            file_path = '/index.html'
        full_path = os.path.join(ROOT, file_path.lstrip('/'))
        if not os.path.abspath(full_path).startswith(os.path.abspath(ROOT)):
            self.send_error(403)
            return
        try:
            with open(full_path, 'rb') as f:
                data = f.read()
            ext = os.path.splitext(full_path)[1].lower()
            content_type = MIME.get(ext, 'application/octet-stream')
            self.send_response(200)
            self.send_header('Content-Type', content_type)
            self.send_header('Content-Length', len(data))
            self.end_headers()
            self.wfile.write(data)
        except:
            self.send_response(404)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.end_headers()
            self.wfile.write(b'<h2>404</h2><p><a href="/">Home</a> | <a href="/admin.html">Admin</a></p>')

    # ---- Main routing ----

    def do_GET(self):
        path = urlparse(self.path).path
        if path == '/api/images':
            return self.handle_get_images()
        self.serve_static(path)

    def do_POST(self):
        path = urlparse(self.path).path
        if path == '/api/upload':
            return self.handle_upload()
        if path == '/api/urls':
            return self.handle_add_urls()
        self.send_json(404, {'error': 'Not found'})

    def do_DELETE(self):
        path = urlparse(self.path).path
        if path == '/api/images':
            return self.handle_clear_all()
        match = re.match(r'^/api/images/(\d+)$', path)
        if match:
            return self.handle_delete_image(int(match.group(1)))
        self.send_json(404, {'error': 'Not found'})

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

local_ip = get_local_ip()

print()
print('=' * 56)
print('  Picture/Video Carousel - API Server (Python)')
print('=' * 56)
print()
print(f'  Display:  http://localhost:{PORT}/')
if local_ip:
    print(f'            http://{local_ip}:{PORT}/')
print()
print(f'  Admin:    http://localhost:{PORT}/admin.html')
if local_ip:
    print(f'            http://{local_ip}:{PORT}/admin.html')
print()
print('  All devices see the same content via the server')
print('  Press Ctrl+C to stop')
print()

try:
    httpd = http.server.HTTPServer(('0.0.0.0', PORT), Handler)
    httpd.serve_forever()
except KeyboardInterrupt:
    print('\nServer stopped.')
except OSError as e:
    if e.errno == 10048 or 'Address already in use' in str(e):
        print(f'\nPort {PORT} busy, try: python server.py {PORT + 1}')
    else:
        raise