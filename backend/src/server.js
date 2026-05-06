const app = require('./app');
const http = require('http');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const supabasePool = require('./infra/supabasePool');

dotenv.config();

const PORT = process.env.PORT || 3000;

async function runMigration(pool, name, sql) {
    try {
        await pool.query(sql);
        console.log(`[migration] OK: ${name}`);
    } catch (err) {
        console.error(`[migration] FAILED: ${name} — ${err.message}`);
    }
}

async function runMigrations() {
    const pool = await supabasePool.getPgPool();

    await runMigration(pool, 'complaints.status', `
        ALTER TABLE complaints
        ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'pending'
    `);

    await runMigration(pool, 'complaint_witnesses', `
        CREATE TABLE IF NOT EXISTS complaint_witnesses (
            id BIGSERIAL PRIMARY KEY,
            complaint_id INTEGER NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE(complaint_id, user_id)
        )
    `);

    await runMigration(pool, 'achievements', `
        CREATE TABLE IF NOT EXISTS achievements (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name VARCHAR(100) NOT NULL,
            description TEXT,
            icon VARCHAR(100),
            xp_reward INTEGER DEFAULT 0,
            trigger_type VARCHAR(50) NOT NULL,
            trigger_count INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT NOW(),
            UNIQUE(trigger_type, trigger_count)
        )
    `);

    await runMigration(pool, 'user_achievements', `
        CREATE TABLE IF NOT EXISTS user_achievements (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID REFERENCES users(id) ON DELETE CASCADE,
            achievement_id UUID REFERENCES achievements(id),
            unlocked_at TIMESTAMP DEFAULT NOW(),
            is_featured BOOLEAN DEFAULT FALSE,
            UNIQUE(user_id, achievement_id)
        )
    `);

    await runMigration(pool, 'notifications', `
        CREATE TABLE IF NOT EXISTS notifications (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID REFERENCES users(id) ON DELETE CASCADE,
            actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
            type VARCHAR(50) NOT NULL,
            reference_type VARCHAR(50),
            reference_id TEXT,
            read_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT NOW()
        )
    `);

    await runMigration(pool, 'notifications_index', `
        CREATE INDEX IF NOT EXISTS idx_notifications_user
        ON notifications(user_id, created_at DESC)
    `);

    await runMigration(pool, 'achievements_seed', `
        INSERT INTO achievements (name, description, icon, xp_reward, trigger_type, trigger_count)
        VALUES
            ('Primeira Voz',         'Criou sua primeira reclamação',                     'megaphone', 25,  'complaint_created', 1),
            ('Cidadão Ativo',        'Criou 5 reclamações',                               'city',      75,  'complaint_created', 5),
            ('Fiscal da Cidade',     'Criou 10 reclamações',                              'shield',    150, 'complaint_created', 10),
            ('Voz do Povo',          'Criou 25 reclamações',                              'star',      300, 'complaint_created', 25),
            ('Popular',              'Recebeu 10 curtidas nas reclamações',               'heart',     50,  'likes_received',    10),
            ('Influenciador Cívico', 'Recebeu 50 curtidas nas reclamações',               'fire',      150, 'likes_received',    50),
            ('Queridinho da Cidade', 'Recebeu 100 curtidas nas reclamações',              'trophy',    300, 'likes_received',    100),
            ('Em Pauta',             'Recebeu 10 comentários nas reclamações',            'chat',      50,  'comments_received', 10),
            ('Debate Aberto',        'Recebeu 50 comentários nas reclamações',            'megaphone', 150, 'comments_received', 50)
        ON CONFLICT (trigger_type, trigger_count) DO NOTHING
    `);
}

const server = http.createServer(app);

server.listen(PORT, async () => {
    console.log(`Server is running on port ${PORT}`);
    await runMigrations();
});

app.get('/', (req, res) => {
    res.send('Hello World');
});

