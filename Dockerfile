FROM node:20-alpine

WORKDIR /app

# 复制依赖文件
COPY package*.json ./

# 安装生产依赖（优先 npm ci 走 lockfile，缺锁时退化为 npm install）
RUN if [ -f package-lock.json ]; then \
      npm ci --omit=dev; \
    else \
      echo "WARN: package-lock.json missing, falling back to npm install" && \
      npm install --omit=dev; \
    fi && \
    npm cache clean --force

# 复制源代码
COPY . .

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
