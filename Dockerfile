FROM node:20-alpine

WORKDIR /app

# 复制依赖文件
COPY package*.json ./

# 安装依赖
RUN npm ci --only=production

# 复制源代码
COPY . .

# 创建必要的目录
RUN mkdir -p src/server/db/data src/server/logs

# 初始化数据库
RUN node src/server/db/initDb.js

# 暴露端口
EXPOSE 6006

# 启动应用
CMD ["npm", "start"]
