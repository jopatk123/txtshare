# 文本分享链接网页 (Text Share)

一个轻量级的文本分享工具，无需登录即可生成分享链接。

## 功能特性

- 📝 支持多行文本粘贴分享
- 🔗 生成唯一分享链接
- ⏰ 支持自定义过期时间（永不过期/1小时/1天/7天/30天/自定义）
- 📱 适配PC端与移动端
- 🔒 XSS防护、SQL注入防护、请求限流
- 🚀 内存缓存优化性能

## 技术栈

- **后端**: Node.js + Express
- **数据库**: SQLite (sql.js)
- **缓存**: node-cache
- **定时任务**: node-schedule
- **日志**: winston

## 本地开发

### 快速启动（推荐）

```bash
# macOS/Linux
./dev.sh

# Windows
dev.bat
```

### 手动启动

```bash
# 安装依赖
npm install

# 初始化数据库
npm run init-db

# 开发模式运行
npm run dev

# 生产模式运行
npm start
```

## Docker 部署

### 使用 Docker Compose（推荐）

```bash
# 构建并启动
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

### 单独使用 Docker

```bash
# 构建镜像
docker build -t text-share .

# 运行容器
docker run -d \
  --name text-share \
  -p 6006:6006 \
  -v $(pwd)/data/db:/app/src/server/db/data \
  -v $(pwd)/data/logs:/app/src/server/logs \
  -e BASE_URL=https://your-domain.example \
  text-share
```

`BASE_URL` 是可选项。若不设置，服务端会根据当前请求的协议和主机名自动生成分享链接。

## Nginx 配置

在宿主机配置 Nginx 反向代理：

```nginx
server {
    listen 80;
    server_name your-domain.example;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.example;

    ssl_certificate /etc/letsencrypt/live/your-domain.example/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.example/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:6006;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## API 接口

### 创建分享

```
POST /api/create
Content-Type: application/json

{
  "content": "要分享的文本内容",
  "expireType": "never" | "1h" | "1d" | "7d" | "30d" | "custom",
  "expireDays": 3  // 当 expireType 为 custom 时必填
}
```

### 获取文本

```
GET /api/text/:id
```

### 访问分享页面

```
GET /s/:id
```

## 项目结构

```
text-share/
├── Dockerfile
├── docker-compose.yml
├── .dockerignore
├── package.json
├── README.md
└── src/
    ├── server/
    │   ├── index.js          # 入口文件
    │   ├── app.js            # Express 应用配置
    │   ├── routes/           # 路由
    │   ├── controllers/      # 控制器
    │   ├── models/           # 数据模型
    │   ├── middleware/       # 中间件
    │   ├── utils/            # 工具函数
    │   ├── db/               # 数据库
    │   └── logs/             # 日志
    └── public/               # 前端静态资源
```

## License

MIT
