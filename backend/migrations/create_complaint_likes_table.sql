CREATE TABLE IF NOT EXISTS complaint_likes (
    id SERIAL PRIMARY KEY,
    complaint_id INTEGER NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(complaint_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_likes_complaint ON complaint_likes(complaint_id);
