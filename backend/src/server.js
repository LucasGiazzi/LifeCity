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

    await runMigration(pool, 'users_bonus_xp', `
        ALTER TABLE users ADD COLUMN IF NOT EXISTS bonus_xp INTEGER DEFAULT 0
    `);

    await runMigration(pool, 'missions', `
        CREATE TABLE IF NOT EXISTS missions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            title VARCHAR(150) NOT NULL,
            description TEXT,
            type VARCHAR(20) NOT NULL DEFAULT 'group',
            goal_type VARCHAR(30) NOT NULL,
            goal_count INTEGER NOT NULL,
            goal_resolved_percent INTEGER,
            complaint_category VARCHAR(50),
            neighborhood VARCHAR(150),
            creator_id UUID REFERENCES users(id) ON DELETE SET NULL,
            frequency VARCHAR(10) NOT NULL DEFAULT 'weekly',
            starts_at TIMESTAMP NOT NULL,
            ends_at TIMESTAMP NOT NULL,
            group_xp_reward INTEGER DEFAULT 0,
            member_xp_reward INTEGER DEFAULT 50,
            completed_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT NOW()
        )
    `);

    await runMigration(pool, 'mission_groups', `
        CREATE TABLE IF NOT EXISTS mission_groups (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            mission_id UUID REFERENCES missions(id) ON DELETE CASCADE,
            name VARCHAR(100),
            total_xp INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT NOW()
        )
    `);

    await runMigration(pool, 'mission_participants', `
        CREATE TABLE IF NOT EXISTS mission_participants (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            mission_id UUID REFERENCES missions(id) ON DELETE CASCADE,
            mission_group_id UUID REFERENCES mission_groups(id) ON DELETE SET NULL,
            user_id UUID REFERENCES users(id) ON DELETE CASCADE,
            status VARCHAR(20) NOT NULL DEFAULT 'active',
            joined_at TIMESTAMP DEFAULT NOW(),
            contribution_count INTEGER DEFAULT 0,
            xp_earned INTEGER DEFAULT 0,
            completed_at TIMESTAMP,
            UNIQUE(mission_id, user_id)
        )
    `);

    await runMigration(pool, 'mission_participants_indexes', `
        CREATE INDEX IF NOT EXISTS idx_mission_participants_mission
        ON mission_participants(mission_id);
        CREATE INDEX IF NOT EXISTS idx_mission_participants_user
        ON mission_participants(user_id)
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

    // ── Fase 2: Missões automáticas + Equipes ────────────────────────────────

    await runMigration(pool, 'mission_templates', `
        CREATE TABLE IF NOT EXISTS mission_templates (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            title VARCHAR(150) NOT NULL UNIQUE,
            description TEXT,
            frequency VARCHAR(10) NOT NULL,
            goal_type VARCHAR(30) NOT NULL,
            goal_count INTEGER NOT NULL,
            goal_resolved_percent INTEGER,
            complaint_category VARCHAR(50),
            base_xp_reward INTEGER DEFAULT 0,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT NOW()
        )
    `);

    await runMigration(pool, 'teams', `
        CREATE TABLE IF NOT EXISTS teams (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name VARCHAR(100) NOT NULL,
            creator_id UUID REFERENCES users(id) ON DELETE SET NULL,
            total_xp INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT NOW()
        )
    `);

    await runMigration(pool, 'team_members', `
        CREATE TABLE IF NOT EXISTS team_members (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
            user_id UUID REFERENCES users(id) ON DELETE CASCADE,
            status VARCHAR(20) NOT NULL DEFAULT 'active',
            joined_at TIMESTAMP DEFAULT NOW(),
            UNIQUE(team_id, user_id)
        )
    `);

    await runMigration(pool, 'team_members_indexes', `
        CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team_id);
        CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_id)
    `);

    await runMigration(pool, 'user_missions', `
        CREATE TABLE IF NOT EXISTS user_missions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID REFERENCES users(id) ON DELETE CASCADE,
            mission_template_id UUID REFERENCES mission_templates(id),
            frequency VARCHAR(10) NOT NULL,
            contribution_count INTEGER DEFAULT 0,
            xp_earned INTEGER DEFAULT 0,
            bonus_xp_earned INTEGER DEFAULT 0,
            completed_at TIMESTAMP,
            expires_at TIMESTAMP NOT NULL,
            created_at TIMESTAMP DEFAULT NOW()
        )
    `);

    await runMigration(pool, 'user_missions_indexes', `
        CREATE INDEX IF NOT EXISTS idx_user_missions_user
        ON user_missions(user_id, expires_at DESC)
    `);

    await runMigration(pool, 'mission_templates_seed', `
        INSERT INTO mission_templates (title, description, frequency, goal_type, goal_count, complaint_category, base_xp_reward)
        VALUES
            ('Olho da Rua',            'Registre 1 reclamação hoje',                          'daily',  'count',              1, NULL,             30),
            ('Alerta de Trânsito',     'Registre 1 ocorrência de trânsito hoje',               'daily',  'count',              1, 'trânsito',       35),
            ('Vigilante da Limpeza',   'Reporte 1 problema de limpeza pública hoje',            'daily',  'count',              1, 'limpeza',        35),
            ('Fiscal da Infraestrutura','Registre 1 problema de infraestrutura hoje',           'daily',  'count',              1, 'infraestrutura', 35),
            ('Guardião da Segurança',  'Reporte 1 ocorrência de segurança hoje',               'daily',  'count',              1, 'segurança',      35),
            ('Semana Ativa',           'Registre 5 reclamações nesta semana',                  'weekly', 'count',              5, NULL,             100),
            ('Fiscal Semanal',         'Registre 3 problemas de infraestrutura na semana',     'weekly', 'count',              3, 'infraestrutura', 120),
            ('Patrulha Semanal',       'Registre 4 reclamações nesta semana',                  'weekly', 'count',              4, NULL,             110),
            ('Defensor da Cidade',     'Registre 3 ocorrências de segurança na semana',        'weekly', 'count',              3, 'segurança',      120),
            ('Cidadão Engajado',       'Registre 5 reclamações com 40% delas resolvidas',      'weekly', 'count_and_resolved', 5, NULL,             150)
        ON CONFLICT (title) DO NOTHING
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

