-- 文本分享表
CREATE TABLE IF NOT EXISTS share_text (
    id VARCHAR(16) PRIMARY KEY,          -- 唯一分享ID
    content TEXT NOT NULL,               -- 分享文本内容
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,  -- 创建时间
    expire_time TIMESTAMP,               -- 过期时间，NULL表示永不过期
    view_count INTEGER DEFAULT 0         -- 访问次数
);

-- 为expire_time字段添加索引，提升过期数据查询效率
CREATE INDEX IF NOT EXISTS idx_expire_time ON share_text(expire_time);
