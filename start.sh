#!/bin/bash

# 开发服务器启动脚本

echo "🚀 启动 TextShare 开发服务器..."
echo ""

# 检查 node_modules 是否存在
if [ ! -d "node_modules" ]; then
  echo "📦 检测到依赖未安装，正在安装..."
  npm install
  echo ""
fi

# 检查数据库文件是否存在
if [ ! -f "src/server/db/data/share_text.db" ]; then
  echo "💾 初始化数据库..."
  npm run init-db
  echo ""
fi

# 启动开发服务器
echo "✨ 启动开发服务器..."
echo "📍 访问地址: http://localhost:6006"
echo "⏹️  按 Ctrl+C 停止服务器"
echo ""

npm run dev
