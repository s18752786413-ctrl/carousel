#!/bin/bash
set -e
cd "$(dirname "$0")"

echo "=== 初始化 Git 仓库 ==="
git init
git add -A
git status
echo ""
echo "=== 完成 ==="
echo "仓库已初始化，文件已暂存。"
echo "接下来需要: gh auth login (登录 GitHub)"
echo "然后: gh repo create (创建远程仓库)"
echo "最后: git push origin main"