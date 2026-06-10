-- ADR-003 Fase 4a: seed equipes operacionais + SLA — tenant Campinas

-- Equipes operacionais
INSERT INTO public.ops_teams (tenant_id, name, slug, description, default_category_ids)
SELECT
  t.id,
  v.name,
  v.slug,
  v.description,
  v.category_ids
FROM public.tenants t
CROSS JOIN (
  VALUES
    (
      'Triagem Geral',
      'triagem-geral',
      'Recepção e encaminhamento inicial de ocorrências.',
      ARRAY[]::uuid[]
    ),
    (
      'Secretaria de Obras',
      'obras',
      'Infraestrutura urbana, vias e calçadas.',
      ARRAY(SELECT id FROM public.complaint_categories WHERE slug = 'infraestrutura')
    ),
    (
      'Defesa Civil / Segurança',
      'seguranca',
      'Situações de risco e segurança pública.',
      ARRAY(SELECT id FROM public.complaint_categories WHERE slug = 'seguranca')
    ),
    (
      'Limpeza Urbana',
      'limpeza',
      'Coleta, entulho e limpeza de vias.',
      ARRAY(SELECT id FROM public.complaint_categories WHERE slug = 'limpeza')
    ),
    (
      'Trânsito e Mobilidade',
      'transito',
      'Sinalização, trânsito e mobilidade urbana.',
      ARRAY(SELECT id FROM public.complaint_categories WHERE slug = 'transito')
    )
) AS v(name, slug, description, category_ids)
WHERE t.slug = 'campinas'
ON CONFLICT (tenant_id, slug) DO NOTHING;

-- Políticas SLA default
INSERT INTO public.tenant_sla_policies (tenant_id, category_id, response_hours, resolution_hours)
SELECT t.id, cat.id, v.response_hours, v.resolution_hours
FROM public.tenants t
CROSS JOIN public.complaint_categories cat
JOIN (
  VALUES
    ('seguranca', 4, 24),
    ('infraestrutura', 24, 72),
    ('limpeza', 24, 48),
    ('transito', 24, 72),
    ('outros', 48, 120)
) AS v(slug, response_hours, resolution_hours) ON v.slug = cat.slug
WHERE t.slug = 'campinas'
ON CONFLICT (tenant_id, category_id) DO NOTHING;

-- Vincular admins/owners do tenant à equipe Triagem Geral
INSERT INTO public.ops_team_members (ops_team_id, user_id, role)
SELECT ot.id, tm.user_id, 'lead'::public.ops_team_role
FROM public.ops_teams ot
JOIN public.tenant_members tm ON tm.tenant_id = ot.tenant_id AND tm.is_active
WHERE ot.slug = 'triagem-geral'
  AND ot.tenant_id = (SELECT id FROM public.tenants WHERE slug = 'campinas')
  AND tm.role IN ('admin', 'owner')
ON CONFLICT (ops_team_id, user_id) DO NOTHING;

-- Backfill sla_due_at para ocorrências abertas do tenant Campinas
UPDATE public.complaints c
SET sla_due_at = c.created_at + (pol.resolution_hours || ' hours')::interval
FROM public.tenants t
JOIN public.tenant_sla_policies pol ON pol.tenant_id = t.id AND pol.is_active
WHERE t.slug = 'campinas'
  AND c.sla_due_at IS NULL
  AND COALESCE(c.status, 'pending') NOT IN ('resolved', 'closed', 'cancelled')
  AND (
    c.tenant_id = t.id
    OR (c.tenant_id IS NULL AND c.cd_mun = t.cd_mun)
  )
  AND pol.category_id = c.category_id;
