@echo off
REM Windows 开发服务器启动脚本

echo 🚀 启动 TextShare 开发服务器...
echo.

REM 检查 node_modules 是否存在
if not exist "node_modules" (
  echo 📦 检测到依赖未安装，正在安装...
  call npm install
  echo.
)

REM 检查数据库文件是否存在
if not exist "src\server\db\data\share_text.db" (
  echo 💾 初始化数据库...
  call npm run init-db
  echo.
)

REM 启动开发服务器
echo ✨ 启动开发服务器...
echo 📍 访问地址: http://localhost:6006
echo ⏹️  按 Ctrl+C 停止服务器
echo.

call npm run dev
