const dotenv = require('dotenv');
dotenv.config();

const fs = require('fs');
const path = require('path');
const app = require('./app');
const http = require('http');
const jwt = require('jsonwebtoken');
const supabasePool = require('./infra/supabasePool');

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

    await runMigration(pool, 'mission_templates_fix_seguranca', `
        UPDATE mission_templates SET complaint_category = 'seguranca' WHERE complaint_category = 'segurança'
    `);

    await runMigration(pool, 'mission_templates_fix_transito', `
        UPDATE mission_templates SET complaint_category = 'transito' WHERE complaint_category = 'trânsito'
    `);

    await runMigration(pool, 'mission_templates_seed', `
        INSERT INTO mission_templates (title, description, frequency, goal_type, goal_count, complaint_category, base_xp_reward)
        VALUES
            ('Olho da Rua',             'Registre 1 reclamação hoje',                          'daily',  'count',              1, NULL,             30),
            ('Alerta de Trânsito',      'Registre 1 ocorrência de trânsito hoje',               'daily',  'count',              1, 'transito',       35),
            ('Vigilante da Limpeza',    'Reporte 1 problema de limpeza pública hoje',            'daily',  'count',              1, 'limpeza',        35),
            ('Fiscal da Infraestrutura','Registre 1 problema de infraestrutura hoje',            'daily',  'count',              1, 'infraestrutura', 35),
            ('Guardião da Segurança',   'Reporte 1 ocorrência de segurança hoje',               'daily',  'count',              1, 'seguranca',      35),
            ('Semana Ativa',            'Registre 5 reclamações nesta semana',                  'weekly', 'count',              5, NULL,             100),
            ('Fiscal Semanal',          'Registre 3 problemas de infraestrutura na semana',     'weekly', 'count',              3, 'infraestrutura', 120),
            ('Patrulha Semanal',        'Registre 4 reclamações nesta semana',                  'weekly', 'count',              4, NULL,             110),
            ('Defensor da Cidade',      'Registre 3 ocorrências de segurança na semana',        'weekly', 'count',              3, 'seguranca',      120),
            ('Cidadão Engajado',        'Registre 5 reclamações com 40% delas resolvidas',      'weekly', 'count_and_resolved', 5, NULL,             150)
        ON CONFLICT (title) DO NOTHING
    `);

    // ── Fase 3: Sistema de denúncias ─────────────────────────────────────────

    await runMigration(pool, 'complaints_report_fields', `
        ALTER TABLE complaints
        ADD COLUMN IF NOT EXISTS report_count INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS is_hidden    BOOLEAN NOT NULL DEFAULT FALSE
    `);

    await runMigration(pool, 'users_report_fields', `
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS report_count  INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS is_restricted BOOLEAN NOT NULL DEFAULT FALSE
    `);

    await runMigration(pool, 'reports', `
        CREATE TABLE IF NOT EXISTS reports (
            id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            reporter_id  UUID REFERENCES users(id) ON DELETE CASCADE,
            target_type  VARCHAR(20) NOT NULL,
            target_id    UUID NOT NULL,
            reason       VARCHAR(50) NOT NULL,
            details      TEXT,
            status       VARCHAR(20) NOT NULL DEFAULT 'pending',
            reviewed_by  UUID REFERENCES users(id) ON DELETE SET NULL,
            reviewed_at  TIMESTAMP,
            created_at   TIMESTAMP DEFAULT NOW(),
            UNIQUE(reporter_id, target_type, target_id)
        )
    `);

    await runMigration(pool, 'reports_index', `
        CREATE INDEX IF NOT EXISTS idx_reports_target
        ON reports(target_type, target_id, status)
    `);

    // ── Recuperação de senha ─────────────────────────────────────────────────

    await runMigration(pool, 'password_reset_tokens', `
        CREATE TABLE IF NOT EXISTS password_reset_tokens (
            id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
            code_hash  VARCHAR(64) NOT NULL,
            expires_at TIMESTAMP NOT NULL,
            used_at    TIMESTAMP,
            created_at TIMESTAMP DEFAULT NOW()
        )
    `);

    // ── Padronização de CPF (remove formatação) ──────────────────────────────

    await runMigration(pool, 'normalize_cpf', `
        UPDATE users
        SET cpf = REGEXP_REPLACE(cpf, '[^0-9]', '', 'g')
        WHERE cpf IS NOT NULL AND cpf ~ '[^0-9]'
    `);

    // ── ADR-003 Fase 4a: gestão operacional ─────────────────────────────────

    const phase4Migrations = [
        ['014_ops_teams', '014_ops_teams.sql'],
        ['015_complaint_events', '015_complaint_events.sql'],
        ['016_complaints_operational_columns', '016_complaints_operational_columns.sql'],
        ['017_tenant_sla_policies', '017_tenant_sla_policies.sql'],
        ['018_seed_campinas_ops', '018_seed_campinas_ops.sql'],
        ['019_reports_target_id_text', '019_reports_target_id_text.sql'],
    ];

    for (const [name, file] of phase4Migrations) {
        const filePath = path.join(__dirname, '../migrations', file);
        if (fs.existsSync(filePath)) {
            const sql = fs.readFileSync(filePath, 'utf8');
            //await runMigration(pool, name, sql);
        } else {
            console.warn(`[migration] SKIP: ${name} — arquivo não encontrado`);
        }
    }

    // ── Malhas staging + demografia Campinas ────────────────────────────────────

    const malhasMigrationPath = path.join(__dirname, '../migrations/020_malhas_staging_demografia.sql');
    if (fs.existsSync(malhasMigrationPath)) {
        const sql = fs.readFileSync(malhasMigrationPath, 'utf8');
        await runMigration(pool, '020_malhas_staging_demografia', sql);
    }

    // ── ADR-004 Fase 5a: watchers + device tokens ─────────────────────────────

    const phase5aMigrationPath = path.join(__dirname, '../migrations/021_complaint_watchers_and_tokens.sql');
    if (fs.existsSync(phase5aMigrationPath)) {
        const sql = fs.readFileSync(phase5aMigrationPath, 'utf8');
        await runMigration(pool, '021_complaint_watchers_and_tokens', sql);
    }

    const phase5dMigrationPath = path.join(__dirname, '../migrations/022_complaint_messages.sql');
    if (fs.existsSync(phase5dMigrationPath)) {
        const sql = fs.readFileSync(phase5dMigrationPath, 'utf8');
        await runMigration(pool, '022_complaint_messages', sql);
    }

    const phase5eMigrationPath = path.join(__dirname, '../migrations/023_complaint_messages_encryption.sql');
    if (fs.existsSync(phase5eMigrationPath)) {
        const sql = fs.readFileSync(phase5eMigrationPath, 'utf8');
        await runMigration(pool, '023_complaint_messages_encryption', sql);
    }

    // ── Verificação de cidade ─────────────────────────────────────────────────

    await runMigration(pool, 'users_cep', `
        ALTER TABLE users ADD COLUMN IF NOT EXISTS cep VARCHAR(8)
    `);

    await runMigration(pool, 'users_low_trust', `
        ALTER TABLE users ADD COLUMN IF NOT EXISTS low_trust BOOLEAN NOT NULL DEFAULT FALSE
    `);

    await runMigration(pool, 'complaints_is_within_city', `
        ALTER TABLE complaints ADD COLUMN IF NOT EXISTS is_within_city BOOLEAN
    `);

    // ── Equipes: foto, descrição e chat ──────────────────────────────────────

    await runMigration(pool, 'teams_description_photo', `
        ALTER TABLE teams
        ADD COLUMN IF NOT EXISTS description TEXT,
        ADD COLUMN IF NOT EXISTS photo_url TEXT,
        ADD COLUMN IF NOT EXISTS photo_path TEXT
    `);

    await runMigration(pool, 'team_messages', `
        CREATE TABLE IF NOT EXISTS team_messages (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
            user_id UUID REFERENCES users(id) ON DELETE SET NULL,
            content TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT NOW()
        )
    `);

    await runMigration(pool, 'team_messages_index', `
        CREATE INDEX IF NOT EXISTS idx_team_messages_team
        ON team_messages(team_id, created_at DESC)
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

