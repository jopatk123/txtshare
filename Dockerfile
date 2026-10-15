# syntax=docker/dockerfile:1.6
# 基础镜像固定到具体 patch 版本，避免浮动 tag 破坏可重复构建
FROM node:20.18.0-alpine3.20 AS builder

# better-sqlite3 是 native 模块，需要构建工具链
RUN apk add --no-cache python3 make g++

WORKDIR /app

# 先复制依赖文件以利用层缓存
COPY package*.json ./

# 只安装生产依赖。better-sqlite3 在这一步编译，运行镜像不再带构建工具和 devDependencies
RUN npm ci --omit=dev

# ─────────────────────────────────────────────────────────────────────────────
# 运行时镜像：仅包含生产依赖与源码
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20.18.0-alpine3.20 AS runner

WORKDIR /app

# 生产环境标志
ENV NODE_ENV=production

# 从 builder 复制 package.json 和已编译的 node_modules（包含 native 模块）
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules

# 从源代码复制 src 目录
COPY src ./src

# 创建必要目录并将所有权交给 node 用户
RUN mkdir -p src/server/db/data src/server/logs && \
    chown -R node:node /app

# 以非 root 用户运行
USER node

# 暴露端口
EXPOSE 6006

# 就绪探针：数据库或缓存不可用时 /api/health/ready 返回 503，fetch 失败则容器标记为 unhealthy。
# /api/health 在降级时仍返回 200，不能用来判断能否接流量。
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||6006)+'/api/health/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# 启动应用
CMD ["npm", "start"]
