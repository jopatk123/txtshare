# syntax=docker/dockerfile:1.6
# 基础镜像固定到具体 patch 版本，避免浮动 tag 破坏可重复构建
FROM node:20.18.0-alpine3.20 AS builder

# better-sqlite3 是 native 模块，需要构建工具链
RUN apk add --no-cache python3 make g++

WORKDIR /app

# 先复制依赖文件以利用层缓存
COPY package*.json ./

# 安装全部依赖（含 devDependencies，构建阶段需要）
RUN npm ci

# ─────────────────────────────────────────────────────────────────────────────
# 运行时镜像：仅包含生产依赖与源码
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20.18.0-alpine3.20 AS runner

WORKDIR /app

# 生产环境标志
ENV NODE_ENV=production

# 仅复制生产依赖
COPY package*.json ./
RUN npm ci --omit=dev && \
    npm cache clean --force

# 复制源代码
COPY --from=builder /app/src ./src

# 创建必要目录并将所有权交给 node 用户
RUN mkdir -p src/server/db/data src/server/logs && \
    chown -R node:node /app

# 以非 root 用户运行
USER node

# 暴露端口
EXPOSE 6006

# 健康检查（容器编排可据此判断实例存活）
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:6006/api/health >/dev/null 2>&1 || exit 1

# 启动应用
CMD ["npm", "start"]
