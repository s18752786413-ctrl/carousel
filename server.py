#!/usr/bin/env python3
"""
图片轮播展示 — 一键启动服务器
零依赖，Python 3 内置库即可运行。

用法：
    python server.py              # 默认端口 8080
    python server.py 3000         # 指定端口
"""

import http.server
import socket
import os
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8080

# 获取本机局域网 IP
def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except:
        return '无法获取'

local_ip = get_local_ip()

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=os.path.dirname(os.path.abspath(__file__)), **kwargs)

    def log_message(self, format, *args):
        # 精简日志输出
        print(f"  [{self.address_string()}] {args[0]}")

print()
print("=" * 56)
print("  🖼️  图片轮播展示 — 服务器已启动")
print("=" * 56)
print()
print("  📺 展示页（轮播观看）：")
print(f"     http://localhost:{PORT}/")
if local_ip != '无法获取':
    print(f"     http://{local_ip}:{PORT}/")
print()
print("  🔧 管理页（上传图片）：")
print(f"     http://localhost:{PORT}/admin.html")
if local_ip != '无法获取':
    print(f"     http://{local_ip}:{PORT}/admin.html")
print()
print("  💡 手机/平板连同一 WiFi，打开上面局域网地址即可")
print("  🛑 按 Ctrl+C 停止服务器")
print()

try:
    httpd = http.server.HTTPServer(('0.0.0.0', PORT), Handler)
    httpd.serve_forever()
except KeyboardInterrupt:
    print("\n服务器已停止。")
except OSError as e:
    if e.errno == 10048 or 'Address already in use' in str(e):
        print(f"\n❌ 端口 {PORT} 已被占用，请尝试其他端口：")
        print(f"   python server.py {PORT + 1}")
    else:
        raise