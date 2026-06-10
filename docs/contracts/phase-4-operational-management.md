# Contrato de implementação — Fase 4: Gestão operacional de ocorrências

| Campo | Valor |
|-------|-------|
| **ADR** | [ADR-003](../adr/ADR-003-gestao-operacional-ocorrencias.md) |
| **Status** | Aguardando Fase 2 concluída + ADR-002 aplicado |
| **Pré-requisito** | Fases 1–2 aplicadas; `tenant_members` ativo; migrations `012`/`013` (categorias) |
| **Bloqueia** | Nenhuma fase posterior obrigatória (Fase 3 Flutter é independente) |

---

## 1. Objetivo

Entregar **gestão operacional municipal** no admin-web: fila de ocorrências, workflow de status, atribuição a equipes operacionais (`ops_teams`), SLA por categoria, audit trail e notificações ao cidadão. App Flutter **permanece inalterado** nas sub-fases 4a e 4b; alterações opcionais apenas na 4c.

---

## 2. Sub-fases

```
Fase 4a ──► Fase 4b ──► Fase 4c
  DB+API      Inbox UI    Equipes+SLA+Moderação
```

| Sub-fase | Entrega principal | Flutter |
|----------|-------------------|---------|
| **4a** | Migrations + serviços operacionais + endpoints mutáveis admin | Sem mudanças |
| **4b** | `/admin/inbox` + gestão ativa em `ComplaintDetailPage` + KPIs SLA no dashboard | Sem mudanças |
| **4c** | CRUD equipes/SLA + roteamento automático + moderação + export CSV | Opcional |

---

## 3. Escopo

### 3.1 Incluído

**Fase 4a — Backend + banco**
- Migrations: `ops_teams`, `ops_team_members`, `complaint_events`, `tenant_sla_policies`, colunas operacionais em `complaints`
- Enum `ops_team_role` (`lead`, `member`)
- Middleware `requireTenantRole(minRole)`
- Serviço `complaintWorkflowService` (transições, SLA, eventos, notificações)
- Endpoints mutáveis em `/api/admin/*`
- Seed Campinas: equipes operacionais + políticas SLA default
- Regra de conflito cidadão vs. admin (ver §5.4)

**Fase 4b — admin-web operacional**
- Página `/admin/inbox` (fila paginada + filtros)
- Ativar card **Gestão** em `ComplaintDetailPage` (status, atribuição, notas, timeline)
- Extensão de `/analytics/summary` com KPIs operacionais
- Widgets SLA no dashboard
- Nav sidebar: Inbox + link do popup do mapa

**Fase 4c — Configuração e moderação**
- CRUD `/admin/teams` (equipes operacionais)
- `/admin/settings/sla` (políticas por categoria)
- Roteamento automático na triagem/atribuição
- `/admin/moderation` (fila `reports`)
- `GET /api/admin/complaints/export` (CSV)
- `GET /api/admin/analytics/operations`

### 3.2 Excluído

- Reutilizar `teams` / `team_members` (gamificação cidadã)
- Integração 156 / gov.br / ERP
- App de campo para agentes
- Chat prefeitura ↔ cidadão
- CRUD de categorias por tenant
- RLS Supabase
- Horário comercial / feriados no cálculo SLA (flag `business_hours_only` existe, lógica fica para ADR futuro)
- Alterações obrigatórias no Flutter

---

## 4. Invariantes

1. Endpoints `/api/auth/*` e rotas app (`/api/complaints/create`, etc.) **inalterados** em contrato, exceto regra §5.4 na rota cidadão de status.
2. Toda mutação operacional passa por `/api/admin/*` com JWT tenant + `requireTenantMember`.
3. Rotas mutáveis exigem `tenantRole` ≥ `operator` (`viewer` → 403).
4. Configuração (equipes, SLA) exige `tenantRole` ≥ `admin`.
5. **`teams` ≠ `ops_teams`** — nunca JOIN ou alias entre domínios.
6. `complaint_events` com `is_internal = true` **nunca** expostos em APIs do app cidadão.
7. Toda alteração admin de status/atribuição/prioridade gera registro em `complaint_events`.
8. MCP Supabase: DDL/DML via `backend/migrations/` — não via MCP.
9. Timestamps calculados no SQL (`NOW() + INTERVAL`) — nunca passar `Date` JS para colunas `timestamp without time zone` (armadilha ADR-001).
10. Filtro tenant em ocorrências: reutilizar `TENANT_COMPLAINT_FILTER` de `tenantService.js`.

---

## 5. Regras de negócio

### 5.1 Máquina de estados (admin)

Status canônicos:

| Status | Terminal | Label UI (pt-BR) |
|--------|----------|------------------|
| `pending` | não | Pendente |
| `triaged` | não | Em análise |
| `assigned` | não | Atribuída |
| `in_progress` | não | Em andamento |
| `resolved` | não* | Resolvida |
| `closed` | sim | Encerrada |
| `cancelled` | sim | Cancelada |
| `reopened` | não | Reaberta |

\* `resolved` pode transicionar para `closed` ou `reopened`.

Transições permitidas (admin):

```
pending    → triaged | assigned | in_progress | cancelled
triaged    → assigned | in_progress | cancelled
assigned   → in_progress | cancelled | triaged
in_progress→ resolved | cancelled | assigned
resolved   → closed | reopened
closed     → reopened
reopened   → triaged | assigned | in_progress | cancelled
cancelled  → (nenhuma — apenas admin owner pode reopen via reopened)
```

Implementação: mapa `ALLOWED_TRANSITIONS` no serviço; transição inválida → `400`.

### 5.2 SLA

- `sla_due_at` = `created_at + resolution_hours` da política do tenant para `category_id` da ocorrência.
- Recalcular em: triagem (`pending` → `triaged`), atribuição, reabertura.
- `resolved_at` preenchido ao entrar em `resolved`; `closed_at` ao entrar em `closed`.
- Flag analítica `sla_breached`: `sla_due_at < NOW()` AND status NOT IN (`resolved`, `closed`, `cancelled`).
- MVP: horas corridas (ignorar `business_hours_only`).

Defaults seed Campinas:

| slug categoria | response_hours | resolution_hours |
|----------------|----------------|------------------|
| seguranca | 4 | 24 |
| infraestrutura | 24 | 72 |
| limpeza | 24 | 48 |
| transito | 24 | 72 |
| outros | 48 | 120 |

### 5.3 Roteamento automático (4c)

Ordem de resolução quando `assigned_ops_team_id` é nulo:

1. Equipe ativa do tenant cujo `default_category_ids` contém `complaints.category_id`
2. Equipe ativa cujo `default_cd_bairros` contém `complaints.cd_bairro`
3. Equipe fallback `slug = 'triagem-geral'` do tenant

Operador pode sobrescrever via PATCH assignment.

### 5.4 Conflito cidadão vs. prefeitura

**Decisão contratual:** após a prefeitura atribuir a ocorrência (`assigned_ops_team_id IS NOT NULL` **ou** status ∈ `assigned`, `in_progress`, `closed`, `cancelled`), o cidadão autor **não pode** alterar status via `PATCH /api/complaints/:id/status`.

Resposta: `403` com `{ "message": "Ocorrência em gestão pela prefeitura." }`.

Cidadão continua podendo editar descrição/fotos enquanto `pending`/`triaged` sem atribuição (comportamento existente).

### 5.5 Notificações

Ao transicionar status via admin (exceto notas internas):

```sql
INSERT INTO notifications (user_id, actor_id, type, reference_type, reference_id)
VALUES ($created_by, $actor_id, 'complaint_status', 'complaint', $complaint_id::text);
```

Não incluir notas internas nem PII do servidor na notificação.

### 5.6 Visibilidade operador vs. admin

| Papel | Escopo inbox default |
|-------|---------------------|
| `viewer` | Todas do tenant (read-only) |
| `operator` | Não atribuídas OU atribuídas a equipe da qual é membro (`ops_team_members`) |
| `admin` / `owner` | Todas do tenant |

Query param `scope=all` disponível para `admin+` ignorar filtro de equipe.

---

## 6. Entregáveis SQL (Fase 4a)

Arquivos em `backend/migrations/`:

| Arquivo | Conteúdo |
|---------|----------|
| `014_ops_teams.sql` | Enum `ops_team_role`, tabelas `ops_teams`, `ops_team_members` |
| `015_complaint_events.sql` | Tabela `complaint_events` + índices |
| `016_complaints_operational_columns.sql` | Colunas operacionais em `complaints` |
| `017_tenant_sla_policies.sql` | Tabela `tenant_sla_policies` |
| `018_seed_campinas_ops.sql` | Equipes + SLA + equipe fallback `triagem-geral` |

### 6.1 `014_ops_teams.sql` (resumo)

```sql
CREATE TYPE ops_team_role AS ENUM ('lead', 'member');

CREATE TABLE public.ops_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name varchar(100) NOT NULL,
  slug text NOT NULL,
  description text,
  default_category_ids uuid[] NOT NULL DEFAULT '{}',
  default_cd_bairros varchar[] NOT NULL DEFAULT '{}',
  contact_email text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, slug)
);

CREATE TABLE public.ops_team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ops_team_id uuid NOT NULL REFERENCES public.ops_teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role ops_team_role NOT NULL DEFAULT 'member',
  is_active boolean NOT NULL DEFAULT true,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ops_team_id, user_id)
);

CREATE INDEX idx_ops_teams_tenant ON public.ops_teams (tenant_id) WHERE is_active;
CREATE INDEX idx_ops_team_members_user ON public.ops_team_members (user_id) WHERE is_active;
```

Validação na camada de serviço: `ops_team_members.user_id` deve ter `tenant_members` ativo no mesmo `tenant_id` da equipe.

### 6.2 `015_complaint_events.sql` (resumo)

```sql
CREATE TABLE public.complaint_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id bigint NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  event_type varchar(50) NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  is_internal boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (event_type IN (
    'status_change', 'assignment', 'note', 'priority_change', 'sla_breach', 'moderation'
  ))
);

CREATE INDEX idx_complaint_events_complaint
  ON public.complaint_events (complaint_id, created_at DESC);
CREATE INDEX idx_complaint_events_tenant
  ON public.complaint_events (tenant_id, created_at DESC);
```

### 6.3 `016_complaints_operational_columns.sql` (resumo)

```sql
ALTER TABLE public.complaints
  ADD COLUMN IF NOT EXISTS assigned_ops_team_id uuid REFERENCES public.ops_teams(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_at timestamptz,
  ADD COLUMN IF NOT EXISTS priority smallint NOT NULL DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS sla_due_at timestamptz,
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS closed_at timestamptz;

CREATE INDEX idx_complaints_assigned_team ON public.complaints (assigned_ops_team_id);
CREATE INDEX idx_complaints_sla_due ON public.complaints (sla_due_at) WHERE sla_due_at IS NOT NULL;
CREATE INDEX idx_complaints_status_tenant ON public.complaints (tenant_id, status);
```

Expandir CHECK ou documentar status válidos na camada de serviço (não alterar default `pending`).

### 6.4 `017_tenant_sla_policies.sql` (resumo)

```sql
CREATE TABLE public.tenant_sla_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.complaint_categories(id) ON DELETE CASCADE,
  response_hours integer NOT NULL CHECK (response_hours > 0),
  resolution_hours integer NOT NULL CHECK (resolution_hours > 0),
  business_hours_only boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  UNIQUE (tenant_id, category_id)
);
```

---

## 7. Contrato de API

Base mutável: `{API_BASE}/api/admin` — headers `Authorization: Bearer {token}`

Middleware stack mutável: `authenticateToken` → `requireTenantMember` → `requireTenantRole('operator')` (ou `'admin'` para config).

### 7.1 Inbox

**GET `/complaints/inbox`**

Query params:

| Param | Tipo | Descrição |
|-------|------|-----------|
| `status` | string | CSV de status |
| `category` | string | slug categoria |
| `opsTeamId` | uuid | filtro equipe |
| `assignedToMe` | boolean | equipe(s) do user logado |
| `sla` | `at_risk` \| `breached` \| `ok` | filtro SLA |
| `priority` | 1–5 | prioridade |
| `cd_bairro` | string | bairro |
| `q` | string | busca em id, endereço, descrição |
| `scope` | `mine` \| `all` | default `mine` para operator, `all` para admin |
| `page` | int | default 1 |
| `pageSize` | int | default 25, max 100 |
| `sort` | `created_at` \| `sla_due_at` \| `priority` | default `created_at` |
| `order` | `asc` \| `desc` | default `desc` |

Response:

```json
{
  "items": [
    {
      "id": 42,
      "category": "infraestrutura",
      "categoryName": "Infraestrutura",
      "categoryColor": "#E65100",
      "status": "pending",
      "priority": 3,
      "address": "Rua Exemplo, 100",
      "created_at": "2026-06-01T14:00:00.000Z",
      "sla_due_at": "2026-06-04T14:00:00.000Z",
      "slaState": "at_risk",
      "assignedOpsTeamId": null,
      "assignedOpsTeamName": null,
      "assignedUserName": null,
      "cd_bairro": "12345",
      "bairroName": "Centro"
    }
  ],
  "pagination": { "page": 1, "pageSize": 25, "total": 120, "totalPages": 5 }
}
```

`slaState`: `ok` | `at_risk` (due < now+24h) | `breached` (due < now, não terminal).

### 7.2 Detalhe estendido

**GET `/complaints/:id`** — response existente + campos:

```json
{
  "complaint": {
    "id": 42,
    "status": "assigned",
    "priority": 2,
    "sla_due_at": "2026-06-04T14:00:00.000Z",
    "slaState": "ok",
    "assigned_ops_team_id": "uuid",
    "assigned_ops_team_name": "Secretaria de Obras",
    "assigned_user_id": "uuid",
    "assigned_user_name": "João Silva",
    "assigned_at": "2026-06-02T10:00:00.000Z",
    "resolved_at": null,
    "closed_at": null
  },
  "photos": []
}
```

### 7.3 Transição de status

**PATCH `/complaints/:id/status`**

Body:

```json
{
  "status": "in_progress",
  "note": "Equipe despachada para o local.",
  "isInternal": false
}
```

Response `200`:

```json
{
  "complaint": { "id": 42, "status": "in_progress", "resolved_at": null, "closed_at": null, "sla_due_at": "..." },
  "event": { "id": "uuid", "event_type": "status_change", "created_at": "..." }
}
```

Erros: `400` transição inválida; `404` ocorrência fora do tenant; `403` role insuficiente.

Efeitos colaterais:
- Insert `complaint_events` (`status_change`)
- Insert `notifications` se `!isInternal` e status mudou
- Atualizar `resolved_at` / `closed_at` conforme status destino
- Disparar roteamento automático se transição for `triaged` ou `assigned` sem equipe (4c)

### 7.4 Atribuição

**PATCH `/complaints/:id/assignment`**

Body (campos opcionais, pelo menos um obrigatório):

```json
{
  "opsTeamId": "uuid",
  "userId": "uuid",
  "priority": 2,
  "note": "Encaminhado para obras.",
  "isInternal": true
}
```

Response `200`: complaint atualizado + event `assignment`.

Regras:
- `opsTeamId` deve pertencer ao tenant
- `userId` deve ser membro da equipe (se ambos informados) e ter `tenant_members` ativo
- Setar `assigned_at = NOW()` quando equipe ou user mudar
- Se status era `pending`/`triaged`, pode auto-transicionar para `assigned` (configurável no serviço, default **sim**)

### 7.5 Notas

**POST `/complaints/:id/notes`**

Body:

```json
{
  "text": "Verificado in loco — aguardando material.",
  "isInternal": true
}
```

Response `201`: `{ "event": { "id": "uuid", "event_type": "note", ... } }`

Notas internas **não** geram notificação ao cidadão.

### 7.6 Timeline

**GET `/complaints/:id/events`**

Query: `includeInternal=true` (default true para admin/operator; false omitiria notas internas — útil se no futuro houver portal cidadão)

Response:

```json
{
  "events": [
    {
      "id": "uuid",
      "event_type": "status_change",
      "payload": { "from": "pending", "to": "triaged", "note": "..." },
      "is_internal": false,
      "actor_name": "Maria Admin",
      "created_at": "2026-06-02T09:00:00.000Z"
    }
  ]
}
```

### 7.7 Equipes operacionais (4c)

| Método | Rota | Role min | Descrição |
|--------|------|----------|-----------|
| GET | `/ops-teams` | operator | Lista equipes do tenant |
| POST | `/ops-teams` | admin | Criar equipe |
| PATCH | `/ops-teams/:id` | admin | Atualizar equipe |
| GET | `/ops-teams/:id/members` | operator | Membros |
| POST | `/ops-teams/:id/members` | admin | Body `{ "userId", "role" }` |
| DELETE | `/ops-teams/:id/members/:userId` | admin | Remover membro |

Tipo `OpsTeam`:

```typescript
type OpsTeam = {
  id: string
  name: string
  slug: string
  description: string | null
  defaultCategoryIds: string[]
  defaultCdBairros: string[]
  contactEmail: string | null
  isActive: boolean
  memberCount: number
}
```

### 7.8 SLA (4c)

| Método | Rota | Role | Descrição |
|--------|------|------|-----------|
| GET | `/sla-policies` | admin | Lista políticas do tenant |
| PUT | `/sla-policies` | admin | Upsert batch (array de policies) |

Body PUT:

```json
{
  "policies": [
    {
      "categoryId": "uuid",
      "responseHours": 24,
      "resolutionHours": 72,
      "isActive": true
    }
  ]
}
```

### 7.9 Analytics operacionais (4c)

**GET `/analytics/operations`**

Response:

```json
{
  "backlog": 85,
  "slaAtRisk": 12,
  "slaBreached": 5,
  "avgResolutionHours": 36.5,
  "avgTriagemHours": 4.2,
  "byTeam": [
    {
      "opsTeamId": "uuid",
      "name": "Secretaria de Obras",
      "backlog": 20,
      "resolvedLast7Days": 8,
      "slaCompliancePercent": 87.5
    }
  ],
  "byStatus": [
    { "status": "pending", "count": 40 }
  ]
}
```

**GET `/analytics/summary`** (extensão 4b) — campos adicionais retrocompatíveis:

```json
{
  "total": 120,
  "pending": 85,
  "last7Days": 12,
  "distinctCategories": 4,
  "coverage": { "bairrosLoaded": true, "setoresLoaded": true },
  "operational": {
    "backlog": 85,
    "slaAtRisk": 12,
    "slaBreached": 5
  }
}
```

### 7.10 Moderação (4c)

**GET `/moderation/reports`**

Query: `status=pending`, `page`, `pageSize`

**POST `/moderation/reports/:id/resolve`**

Body: `{ "action": "hide_complaint" | "dismiss", "note": "..." }`

Ação `hide_complaint`: `complaints.is_hidden = true` + evento `moderation`.

### 7.11 Export (4c)

**GET `/complaints/export`**

Query: mesmos filtros do inbox. Response: `text/csv` com colunas id, status, categoria, bairro, criada_em, sla_due_at, equipe, prioridade.

---

## 8. Contrato UI — admin-web

### 8.1 Navegação (sidebar)

```
Dashboard
Inbox          ← novo (4b)
Equipes        ← novo (4c)
SLA            ← novo (4c), sub-item ou /admin/settings/sla
Moderação      ← novo (4c), badge contagem pending
Minha conta
```

### 8.2 Inbox (`/admin/inbox`) — wireframe

```
┌─────────────────────────────────────────────────────────────────┐
│ Inbox de ocorrências                    [Export CSV] (4c)      │
├─────────────────────────────────────────────────────────────────┤
│ Filtros: [Status ▼] [Categoria ▼] [Equipe ▼] [SLA ▼] [Busca…]  │
├──────┬──────────────┬──────────┬─────────┬──────────┬───────────┤
│ ID   │ Categoria    │ Status   │ SLA     │ Bairro   │ Criada    │
├──────┼──────────────┼──────────┼─────────┼──────────┼───────────┤
│ #42  │ ● Infra      │ Pendente │ ⚠ 6h    │ Centro   │ 01/06     │
│ #41  │ ● Limpeza    │ Atrib.   │ ✓ OK    │ Nova Camp│ 31/05     │
└──────┴──────────────┴──────────┴─────────┴──────────┴───────────┘
│ ◀ 1 2 3 ▶                                      25 por página     │
└─────────────────────────────────────────────────────────────────┘
```

- Clique na linha → `/admin/complaints/:id`
- Badge SLA: verde OK, amarelo at_risk, vermelho breached
- Cor da categoria via `complaint_categories.color_hex`

### 8.3 Detalhe — card Gestão (4b)

Substituir placeholder em `ComplaintDetailPage.tsx`:

```
┌─ Gestão ─────────────────────────────────────────────┐
│ Status: [Em andamento ▼]    Prioridade: [3 ▼]        │
│ Equipe: [Secretaria de Obras ▼]                      │
│ Responsável: [João Silva ▼] (opcional)               │
│ [Salvar alterações]                                   │
├───────────────────────────────────────────────────────┤
│ Nota: [________________________________]              │
│ ( ) Nota interna   [Registar nota]                    │
├───────────────────────────────────────────────────────┤
│ Timeline                                              │
│ ● 02/06 10:00 — Maria — Status: pending → assigned   │
│ ● 02/06 09:30 — Maria — Nota interna: "Verificado…"  │
└───────────────────────────────────────────────────────┘
```

Permissões UI:
- `viewer`: campos desabilitados, timeline visível (notas internas ocultas)
- `operator+`: edição habilitada

### 8.4 Dashboard — widgets operacionais (4b)

Adicionar abaixo dos KPI cards existentes ou segunda linha:

| Widget | Fonte |
|--------|-------|
| Backlog operacional | `summary.operational.backlog` |
| SLA em risco | `summary.operational.slaAtRisk` |
| SLA estourado | `summary.operational.slaBreached` |
| Link "Ver inbox" | `/admin/inbox?sla=at_risk` |

### 8.5 Equipes (`/admin/teams`) — 4c

Lista + modal criar/editar + gestão de membros (select users com tenant_members).

### 8.6 SLA (`/admin/settings/sla`) — 4c

Tabela editável: uma linha por categoria ativa do catálogo global.

---

## 9. Estrutura de arquivos

### Backend (4a+)

```
backend/
  migrations/
    014_ops_teams.sql
    015_complaint_events.sql
    016_complaints_operational_columns.sql
    017_tenant_sla_policies.sql
    018_seed_campinas_ops.sql
  src/
    middleware/
      requireTenantRole.js
    services/
      complaintWorkflowService.js
      opsTeamService.js
      slaService.js
    controllers/admin/
      adminComplaintsController.js   # estender
      opsTeamsController.js
      slaPoliciesController.js
      moderationController.js
      analyticsController.js         # estender
    routes/
      adminRoutes.js                 # estender
```

### admin-web (4b+)

```
admin-web/src/
  api/admin/
    inbox.ts
    complaintOperations.ts
    opsTeams.ts
    slaPolicies.ts
    moderation.ts
  components/
    inbox/
      InboxTable.tsx
      InboxFilters.tsx
      SlaBadge.tsx
    complaints/
      ComplaintManagementPanel.tsx
      ComplaintTimeline.tsx
    operations/
      OpsKpiCards.tsx
    teams/
      OpsTeamForm.tsx
      OpsTeamList.tsx
    sla/
      SlaPolicyEditor.tsx
  pages/
    InboxPage.tsx
    OpsTeamsPage.tsx
    SlaSettingsPage.tsx
    ModerationPage.tsx
    ComplaintDetailPage.tsx    # integrar ComplaintManagementPanel
    DashboardPage.tsx          # widgets operacionais
  utils/
    format.ts                  # estender status triaged, assigned, reopened
  App.tsx                      # novas rotas
  layout/AdminLayout.tsx       # nav links
```

---

## 10. Prompt EXPLORE (Fase 4)

```
Contexto: LifeCity ADR-003 Fase 4. Fases 1–2 concluídas.

Explore:
1. MCP SELECT: complaints status distribution, tenant Campinas, complaint_categories
2. Ler backend: adminComplaintsController, complaintController.updateStatus, tenantService
3. Ler admin-web: ComplaintDetailPage (card Gestão), DashboardPage, format.ts status labels
4. Confirmar que teams/team_members são gamificação — não reutilizar
5. Verificar se notifications.type 'complaint_status' já é tratado no Flutter
6. Ler docs/contracts/phase-4-operational-management.md

Reportar: ordem de migrations, endpoints a criar, conflitos com updateStatus cidadão, gaps UI.
Não implementar ainda.
```

---

## 11. Prompt EXECUTE (Fase 4a)

```
Contexto: LifeCity ADR-003 Fase 4a. Contrato: docs/contracts/phase-4-operational-management.md
Rules: lifecity-multi-tenant + ADR-003

Execute em ordem:
1. Migrations 014–018 em backend/migrations/
2. requireTenantRole middleware
3. complaintWorkflowService (transições, events, SLA, notifications)
4. Endpoints PATCH status, PATCH assignment, POST notes, GET events, GET inbox
5. Ajustar complaintController.updateStatus — bloquear se em gestão prefeitura (§5.4)
6. Estender GET /complaints/:id com campos operacionais
7. Seed Campinas ops teams + SLA
8. NÃO alterar lib/ (Flutter)
9. NÃO alterar POST /api/complaints/create

Testes: seção 12 deste contrato (4a).
```

---

## 12. Prompt EXECUTE (Fase 4b)

```
Contexto: LifeCity ADR-003 Fase 4b. Fase 4a concluída.

Execute:
1. API clients inbox.ts + complaintOperations.ts
2. InboxPage + componentes (tabela, filtros, SlaBadge)
3. ComplaintManagementPanel + ComplaintTimeline no ComplaintDetailPage
4. Estender format.ts com novos status
5. OpsKpiCards no DashboardPage + summary.operational
6. Nav Inbox no AdminLayout; link popup mapa → detalhe/inbox
7. npm run build admin-web sem erros

Testes: seção 13 (4b UI checklist).
RBAC: viewer read-only no painel de gestão.
```

---

## 13. Prompt EXECUTE (Fase 4c)

```
Contexto: LifeCity ADR-003 Fase 4c. Fases 4a–4b concluídas.

Execute:
1. opsTeamsController + slaPoliciesController + moderationController
2. Rotas CRUD ops-teams, PUT sla-policies, moderation, export CSV
3. analytics/operations endpoint
4. Roteamento automático no complaintWorkflowService
5. OpsTeamsPage, SlaSettingsPage, ModerationPage
6. Export CSV na InboxPage

Testes: seção 14 (4c).
```

---

## 14. Testes de validação

### 14.1 Fase 4a — Backend

```bash
# Login admin
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"ADMIN","password":"..."}' | jq -r .accessToken)

# Inbox
curl "http://localhost:3000/api/admin/complaints/inbox?page=1" \
  -H "Authorization: Bearer $TOKEN"

# Transição status
curl -X PATCH "http://localhost:3000/api/admin/complaints/1/status" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"triaged","note":"Triagem inicial"}'

# Timeline
curl "http://localhost:3000/api/admin/complaints/1/events" \
  -H "Authorization: Bearer $TOKEN"

# Viewer não muta → 403
curl -X PATCH "http://localhost:3000/api/admin/complaints/1/status" \
  -H "Authorization: Bearer $VIEWER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"assigned"}'
```

```sql
-- Evento registrado
SELECT event_type, payload FROM complaint_events
WHERE complaint_id = 1 ORDER BY created_at DESC LIMIT 3;

-- SLA calculado
SELECT id, status, sla_due_at FROM complaints WHERE id = 1;

-- Notificação ao cidadão
SELECT type, reference_id FROM notifications
WHERE type = 'complaint_status' ORDER BY created_at DESC LIMIT 1;
```

```bash
# Cidadão bloqueado após atribuição prefeitura
curl -X PATCH "http://localhost:3000/api/complaints/1/status" \
  -H "Authorization: Bearer $CITIZEN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"resolved"}'
# Esperado: 403
```

### 14.2 Fase 4b — UI

- [ ] `/admin/inbox` lista ocorrências paginadas
- [ ] Filtros status/categoria/SLA funcionam
- [ ] Badge SLA reflete at_risk/breached
- [ ] Detalhe: alterar status persiste + timeline atualiza
- [ ] Detalhe: atribuir equipe persiste
- [ ] Nota interna aparece na timeline; nota pública gera notificação
- [ ] Viewer vê inbox e detalhe mas não edita gestão
- [ ] Dashboard exibe widgets operational.*
- [ ] `npm run build` admin-web OK

### 14.3 Fase 4c — Config + moderação

- [ ] CRUD equipe operacional (admin)
- [ ] Membro equipe = user com tenant_members
- [ ] Editar SLA recalcula sla_due_at em ocorrências abertas (job ou on-read)
- [ ] Triagem auto-atribui equipe por categoria
- [ ] Fila moderação lista reports pending
- [ ] hide_complaint seta is_hidden + evento
- [ ] Export CSV baixa com filtros aplicados

### 14.4 Regressão Flutter (smoke)

```bash
curl -X POST http://localhost:3000/api/complaints/create \
  -H "Authorization: Bearer $CITIZEN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ ... }'
# Esperado: 201 inalterado

curl http://localhost:3000/api/complaints \
  -H "Authorization: Bearer $CITIZEN_TOKEN"
# Esperado: 200 inalterado
```

---

## 15. Critérios de aceite

### Fase 4a
- [ ] Migrations 014–018 aplicadas sem breaking change
- [ ] Toda mutação admin gera `complaint_events`
- [ ] Notificação emitida em mudança de status (não interna)
- [ ] Bloqueio cidadão após gestão prefeitura (§5.4)
- [ ] Isolamento tenant mantido

### Fase 4b
- [ ] Inbox operacional funcional
- [ ] Gestão ativa no detalhe substitui placeholder
- [ ] KPIs operacionais no dashboard
- [ ] Zero alteração Flutter

### Fase 4c
- [ ] Equipes e SLA configuráveis por admin
- [ ] Roteamento automático por categoria
- [ ] Moderação básica funcional
- [ ] Export CSV

### Global
- [ ] `teams` (gamificação) intocado
- [ ] `npm run build` admin-web OK
- [ ] Documentar novas rotas em comentário no adminRoutes.js

---

## 16. Handoff pós-Fase 4

Registrar para ADRs futuros:

- API pública de timeline para cidadão (Flutter) — opcional
- Webhooks / integração 156 (ADR-006)
- SLA com horário comercial
- App de campo (ADR-007)
- RLS tenant-aware (ADR-005)

---

## 17. Referências

- ADR: [ADR-003](../adr/ADR-003-gestao-operacional-ocorrencias.md)
- UI placeholder: `admin-web/src/pages/ComplaintDetailPage.tsx`
- Filtro tenant: `backend/src/services/tenantService.js`
- Status cidadão: `backend/src/controllers/complaintController.js` (`updateStatus`)
