require('dotenv').config();
const supabasePool = require('../src/infra/supabasePool');
const workflow = require('../src/services/complaintWorkflowService');

(async () => {
    const pool = await supabasePool.getPgPool();
    const tenantRes = await pool.query(
        "SELECT id, cd_mun FROM tenants WHERE slug = 'campinas'"
    );
    const tenant = tenantRes.rows[0];

    const adminRes = await pool.query(
        `SELECT u.id FROM users u
         JOIN tenant_members tm ON tm.user_id = u.id
         WHERE tm.tenant_id = $1 AND tm.role = 'admin'
         LIMIT 1`,
        [tenant.id]
    );
    const admin = adminRes.rows[0];

    const complaintRes = await pool.query(
        'SELECT id FROM complaints ORDER BY id LIMIT 1'
    );
    const complaint = complaintRes.rows[0];

    if (!complaint) {
        console.log('no complaints');
        process.exit(0);
    }

    const r1 = await workflow.transitionStatus(pool, {
        complaintId: complaint.id,
        tenantId: tenant.id,
        cdMun: tenant.cd_mun,
        actorId: admin.id,
        toStatus: 'triaged',
        note: 'Teste triagem 4a',
        isInternal: true,
    });
    console.log('status->triaged', r1.complaint.status, r1.complaint.slaState);

    const teamsRes = await pool.query(
        `SELECT id, name FROM ops_teams
         WHERE tenant_id = $1 AND slug = 'obras'`,
        [tenant.id]
    );
    const teams = teamsRes.rows[0];

    const r2 = await workflow.assignComplaint(pool, {
        complaintId: complaint.id,
        tenantId: tenant.id,
        cdMun: tenant.cd_mun,
        actorId: admin.id,
        opsTeamId: teams.id,
        isInternal: true,
    });
    console.log('assigned', r2.complaint.status, r2.complaint.assigned_ops_team_id);

    const events = await workflow.listEvents(pool, complaint.id, tenant.id, tenant.cd_mun, {
        includeInternal: true,
    });
    console.log('events', events.length);
    console.log('municipal lock', workflow.isUnderMunicipalManagement(r2.complaint));

    await pool.query(
        `UPDATE complaints
         SET status = 'pending',
             assigned_ops_team_id = NULL,
             assigned_user_id = NULL,
             assigned_at = NULL,
             sla_due_at = created_at + interval '72 hours'
         WHERE id = $1`,
        [complaint.id]
    );
    await pool.query('DELETE FROM complaint_events WHERE complaint_id = $1', [
        complaint.id,
    ]);
    console.log('rollback ok');
    process.exit(0);
})().catch((e) => {
    console.error(e);
    process.exit(1);
});
