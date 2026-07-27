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
- **数据库**: SQLite (better-sqlite3，WAL 模式)
- **缓存**: node-cache
- **定时任务**: node-schedule
- **日志**: winston

## 本地开发

### 快速启动（推荐）

```bash
# macOS/Linux
./start.sh
```

Windows 环境目前没有单独的快速启动脚本，请使用下方“手动启动”步骤。

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

`BASE_URL` 在生产环境（`NODE_ENV=production`）下强烈建议显式配置：当未配置时，服务端会拒绝从请求 `Host` 头推断分享链接（防止 Host 注入污染链接），并在启动时打印告警，分享链接会回退到 `http://localhost:<PORT>`。非生产环境下保留原有的根据请求动态生成的行为，方便本地多主机调试。

`TRUST_PROXY` 默认应保持关闭。只有在应用前方存在你明确控制的反向代理时，才应开启；例如单层 Nginx 反向代理可设置为 `1`。

`ALLOWED_ORIGINS` 用于配置 CORS 白名单。未设置或为 `*` 时允许任意来源（兼容默认部署）；多个来源以逗号分隔，例如 `https://app.example.com,https://admin.example.com`，配置后仅这些来源可跨域调用 API。

如果你使用本地配置文件，也可以复制 [.env.example](.env.example) 并填写 `BASE_URL`、`TRUST_PROXY`、`ADMIN_TOKEN`、`ALLOWED_ORIGINS`。管理员后台访问地址为 `/admin/`，只有配置了 `ADMIN_TOKEN` 才能登录。出于安全考虑，后台令牌默认**仅保存在当前页面内存**，刷新或关闭页面后需要重新登录。

### 健康检查

服务暴露 `GET /api/health` 端点，返回 `{ success, status, uptime }`，可作为容器探活与负载均衡探针。Dockerfile 已内置 `HEALTHCHECK` 调用该端点。

### 安全特性

- 全局响应头：`Content-Security-Policy`、`X-Content-Type-Options`、`X-Frame-Options`、`Referrer-Policy`、`Cross-Origin-Opener-Policy`、`Permissions-Policy`；HTTPS 请求额外加 `Strict-Transport-Security`。
- 前端依赖（marked / DOMPurify / highlight.js）全部本地化，无 CDN 运行时依赖。
- 管理员 token 先做固定长度摘要再走 `crypto.timingSafeEqual` 比对，避免长度侧信道；后台页面默认不持久化令牌。
- 后台敏感操作（单删 / 批删 / 清理过期）会写入 `audit_log` 审计表，并可通过 `/api/admin/audit-logs` 查看最近记录。
- 公开 / 创建 / 分享页 / 管理接口采用分层限流，避免通过页面路由绕过 API 限制。
- better-sqlite3 启用 WAL 模式，写入即时落盘，无需应用层全量 export+fsync；事务保证原子性。
- Docker 镜像采用多阶段构建，以 `node` 非 root 用户运行，`npm ci --omit=dev` 走锁文件，并启用运行时加固（`read_only` / `cap_drop: ALL` / `no-new-privileges`）。

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

### 健康检查

```
GET /api/health
```

### 管理后台（需 `ADMIN_TOKEN`）

```
GET /api/admin/stats
GET /api/admin/shares?page=1&limit=20&search=
GET /api/admin/audit-logs?limit=10
DELETE /api/admin/shares/:id
DELETE /api/admin/shares
POST /api/admin/cleanup
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
