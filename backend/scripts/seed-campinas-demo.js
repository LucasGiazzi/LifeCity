/**
 * Seed de demonstração — Campinas
 *
 * Cria usuários fake (cidadãos + gestão municipal), ~200 reclamações georreferenciadas
 * e aplica workflow operacional (triagem, atribuição, resolução) via complaintWorkflowService.
 *
 * Uso:
 *   node scripts/seed-campinas-demo.js
 *   node scripts/seed-campinas-demo.js --count 200
 *   node scripts/seed-campinas-demo.js --cleanup
 *
 * Credenciais dos usuários seed: senha "SeedDemo123!" para todos.
 */
require('dotenv').config();

const supabasePool = require('../src/infra/supabasePool');
const { encryptPassword, generateSalt } = require('../src/infra/crypto');
const { INSERT_COMPLAINT_WITH_GEO } = require('../src/services/complaintGeoService');
const workflow = require('../src/services/complaintWorkflowService');

const SEED_DOMAIN = '@lifecity.demo';
const SEED_PREFIX = '[SEED]';
const DEFAULT_PASSWORD = 'SeedDemo123!';

const CATEGORY_SLUGS = [
    'infraestrutura',
    'seguranca',
    'limpeza',
    'transito',
    'outros',
];

const CATEGORY_WEIGHTS = [
    { slug: 'infraestrutura', weight: 25 },
    { slug: 'seguranca', weight: 15 },
    { slug: 'limpeza', weight: 20 },
    { slug: 'transito', weight: 20 },
    { slug: 'outros', weight: 20 },
];

const DESCRIPTIONS = {
    infraestrutura: [
        'Buraco profundo na via, risco para veículos.',
        'Calçada quebrada dificultando passagem de pedestres.',
        'Poste de iluminação apagado há semanas.',
        'Sinalização de trânsito danificada.',
    ],
    seguranca: [
        'Área escura com histórico de furtos.',
        'Árvore com galhos prestes a cair.',
        'Vandalismo em equipamento público.',
    ],
    limpeza: [
        'Acúmulo de lixo em via pública.',
        'Entulho descartado irregularmente.',
        'Bueiro entupido causando mau cheiro.',
    ],
    transito: [
        'Estacionamento irregular bloqueando faixa.',
        'Semáforo com tempo irregular.',
        'Veículo abandonado na rua.',
    ],
    outros: [
        'Barulho excessivo em horário noturno.',
        'Ocorrência diversa sem classificação clara.',
        'Solicitação de vistoria no local.',
    ],
};

const CITIZEN_NAMES = [
    'Ana Souza',
    'Bruno Lima',
    'Carla Mendes',
    'Diego Rocha',
    'Elena Ferreira',
    'Felipe Nunes',
    'Gabriela Costa',
    'Henrique Alves',
    'Isabela Martins',
    'João Pedro Silva',
    'Karina Duarte',
    'Lucas Oliveira',
    'Mariana Ribeiro',
    'Nicolas Prado',
    'Olivia Campos',
];

const TEAM_BY_CATEGORY = {
    infraestrutura: 'obras',
    seguranca: 'seguranca',
    limpeza: 'limpeza',
    transito: 'transito',
    outros: 'triagem-geral',
};

/** Distribuição de status alvo (total deve bater com --count). */
const STATUS_DISTRIBUTION = [
    { target: 'pending', count: 70 },
    { target: 'triaged', count: 30 },
    { target: 'assigned', count: 25 },
    { target: 'in_progress', count: 30 },
    { target: 'resolved', count: 20 },
    { target: 'closed', count: 10 },
    { target: 'cancelled', count: 15 },
];

function parseArgs() {
    const args = process.argv.slice(2);
    let count = 200;
    let cleanup = false;

    for (let i = 0; i < args.length; i += 1) {
        if (args[i] === '--cleanup') {
            cleanup = true;
        } else if (args[i] === '--count' && args[i + 1]) {
            count = Number(args[i + 1]);
            i += 1;
        }
    }

    return { count, cleanup };
}

function pickWeightedCategory(rng = Math.random()) {
    const total = CATEGORY_WEIGHTS.reduce((sum, item) => sum + item.weight, 0);
    let cursor = rng * total;

    for (const item of CATEGORY_WEIGHTS) {
        cursor -= item.weight;
        if (cursor <= 0) {
            return item.slug;
        }
    }

    return 'outros';
}

function fakeCpf(index) {
    return `990${String(index).padStart(8, '0')}`;
}

function fakePhone(index) {
    return `199${String(10000000 + index).slice(-8)}`;
}

async function upsertUser(pool, { email, name, cpf, phone, homeCdMun = null }) {
    const existing = await pool.query('SELECT id FROM public.users WHERE email = $1', [email]);
    if (existing.rows[0]) {
        return existing.rows[0].id;
    }

    const salt = generateSalt();
    const password = encryptPassword(DEFAULT_PASSWORD, salt);

    const { rows } = await pool.query(
        `INSERT INTO public.users (email, password, name, cpf, phone, salt, home_cd_mun)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [email, password, name, cpf, phone, salt, homeCdMun]
    );

    return rows[0].id;
}

async function ensureTenantMember(pool, tenantId, userId, role) {
    await pool.query(
        `INSERT INTO public.tenant_members (tenant_id, user_id, role, is_active)
         VALUES ($1, $2, $3, true)
         ON CONFLICT (tenant_id, user_id) DO UPDATE
           SET role = EXCLUDED.role, is_active = true`,
        [tenantId, userId, role]
    );
}

async function ensureOpsTeamMember(pool, opsTeamId, userId, role = 'member') {
    await pool.query(
        `INSERT INTO public.ops_team_members (ops_team_id, user_id, role, is_active)
         VALUES ($1, $2, $3, true)
         ON CONFLICT (ops_team_id, user_id) DO UPDATE
           SET role = EXCLUDED.role, is_active = true`,
        [opsTeamId, userId, role]
    );
}

async function cleanupSeed(pool) {
    console.log('Limpando dados seed anteriores...');

    const complaintIds = await pool.query(
        `SELECT id FROM public.complaints WHERE description LIKE $1`,
        [`${SEED_PREFIX}%`]
    );
    const ids = complaintIds.rows.map((row) => row.id);

    if (ids.length > 0) {
        await pool.query('DELETE FROM public.complaint_events WHERE complaint_id = ANY($1::bigint[])', [ids]);
        await pool.query('DELETE FROM public.complaint_likes WHERE complaint_id = ANY($1::int[])', [ids]);
        await pool.query('DELETE FROM public.complaint_witnesses WHERE complaint_id = ANY($1::int[])', [ids]);
        await pool.query('DELETE FROM public.comments WHERE complaint_id = ANY($1::int[])', [ids]);
        await pool.query('DELETE FROM public.reports WHERE target_type = $1 AND target_id = ANY($2::text[])', [
            'complaint',
            ids.map(String),
        ]);
        await pool.query('DELETE FROM public.complaints WHERE id = ANY($1::bigint[])', [ids]);
        console.log(`  ${ids.length} reclamações removidas`);
    }

    const seedUsers = await pool.query(
        `SELECT id FROM public.users WHERE email LIKE $1`,
        [`%${SEED_DOMAIN}`]
    );
    const userIds = seedUsers.rows.map((row) => row.id);

    if (userIds.length > 0) {
        await pool.query(
            `DELETE FROM public.notifications
             WHERE user_id = ANY($1::uuid[]) OR actor_id = ANY($1::uuid[])`,
            [userIds]
        );
        await pool.query('DELETE FROM public.ops_team_members WHERE user_id = ANY($1::uuid[])', [userIds]);
        await pool.query('DELETE FROM public.tenant_members WHERE user_id = ANY($1::uuid[])', [userIds]);
        await pool.query('DELETE FROM public.users WHERE id = ANY($1::uuid[])', [userIds]);
        console.log(`  ${userIds.length} usuários seed removidos`);
    }

    console.log('Cleanup concluído.');
}

async function createSeedUsers(pool, tenant) {
    console.log('Criando usuários seed...');

    const citizenIds = [];
    for (let i = 0; i < CITIZEN_NAMES.length; i += 1) {
        const index = i + 1;
        const id = await upsertUser(pool, {
            email: `seed-citizen-${String(index).padStart(2, '0')}${SEED_DOMAIN}`,
            name: `${SEED_PREFIX} ${CITIZEN_NAMES[i]}`,
            cpf: fakeCpf(index),
            phone: fakePhone(index),
            homeCdMun: tenant.cd_mun,
        });
        citizenIds.push(id);
    }

    const adminId = await upsertUser(pool, {
        email: `seed-admin${SEED_DOMAIN}`,
        name: `${SEED_PREFIX} Admin Municipal`,
        cpf: fakeCpf(101),
        phone: fakePhone(101),
        homeCdMun: tenant.cd_mun,
    });
    await ensureTenantMember(pool, tenant.id, adminId, 'admin');

    const operatorIds = [];
    const operatorSpecs = [
        { email: `seed-operator-obras${SEED_DOMAIN}`, name: 'Operador Obras', cpf: 102, team: 'obras' },
        { email: `seed-operator-limpeza${SEED_DOMAIN}`, name: 'Operador Limpeza', cpf: 103, team: 'limpeza' },
        { email: `seed-operator-transito${SEED_DOMAIN}`, name: 'Operador Trânsito', cpf: 104, team: 'transito' },
        { email: `seed-operator-seguranca${SEED_DOMAIN}`, name: 'Operador Segurança', cpf: 105, team: 'seguranca' },
    ];

    const teamsRes = await pool.query(
        `SELECT id, slug FROM public.ops_teams WHERE tenant_id = $1`,
        [tenant.id]
    );
    const teamsBySlug = Object.fromEntries(teamsRes.rows.map((row) => [row.slug, row.id]));

    for (const spec of operatorSpecs) {
        const userId = await upsertUser(pool, {
            email: spec.email,
            name: `${SEED_PREFIX} ${spec.name}`,
            cpf: fakeCpf(spec.cpf),
            phone: fakePhone(spec.cpf),
            homeCdMun: tenant.cd_mun,
        });
        await ensureTenantMember(pool, tenant.id, userId, 'operator');
        const teamId = teamsBySlug[spec.team];
        if (teamId) {
            await ensureOpsTeamMember(pool, teamId, userId, 'member');
        }
        operatorIds.push({ userId, teamSlug: spec.team, teamId });
    }

    const viewerId = await upsertUser(pool, {
        email: `seed-viewer${SEED_DOMAIN}`,
        name: `${SEED_PREFIX} Visualizador`,
        cpf: fakeCpf(106),
        phone: fakePhone(106),
        homeCdMun: tenant.cd_mun,
    });
    await ensureTenantMember(pool, tenant.id, viewerId, 'viewer');

    const triagemTeamId = teamsBySlug['triagem-geral'];
    if (triagemTeamId) {
        await ensureOpsTeamMember(pool, triagemTeamId, adminId, 'lead');
    }

    console.log(`  ${citizenIds.length} cidadãos, 1 admin, ${operatorIds.length} operadores, 1 viewer`);

    return { citizenIds, adminId, operatorIds, teamsBySlug };
}

function buildStatusPlan(totalCount) {
    const baseTotal = STATUS_DISTRIBUTION.reduce((sum, item) => sum + item.count, 0);
    const scale = totalCount / baseTotal;

    const plan = STATUS_DISTRIBUTION.map((item) => ({
        target: item.target,
        count: Math.round(item.count * scale),
    }));

    let planned = plan.reduce((sum, item) => sum + item.count, 0);
    const delta = totalCount - planned;
    if (delta !== 0) {
        const pending = plan.find((item) => item.target === 'pending');
        if (pending) {
            pending.count += delta;
        }
    }

    return plan;
}

async function insertComplaints(pool, tenant, citizenIds, totalCount) {
    console.log(`Inserindo ${totalCount} reclamações...`);

    const statusPlan = buildStatusPlan(totalCount);
    const statusTargets = [];
    for (const item of statusPlan) {
        for (let i = 0; i < item.count; i += 1) {
            statusTargets.push(item.target);
        }
    }
    while (statusTargets.length < totalCount) {
        statusTargets.push('pending');
    }
    while (statusTargets.length > totalCount) {
        statusTargets.pop();
    }

    const { rows: categories } = await pool.query(
        `SELECT id, slug FROM public.complaint_categories WHERE is_active = true`
    );
    const categoryBySlug = Object.fromEntries(categories.map((row) => [row.slug, row.id]));

    const inserted = [];

    for (let i = 0; i < totalCount; i += 1) {
        const categorySlug = pickWeightedCategory();
        const descriptions = DESCRIPTIONS[categorySlug] ?? DESCRIPTIONS.outros;
        const description = `${SEED_PREFIX} ${descriptions[i % descriptions.length]} (#${i + 1})`;
        const createdBy = citizenIds[i % citizenIds.length];

        const daysAgo = Math.floor(Math.random() * 60);
        const hoursAgo = Math.floor(Math.random() * 24);
        const occurrenceDate = new Date();
        occurrenceDate.setDate(occurrenceDate.getDate() - daysAgo);
        occurrenceDate.setHours(occurrenceDate.getHours() - hoursAgo);

        const pointRes = await pool.query(
            `SELECT
                s.cd_setor,
                ST_Y(ST_PointOnSurface(s.geometry)) AS lat,
                ST_X(ST_PointOnSurface(s.geometry)) AS lng
             FROM malhas.setores s
             WHERE s.cd_mun = $1
             ORDER BY random()
             LIMIT 1`,
            [tenant.cd_mun]
        );
        const point = pointRes.rows[0];
        const lat = String(point.lat);
        const lng = String(point.lng);

        const result = await pool.query(INSERT_COMPLAINT_WITH_GEO, [
            description,
            occurrenceDate.toISOString(),
            createdBy,
            categorySlug,
            `Campinas, SP — setor ${point.cd_setor}`,
            lat,
            lng,
        ]);

        const complaint = result.rows[0];
        const categoryId = categoryBySlug[categorySlug];

        const { rows: slaRows } = await pool.query(
            `SELECT resolution_hours
             FROM public.tenant_sla_policies
             WHERE tenant_id = $1 AND category_id = $2 AND is_active = true
             LIMIT 1`,
            [tenant.id, categoryId]
        );
        const resolutionHours = slaRows[0]?.resolution_hours ?? 72;

        const priority = Math.floor(Math.random() * 5) + 1;
        const slaVariant = Math.random();
        let slaOffsetHours = resolutionHours;

        if (slaVariant < 0.3) {
            slaOffsetHours = -Math.floor(Math.random() * 48 + 1);
        } else if (slaVariant < 0.55) {
            slaOffsetHours = Math.floor(Math.random() * 20 + 1);
        }

        await pool.query(
            `UPDATE public.complaints
             SET created_at = NOW() - ($1::text || ' days')::interval - ($2::text || ' hours')::interval,
                 occurrence_date = NOW() - ($1::text || ' days')::interval,
                 priority = $3,
                 sla_due_at = (NOW() - ($1::text || ' days')::interval) + ($4::text || ' hours')::interval
             WHERE id = $5`,
            [String(daysAgo), String(hoursAgo), priority, String(slaOffsetHours), complaint.id]
        );

        inserted.push({
            id: complaint.id,
            categorySlug,
            categoryId,
            targetStatus: statusTargets[i],
        });

        if ((i + 1) % 50 === 0) {
            console.log(`  ${i + 1}/${totalCount} reclamações inseridas`);
        }
    }

    return inserted;
}

async function applyWorkflow(pool, tenant, complaints, actors) {
    console.log('Aplicando workflow operacional...');

    const { adminId, operatorIds, teamsBySlug } = actors;
    let processed = 0;

    for (const complaint of complaints) {
        const { id, categorySlug, targetStatus } = complaint;

        try {
            if (targetStatus === 'pending') {
                processed += 1;
                continue;
            }

            if (targetStatus === 'cancelled') {
                await workflow.transitionStatus(pool, {
                    complaintId: id,
                    tenantId: tenant.id,
                    cdMun: tenant.cd_mun,
                    actorId: adminId,
                    toStatus: 'cancelled',
                    note: 'Cancelada na triagem inicial (seed).',
                    isInternal: true,
                });
                processed += 1;
                continue;
            }

            await workflow.transitionStatus(pool, {
                complaintId: id,
                tenantId: tenant.id,
                cdMun: tenant.cd_mun,
                actorId: adminId,
                toStatus: 'triaged',
                note: 'Triagem automática (seed).',
                isInternal: true,
            });

            if (targetStatus === 'triaged') {
                processed += 1;
                continue;
            }

            const teamSlug = TEAM_BY_CATEGORY[categorySlug] ?? 'triagem-geral';
            const teamId = teamsBySlug[teamSlug];
            const operator = operatorIds.find((item) => item.teamSlug === teamSlug);
            const assigneeId = teamSlug === 'triagem-geral'
                ? adminId
                : operator?.userId;

            await workflow.assignComplaint(pool, {
                complaintId: id,
                tenantId: tenant.id,
                cdMun: tenant.cd_mun,
                actorId: adminId,
                opsTeamId: teamId,
                userId: assigneeId,
                priority: Math.floor(Math.random() * 3) + 1,
                note: `Atribuída à equipe ${teamSlug} (seed).`,
                isInternal: true,
            });

            if (targetStatus === 'assigned') {
                processed += 1;
                continue;
            }

            if (['in_progress', 'resolved', 'closed'].includes(targetStatus)) {
                await workflow.transitionStatus(pool, {
                    complaintId: id,
                    tenantId: tenant.id,
                    cdMun: tenant.cd_mun,
                    actorId: assigneeId ?? adminId,
                    toStatus: 'in_progress',
                    note: 'Em atendimento pela equipe (seed).',
                    isInternal: true,
                });
            }

            if (targetStatus === 'in_progress') {
                processed += 1;
                continue;
            }

            if (['resolved', 'closed'].includes(targetStatus)) {
                await workflow.transitionStatus(pool, {
                    complaintId: id,
                    tenantId: tenant.id,
                    cdMun: tenant.cd_mun,
                    actorId: assigneeId ?? adminId,
                    toStatus: 'resolved',
                    note: 'Problema resolvido (seed).',
                    isInternal: false,
                });
            }

            if (targetStatus === 'closed') {
                await workflow.transitionStatus(pool, {
                    complaintId: id,
                    tenantId: tenant.id,
                    cdMun: tenant.cd_mun,
                    actorId: adminId,
                    toStatus: 'closed',
                    note: 'Ocorrência encerrada (seed).',
                    isInternal: true,
                });
            }

            processed += 1;
            if (processed % 25 === 0) {
                console.log(`  workflow: ${processed} ocorrências processadas`);
            }
        } catch (error) {
            console.error(`  Erro no workflow da ocorrência #${id} (${targetStatus}):`, error.message);
        }
    }

    console.log(`  Workflow aplicado em ${processed} ocorrências`);
}

async function printSummary(pool, tenant) {
    const { rows: stats } = await pool.query(
        `SELECT
            COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE COALESCE(status, 'pending') = 'pending')::int AS pending,
            COUNT(*) FILTER (WHERE status = 'triaged')::int AS triaged,
            COUNT(*) FILTER (WHERE status = 'assigned')::int AS assigned,
            COUNT(*) FILTER (WHERE status = 'in_progress')::int AS in_progress,
            COUNT(*) FILTER (WHERE status = 'resolved')::int AS resolved,
            COUNT(*) FILTER (WHERE status = 'closed')::int AS closed,
            COUNT(*) FILTER (WHERE status = 'cancelled')::int AS cancelled,
            COUNT(*) FILTER (WHERE cd_setor IS NOT NULL)::int AS with_setor,
            COUNT(*) FILTER (WHERE assigned_ops_team_id IS NOT NULL)::int AS with_team,
            COUNT(*) FILTER (WHERE assigned_user_id IS NOT NULL)::int AS with_assignee
         FROM public.complaints
         WHERE description LIKE $1`,
        [`${SEED_PREFIX}%`]
    );

    const { rows: events } = await pool.query(
        `SELECT COUNT(*)::int AS total
         FROM public.complaint_events ce
         JOIN public.complaints c ON c.id = ce.complaint_id
         WHERE c.description LIKE $1`,
        [`${SEED_PREFIX}%`]
    );

    const { rows: users } = await pool.query(
        `SELECT COUNT(*)::int AS total FROM public.users WHERE email LIKE $1`,
        [`%${SEED_DOMAIN}`]
    );

    console.log('\n--- Resumo do seed ---');
    console.log(`Tenant: ${tenant.display_name} (${tenant.slug})`);
    console.log(`Usuários seed: ${users[0].total}`);
    console.log(`Reclamações seed: ${stats[0].total}`);
    console.log(`  pending=${stats[0].pending} triaged=${stats[0].triaged} assigned=${stats[0].assigned}`);
    console.log(`  in_progress=${stats[0].in_progress} resolved=${stats[0].resolved} closed=${stats[0].closed} cancelled=${stats[0].cancelled}`);
    console.log(`  com cd_setor=${stats[0].with_setor} com equipe=${stats[0].with_team} com responsável=${stats[0].with_assignee}`);
    console.log(`Eventos de workflow: ${events[0].total}`);
    console.log('\nCredenciais (todos os usuários seed):');
    console.log(`  Senha: ${DEFAULT_PASSWORD}`);
    console.log(`  Admin:  seed-admin${SEED_DOMAIN}`);
    console.log(`  Operadores: seed-operator-obras${SEED_DOMAIN}, seed-operator-limpeza${SEED_DOMAIN}, ...`);
    console.log(`  Cidadãos: seed-citizen-01${SEED_DOMAIN} ... seed-citizen-15${SEED_DOMAIN}`);
    console.log(`\nLimpar: node scripts/seed-campinas-demo.js --cleanup`);
}

async function main() {
    const { count, cleanup } = parseArgs();
    const pool = await supabasePool.getPgPool();

    if (cleanup) {
        await cleanupSeed(pool);
        await supabasePool.closePgPool();
        return;
    }

    const tenantRes = await pool.query(
        `SELECT id, cd_mun, slug, display_name
         FROM public.tenants
         WHERE slug = 'campinas'`
    );
    if (tenantRes.rows.length === 0) {
        throw new Error('Tenant Campinas não encontrado. Rode as migrations primeiro.');
    }
    const tenant = tenantRes.rows[0];

    const existing = await pool.query(
        `SELECT COUNT(*)::int AS total FROM public.complaints WHERE description LIKE $1`,
        [`${SEED_PREFIX}%`]
    );
    if (existing.rows[0].total > 0) {
        console.log(`Já existem ${existing.rows[0].total} reclamações seed.`);
        console.log('Execute com --cleanup antes de rodar novamente.');
        await supabasePool.closePgPool();
        process.exit(1);
    }

    const actors = await createSeedUsers(pool, tenant);
    const complaints = await insertComplaints(pool, tenant, actors.citizenIds, count);
    await applyWorkflow(pool, tenant, complaints, actors);
    await printSummary(pool, tenant);

    await supabasePool.closePgPool();
}

main().catch((error) => {
    console.error('Seed falhou:', error);
    process.exit(1);
});
