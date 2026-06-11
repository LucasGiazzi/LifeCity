# Contrato de implementação — Fase 6: Platform Admin (gestão de clientes)

| Campo | Valor |
|-------|-------|
| **ADR** | [ADR-005](../adr/ADR-005-gestao-plataforma-clientes.md) |
| **Status** | Proposto |
| **Pré-requisito** | ADR-001 aplicado (tenants + tenant_members); ADR-003 Fase 4 em prod; admin-web `/admin/*` funcional |
| **Bloqueia** | Expansão comercial multi-prefeitura |

---

## 1. Objetivo

Entregar a camada **LifeCity → prefeituras**: staff da plataforma cadastra clientes, convida gestores municipais, monitora saúde cross-tenant e dá suporte via impersonation — tudo no **mesmo admin-web**, ambiente `/platform/*` separado do painel municipal `/admin/*`.

App Flutter **permanece inalterado** nas sub-fases 6a–6d; 6e altera apenas resolução de config geo no backend.

---

## 2. Sub-fases

```
Fase 6a ──► Fase 6b ──► Fase 6c ──► Fase 6d ──► Fase 6e
 Schema+Auth  API Tenants  API Members  UI Platform  Geo+Status
```

| Sub-fase | Entrega principal | Backend | admin-web | Flutter |
|----------|-------------------|---------|-----------|---------|
| **6a** | `platform_users`, JWT claims, middleware | ✓ | gate login | — |
| **6b** | CRUD tenants, onboarding seed, health | ✓ | — | — |
| **6c** | Convites, CRUD members, audit log | ✓ | — | — |
| **6d** | UI `/platform/*`, impersonation | ajuste login | ✓ | — |
| **6e** | `cityValidator` multi-tenant, status enforcement | ✓ | banner suspended | indireto |

**Ordem obrigatória:** 6a → 6b → 6c → 6d → 6e.

---

## 3. Escopo

### 3.1 Incluído

**6a — Fundação platform**
- Migrations: `platform_users`, `platform_audit_log`, enum `platform_role`
- Middleware `requirePlatformStaff`, `requirePlatformRole(minRole)`
- JWT: claims `platformRole`, `impersonating`
- Login response estendido; gate admin-web migrado de `user_level`

**6b — Gestão de clientes**
- Namespace `/api/platform/tenants` (list, create, get, patch)
- Onboarding seed: ops teams + SLA template
- `GET /platform/tenants/:id/health` (KPIs, cobertura malhas)
- **Estimativa comercial** (`settings.billing`) no create/patch + `GET /platform/billing/estimate`

**6c — Gestão de membros municipais**
- Tabela `tenant_invitations` — conta **pré-criada** + token para **definir senha**
- Link copiável na UI; e-mail SMTP **opcional** (workaround sem Hostgator)
- CRUD `/api/platform/tenants/:id/members`
- `GET /api/platform/audit-log`
- Impersonation: `POST /platform/tenants/:id/enter`, `POST /platform/exit-impersonation`

**6d — UI platform**
- `PlatformLayout` + rotas `/platform/*`
- Lista de clientes, wizard onboarding, detalhe tenant, membros, audit
- Impersonation banner + botão sair
- Roteamento pós-login por perfil

**6e — Multi-cidade e enforcement**
- `cityValidator.js` lê `tenants.settings.geo` por `cd_mun`
- `requireTenantMember` bloqueia `suspended`
- Migration settings Campinas a partir de env

### 3.2 Excluído

- Cobrança, NF, gateway de pagamento e faturamento recorrente (estimativa comercial **está incluída**)
- Self-service prefeitura
- App separado para platform
- CRUD malhas IBGE pelo painel
- RLS Supabase
- Remoção física da coluna `user_level` (só deprecação lógica)

---

## 4. Invariantes

1. **`platform_users.role` ≠ `tenant_members.role`** — enums e middlewares distintos; nunca alias.
2. `/api/platform/*` exige `platformRole` + `platform_users.is_active = true`.
3. `/api/admin/*` continua exigindo membership municipal real **ou** impersonation com `impersonating: true`.
4. Impersonation **nunca** insere em `tenant_members`.
5. Toda mutação platform gera `platform_audit_log` (incluindo impersonation start/end).
6. Timestamps calculados no SQL (`NOW() + INTERVAL`) — nunca `Date` JS (armadilha ADR-001).
7. MCP Supabase: DDL via `backend/migrations/` — não via MCP.
8. Endpoints cidadão (`/api/auth/*`, `/api/complaints/*`) **inalterados** em contrato, exceto resolução geo em 6e.
9. Seed ops/SLA reutiliza template de `018_seed_campinas_ops.sql` — parametrizado por `tenant_id`.
10. Convite municipal: **conta + `tenant_members` criados no POST invite**; token só para definir senha; hash SHA-256; link copiável sempre retornado.
11. E-mail de convite: **best-effort** se `EMAIL_USER`/`EMAIL_PASS` definidos; falha SMTP não reverte convite.
12. Staff inicial: `lucasgiazzi@gmail.com` e `bernardo.wiemer333@gmail.com` como `platform_role = admin`.

---

## 5. Matriz RBAC platform

| Ação | viewer | operator | admin |
|------|--------|----------|-------|
| Listar tenants | ✓ | ✓ | ✓ |
| Ver health / audit log | ✓ | ✓ | ✓ |
| Criar tenant (onboarding) | ✗ | ✓ | ✓ |
| Editar tenant (settings, slug) | ✗ | ✓ | ✓ |
| Suspender / reativar tenant | ✗ | ✗ | ✓ |
| Convidar membro municipal | ✗ | ✓ | ✓ |
| Alterar role / desativar membro | ✗ | ✓ | ✓ |
| Impersonation (entrar no município) | ✗ | ✓ | ✓ |
| CRUD `platform_users` | ✗ | ✗ | ✓ |

---

## 6. Entregáveis SQL (Fase 6a)

Arquivos em `backend/migrations/`:

| Arquivo | Conteúdo |
|---------|----------|
| `024_platform_users.sql` | Enum `platform_role`, tabela `platform_users` |
| `025_platform_audit_log.sql` | Tabela `platform_audit_log` + índices |
| `026_tenant_invitations.sql` | Tabela `tenant_invitations` (Fase 6c, pode ser 6a se preferir batch) |
| `027_seed_platform_staff.sql` | Staff LifeCity inicial (e-mails fixos — §6.4) |
| `028_seed_campinas_settings.sql` | Migrar env → `tenants.settings` para Campinas (Fase 6e) |

### 6.1 `024_platform_users.sql`

```sql
CREATE TYPE public.platform_role AS ENUM ('viewer', 'operator', 'admin');

CREATE TABLE public.platform_users (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL UNIQUE REFERENCES public.users (id) ON DELETE CASCADE,
  role       public.platform_role NOT NULL DEFAULT 'operator',
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_platform_users_active ON public.platform_users (user_id) WHERE is_active;
```

### 6.2 `025_platform_audit_log.sql`

```sql
CREATE TABLE public.platform_audit_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    uuid NOT NULL REFERENCES public.users (id) ON DELETE SET NULL,
  action      text NOT NULL,
  target_type text NOT NULL,
  target_id   text NOT NULL,
  tenant_id   uuid REFERENCES public.tenants (id) ON DELETE SET NULL,
  payload     jsonb NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_platform_audit_tenant ON public.platform_audit_log (tenant_id, created_at DESC);
CREATE INDEX idx_platform_audit_actor ON public.platform_audit_log (actor_id, created_at DESC);
CREATE INDEX idx_platform_audit_action ON public.platform_audit_log (action, created_at DESC);
```

Ações canônicas (`action`):

| action | target_type | Descrição |
|--------|-------------|-----------|
| `tenant.create` | `tenant` | Tenant criado |
| `tenant.update` | `tenant` | Settings, slug, display_name |
| `tenant.suspend` | `tenant` | Status → suspended |
| `tenant.activate` | `tenant` | Status → active/trial |
| `member.invite` | `tenant_invitation` | Convite enviado |
| `member.invite_accept` | `tenant_member` | Convite aceito |
| `member.role_change` | `tenant_member` | Role alterada |
| `member.deactivate` | `tenant_member` | is_active = false |
| `impersonation.start` | `tenant` | Staff entrou no município |
| `impersonation.end` | `tenant` | Staff saiu do município |

### 6.3 `026_tenant_invitations.sql`

```sql
CREATE TABLE public.tenant_invitations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  email       text NOT NULL,
  role        public.tenant_role NOT NULL DEFAULT 'admin',
  token_hash  text NOT NULL,
  invited_by  uuid NOT NULL REFERENCES public.users (id) ON DELETE SET NULL,
  expires_at  timestamptz NOT NULL,
  accepted_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tenant_invitations_unique_pending UNIQUE (tenant_id, email)
);

CREATE INDEX idx_tenant_invitations_token ON public.tenant_invitations (token_hash)
  WHERE accepted_at IS NULL;
```

**Regra de expiração:** `expires_at` = `NOW() + INTERVAL '7 days'` no INSERT.

**Fluxo no POST invite (conta nova):**
1. `INSERT users` (senha aleatória, `name` = parte local do e-mail ou campo `name` do request)
2. `INSERT tenant_members` (`is_active = true`)
3. `INSERT tenant_invitations` (token para definir senha)
4. Response inclui `setupLink` — **sempre**, independente de SMTP

**Fluxo no POST invite (conta existente):**
1. `INSERT tenant_members` apenas
2. `accepted_at = NOW()` imediato (sem token) **ou** token opcional só para notificação
3. Response: `{ "memberAdded": true, "setupLink": null }`

### 6.4 `027_seed_platform_staff.sql` (manual)

```sql
-- Pré-requisito: users com estes e-mails já existem (cadastro app ou INSERT prévio)
INSERT INTO public.platform_users (user_id, role)
SELECT u.id, 'admin'::public.platform_role
FROM public.users u
WHERE u.email IN ('lucasgiazzi@gmail.com', 'bernardo.wiemer333@gmail.com')
ON CONFLICT (user_id) DO UPDATE SET role = 'admin', is_active = true;
```

---

## 7. Contrato de API — Auth estendido (Fase 6a)

### 7.1 Login

**POST `/api/auth/login`** — response estendida (retrocompatível):

```json
{
  "message": "Login bem sucedido",
  "user": {
    "id": "uuid",
    "email": "staff@lifecity.app",
    "name": "Staff LifeCity",
    "user_level": 1,
    "photo_url": null
  },
  "accessToken": "...",
  "refreshToken": "...",
  "platformRole": "admin",
  "tenants": [],
  "activeTenantId": null
}
```

Regras de roteamento pós-login (admin-web):

| platformRole | tenants.length | Destino default |
|--------------|----------------|-----------------|
| presente | 0 | `/platform` |
| presente | ≥ 1 | `/platform` |
| ausente | ≥ 1 | `/admin` |
| ausente | 0 | **403** — "Sem permissão para aceder ao painel." |

**JWT access token payload:**

```json
{
  "userId": "uuid",
  "platformRole": "admin",
  "tenantId": null,
  "cd_mun": null,
  "tenantRole": null,
  "impersonating": false
}
```

Quando user tem tenant ativo (municipal ou impersonation):

```json
{
  "userId": "uuid",
  "platformRole": "admin",
  "tenantId": "uuid",
  "cd_mun": "3509502",
  "tenantRole": "admin",
  "impersonating": true
}
```

### 7.2 Refresh token

Refresh mantém `tenantId` existente. Se impersonating, revalidar que `platform_users` ainda ativo antes de reemitir.

### 7.3 Middleware stack

| Namespace | Stack |
|-----------|-------|
| `/api/platform/*` | `authenticateToken` → `requirePlatformStaff` → `requirePlatformRole(...)` |
| `/api/admin/*` | `authenticateToken` → `requireTenantMember` → `requireTenantRole(...)` |

**Arquivos novos:**
- `backend/src/middleware/requirePlatformStaff.js`
- `backend/src/middleware/requirePlatformRole.js`
- `backend/src/services/platformService.js`
- `backend/src/routes/platformRoutes.js`

**`requirePlatformStaff`** — valida:
1. `req.user.platformRole` presente
2. Reconsulta `platform_users` (anti-tampering)
3. Popula `req.platform = { role }`

---

## 8. Contrato de API — Tenants (Fase 6b)

Base: `{API_BASE}/api/platform` — header `Authorization: Bearer {token}`

### 8.1 Listar clientes

**GET `/tenants`**

Query params:

| Param | Tipo | Descrição |
|-------|------|-----------|
| `status` | `trial` \| `active` \| `suspended` | Filtro status |
| `q` | string | Busca em slug, display_name, cd_mun |
| `page` | int | default 1 |
| `pageSize` | int | default 25, max 100 |
| `sort` | `created_at` \| `display_name` \| `status` | default `created_at` |
| `order` | `asc` \| `desc` | default `desc` |

Response:

```json
{
  "items": [
    {
      "id": "uuid",
      "cd_mun": "3509502",
      "slug": "campinas",
      "displayName": "Campinas",
      "status": "trial",
      "activatedAt": "2026-06-04T21:12:35.962Z",
      "createdAt": "2026-06-04T21:12:35.962Z",
      "memberCount": 8,
      "complaintCount": 213,
      "coverage": {
        "bairrosLoaded": true,
        "setoresLoaded": true
      }
    }
  ],
  "pagination": { "page": 1, "pageSize": 25, "total": 1, "totalPages": 1 }
}
```

Permissão: `platformRole ≥ viewer`.

### 8.2 Criar cliente (onboarding)

**POST `/tenants`** — `platformRole ≥ operator`

Request:

```json
{
  "cd_mun": "3509502",
  "slug": "campinas",
  "displayName": "Campinas",
  "status": "trial",
  "settings": {
    "geo": {
      "cep_prefixes": ["130", "1310"],
      "bounds": {
        "lat_min": -23.15,
        "lat_max": -22.65,
        "lng_min": -47.40,
        "lng_max": -46.90
      }
    },
    "features": {
      "chat_enabled": true,
      "missions_enabled": false
    }
  },
  "seedDefaults": true,
  "billing": {
    "contractMonths": 24,
    "populationOverride": null
  },
  "inviteOwner": {
    "email": "gestor@prefeitura.sp.gov.br",
    "name": "Gestor Municipal"
  }
}
```

Campo `billing.contractMonths`: `12` | `24` | `36`. Se omitido, backend calcula com default `24`.
Campo `billing.populationOverride`: número manual se malha demográfica indisponível.

Validações:
- `cd_mun` deve existir em `malhas.municipios`
- `slug` único, lowercase, `[a-z0-9-]`
- `cd_mun` único em `tenants`
- Se `displayName` omitido → usar `nm_mun` da malha

Response `201`:

```json
{
  "tenant": {
    "id": "uuid",
    "cd_mun": "3509502",
    "slug": "campinas",
    "displayName": "Campinas",
    "status": "trial",
    "settings": {
      "geo": { "...": "..." },
      "features": { "...": "..." },
      "billing": {
        "population": 1224527,
        "population_source": "utb_demografia",
        "base_monthly_brl": 2000,
        "infra_monthly_brl": 350,
        "total_monthly_brl": 2350,
        "contract_months": 24,
        "total_contract_brl": 56400,
        "estimated_at": "2026-06-11T12:00:00.000Z"
      }
    },
    "activatedAt": "2026-06-11T12:00:00.000Z",
    "createdAt": "2026-06-11T12:00:00.000Z"
  },
  "seed": {
    "opsTeamsCreated": 5,
    "slaPoliciesCreated": 5
  },
  "invitation": {
    "id": "uuid",
    "email": "gestor@prefeitura.sp.gov.br",
    "expiresAt": "2026-06-18T12:00:00.000Z",
    "setupLink": "https://admin.lifecity.app/accept-invite?token=abc123",
    "emailSent": false,
    "accountCreated": true
  },
  "coverage": {
    "bairrosLoaded": true,
    "setoresLoaded": true,
    "bairroCount": 42,
    "setorCount": 2592
  }
}
```

Transação atômica: tenant + seed + convite (se solicitado) + audit log.

Erros:
- `409` — cd_mun ou slug já existem
- `404` — cd_mun não encontrado em malhas

### 8.3 Detalhe do cliente

**GET `/tenants/:id`** — `platformRole ≥ viewer`

Response:

```json
{
  "tenant": {
    "id": "uuid",
    "cd_mun": "3509502",
    "slug": "campinas",
    "displayName": "Campinas",
    "status": "trial",
    "settings": {},
    "activatedAt": "...",
    "createdAt": "..."
  },
  "stats": {
    "memberCount": 8,
    "complaintCount": 213,
    "complaintsLast7Days": 12,
    "citizenCount": 27,
    "opsTeamCount": 5
  },
  "coverage": {
    "bairrosLoaded": true,
    "setoresLoaded": true,
    "bairroCount": 42,
    "setorCount": 2592
  }
}
```

### 8.4 Atualizar cliente

**PATCH `/tenants/:id`** — `platformRole ≥ operator` (status exige `admin`)

Request (parcial):

```json
{
  "displayName": "Campinas - SP",
  "slug": "campinas-sp",
  "status": "active",
  "settings": {
    "geo": { "cep_prefixes": ["130"] },
    "features": { "chat_enabled": false }
  }
}
```

Regras:
- `status: suspended` → exige `platformRole ≥ admin`; audit `tenant.suspend`
- `status: active` | `trial` → audit `tenant.activate`
- Merge profundo de `settings` (não substituir objeto inteiro)

### 8.5 Health check

**GET `/tenants/:id/health`** — `platformRole ≥ viewer`

```json
{
  "status": "healthy",
  "checks": [
    { "key": "tenant_active", "ok": true, "detail": "status=trial" },
    { "key": "malhas_bairros", "ok": true, "detail": "42 bairros" },
    { "key": "malhas_setores", "ok": true, "detail": "2592 setores" },
    { "key": "ops_teams", "ok": true, "detail": "5 equipes" },
    { "key": "sla_policies", "ok": true, "detail": "5 políticas" },
    { "key": "owner_assigned", "ok": false, "detail": "Nenhum owner/admin convidado" },
    { "key": "geo_config", "ok": true, "detail": "settings.geo configurado" }
  ],
  "computedAt": "2026-06-11T12:00:00.000Z"
}
```

`status`: `healthy` (todos ok) | `degraded` (≥1 falha não crítica) | `critical` (tenant suspended ou sem malha municipal).

### 8.6 Buscar municípios IBGE (autocomplete onboarding)

**GET `/municipalities/search`** — `platformRole ≥ operator`

Query: `q` (min 2 chars), `uf` (default `SP`), `limit` (default 20)

```json
{
  "items": [
    {
      "cd_mun": "3509502",
      "nm_mun": "Campinas",
      "sigla_uf": "SP",
      "hasTenant": true,
      "coverage": { "bairrosLoaded": true, "setoresLoaded": true }
    },
    {
      "cd_mun": "3550308",
      "nm_mun": "São Paulo",
      "sigla_uf": "SP",
      "hasTenant": false,
      "coverage": { "bairrosLoaded": false, "setoresLoaded": false }
    }
  ]
}
```

---

## 9. Contrato de API — Membros e convites (Fase 6c)

### 9.1 Listar membros municipais

**GET `/tenants/:id/members`** — `platformRole ≥ viewer`

```json
{
  "members": [
    {
      "userId": "uuid",
      "name": "Operador",
      "email": "op@prefeitura.sp.gov.br",
      "role": "operator",
      "isActive": true,
      "joinedAt": "2026-06-04T21:00:00.000Z"
    }
  ],
  "pendingInvitations": [
    {
      "id": "uuid",
      "email": "novo@prefeitura.sp.gov.br",
      "role": "admin",
      "expiresAt": "2026-06-18T12:00:00.000Z",
      "invitedByName": "Staff LifeCity",
      "passwordPending": true,
      "setupLink": "https://admin.lifecity.app/accept-invite?token=..."
    }
  ]
}
```

`passwordPending: true` = conta criada, aguardando definição de senha.

### 9.2 Convidar membro

**POST `/tenants/:id/members/invite`** — `platformRole ≥ operator`

```json
{
  "email": "novo@prefeitura.sp.gov.br",
  "role": "admin",
  "name": "Nome do Gestor"
}
```

Roles permitidas: `owner`, `admin`, `operator`, `viewer` (`owner` sem funções exclusivas — rank = admin).

**Comportamento (conta nova):**

1. Cria `users` com senha aleatória (32 bytes, hash bcrypt/salt existente).
2. Insere `tenant_members` imediatamente.
3. Insere `tenant_invitations` com token para **definir senha**.
4. Tenta e-mail (opcional); **sempre** retorna `setupLink`.

**Comportamento (conta existente):**

1. Insere `tenant_members` apenas.
2. Sem token de senha; `setupLink: null`.
3. Staff informa o gestor para login com credenciais existentes.

Response `201` (conta nova):

```json
{
  "invitation": {
    "id": "uuid",
    "email": "novo@prefeitura.sp.gov.br",
    "role": "admin",
    "expiresAt": "2026-06-18T12:00:00.000Z",
    "setupLink": "https://admin.lifecity.app/accept-invite?token=abc123",
    "emailSent": false,
    "accountCreated": true
  }
}
```

Response `201` (conta existente):

```json
{
  "memberAdded": true,
  "userId": "uuid",
  "email": "existente@prefeitura.sp.gov.br",
  "role": "admin",
  "setupLink": null,
  "message": "Usuário já existia — membro adicionado. Informe para fazer login."
}
```

#### Workaround e-mail (sem Hostgator)

| Modo | Implementação |
|------|---------------|
| **Primário** | UI exibe `setupLink` + botão **Copiar link**; staff envia WhatsApp, Gmail pessoal, etc. |
| **Opcional** | Se `EMAIL_USER` + `EMAIL_PASS` no `.env`, chama `sendTenantInviteEmail()` (template similar ao reset de senha). Falha → log warn, `emailSent: false`, convite permanece válido. |

Variável opcional: `ADMIN_WEB_BASE_URL` (default `http://localhost:5173` em dev).

### 9.3 Definir senha do convite (público)

**GET `/api/auth/invite-info?token=...`** — valida token; retorna metadados **sem** autenticação:

```json
{
  "email": "novo@prefeitura.sp.gov.br",
  "name": "Nome do Gestor",
  "tenantDisplayName": "Campinas",
  "expiresAt": "2026-06-18T12:00:00.000Z"
}
```

**POST `/api/auth/accept-invite`** — **somente troca de senha** (conta já existe):

```json
{
  "token": "plaintext-from-link",
  "password": "NovaSenhaSegura123",
  "name": "Nome Completo"
}
```

Regras:
- Valida hash, expiração (`expires_at > NOW()`), `accepted_at IS NULL`
- Atualiza `users.password` + opcionalmente `users.name`
- Marca `tenant_invitations.accepted_at = NOW()`
- Audit `member.invite_accept`
- **Não** cria `users` nem `tenant_members` (já existem)

Response: login completo (tokens + `tenants[]`).

Erros:
- `400` — token inválido/expirado/já usado
- `422` — senha fraca (mesmas regras do cadastro, se houver)

**Login antes de aceitar:** credencial aleatória não é comunicada → login com senha falha até aceitar convite.

### 9.4 Alterar role / desativar membro

**PATCH `/tenants/:id/members/:userId`** — `platformRole ≥ operator`

```json
{ "role": "viewer" }
```

ou

```json
{ "isActive": false }
```

Não permitir desativar a si mesmo via impersonation. Audit `member.role_change` ou `member.deactivate`.

### 9.5 Impersonation

**POST `/tenants/:id/enter`** — `platformRole ≥ operator`

Response:

```json
{
  "accessToken": "...",
  "tenant": {
    "id": "uuid",
    "slug": "campinas",
    "displayName": "Campinas",
    "cd_mun": "3509502",
    "role": "admin"
  },
  "impersonating": true
}
```

JWT emitido com `tenantRole: 'admin'`, `impersonating: true`. Audit `impersonation.start`.

**POST `/exit-impersonation`** — requer `impersonating: true` no JWT

Response:

```json
{
  "accessToken": "...",
  "impersonating": false
}
```

Remove claims tenant do JWT; mantém `platformRole`. Audit `impersonation.end`.

### 9.6 Audit log

**GET `/audit-log`** — `platformRole ≥ viewer`

Query: `tenantId?`, `action?`, `actorId?`, `from?`, `to?`, `page`, `pageSize`

```json
{
  "items": [
    {
      "id": "uuid",
      "actorId": "uuid",
      "actorName": "Staff LifeCity",
      "action": "tenant.create",
      "targetType": "tenant",
      "targetId": "uuid",
      "tenantId": "uuid",
      "tenantName": "Campinas",
      "payload": { "cd_mun": "3509502", "slug": "campinas" },
      "createdAt": "2026-06-11T12:00:00.000Z"
    }
  ],
  "pagination": { "page": 1, "pageSize": 50, "total": 42, "totalPages": 1 }
}
```

### 9.7 Platform staff (admin only)

**GET `/staff`** — `platformRole ≥ admin`

**POST `/staff`** — body `{ "email", "role" }` — cria ou vincula user existente

**PATCH `/staff/:userId`** — alterar role ou desativar

---

## 10. Contrato UI — admin-web (Fase 6d)

### 10.1 Rotas

```
/login                          → LoginPage (existente, roteamento estendido)
/accept-invite                  → AcceptInvitePage (público)
/platform                       → PlatformDashboardPage
/platform/tenants               → TenantsListPage
/platform/tenants/new           → TenantOnboardingPage (wizard)
/platform/tenants/:id           → TenantDetailPage
/platform/tenants/:id/members   → TenantMembersPage
/platform/audit                 → AuditLogPage
/platform/staff                 → PlatformStaffPage (admin only)
/platform/account               → AccountPage (reutilizar)
/admin/*                        → (existente, inalterado)
```

### 10.2 Hierarquia de providers

```
AuthProvider → PlatformProvider → TenantProvider → CategoriesProvider → Router
```

**PlatformProvider** expõe:
- `platformRole`
- `isPlatformStaff`
- `isImpersonating`
- `enterTenant(id)` / `exitImpersonation()`

### 10.3 Layout platform

```
┌─────────────────────────────────────────────────────────────┐
│ Header: LifeCity Platform | User menu | Sair impersonation  │
├──────────────┬──────────────────────────────────────────────┤
│ Sidebar      │ Content                                       │
│ • Dashboard  │                                               │
│ • Clientes   │                                               │
│ • Audit log  │                                               │
│ • Staff (*)  │                                               │
│ ───────────  │                                               │
│ Entrar em    │  (*) admin only                               │
│ município ▼  │                                               │
└──────────────┴──────────────────────────────────────────────┘
```

Identidade visual distinta do `AdminLayout` municipal (cor de accent diferente, badge "Platform").

### 10.4 PlatformDashboardPage

Cards globais:
- Total clientes (por status)
- Total ocorrências (7d / 30d)
- Clientes degraded (health ≠ healthy)
- Últimas ações (audit log resumido)

### 10.5 TenantsListPage

Tabela paginada: nome, cd_mun, status (badge), membros, ocorrências, cobertura malhas, ações (ver, entrar, suspender).

Filtros: status, busca textual.

### 10.6 TenantOnboardingPage (wizard)

Passos:
1. **Município** — autocomplete `GET /platform/municipalities/search` (+ população estimada quando disponível)
2. **Identidade** — slug (auto do nm_mun), displayName, status inicial
3. **Comercial** — estimativa: população (auto/manual), contrato 12/24/36 meses, preview R$/mês e total
4. **Geografia** — CEP prefixes, bounds (mapa opcional)
5. **Features** — toggles chat, missões
6. **Convite** — e-mail + nome do primeiro gestor (opcional); preview do link após criar
7. **Revisão** — coverage warning se malhas incompletas → confirmar

### 10.6b AcceptInvitePage

Rota pública `/accept-invite?token=...`:

- Carrega `GET /api/auth/invite-info`
- Formulário: **nova senha** + confirmar senha + nome (editável)
- Submit → `POST /api/auth/accept-invite` → redirect `/admin`
- **Sem** campo de e-mail (já vinculado ao token)

### 10.6c TenantMembersPage — convite

Após POST invite, modal/toast com:
- Link completo + **Copiar link**
- Badge `E-mail enviado` / `Envie manualmente` conforme `emailSent`
- Lista convites pendentes com ação "Copiar link" (reemitir token se expirado — POST invite de novo)

### 10.7 TenantDetailPage

Abas:
- **Resumo** — stats, health checks, **card comercial** (R$/mês, contrato, população), botão "Entrar no município"
- **Configurações** — edit settings, status, recalcular billing
- **Membros** — link para TenantMembersPage

### 10.8 Impersonation banner

Quando `isImpersonating`, banner fixo no topo de **todo** `/admin/*`:

```
⚠ Modo suporte — Campinas · [Sair do município]
```

Cor de alerta; botão chama `POST /platform/exit-impersonation`.

### 10.9 Gate de login (substituir user_level)

```typescript
// AuthContext — canAccessAdmin
const canAccessAdmin = Boolean(
  user && (platformRole || (tenants && tenants.length > 0))
)
```

Backend espelha: login retorna 200 apenas se `platform_users` ou `tenant_members` ativos; caso contrário 403 para credenciais válidas de cidadão puro.

### 10.10 Módulos API novos

```
admin-web/src/api/platform/
  client.ts       → platformFetch (prefix /api/platform)
  tenants.ts
  members.ts
  municipalities.ts
  audit.ts
  staff.ts
  impersonation.ts
```

Reutilizar `httpClient.ts` para refresh token.

---

## 11. Contrato backend — Geo multi-tenant (Fase 6e)

### 11.1 `cityValidator.js`

Nova função:

```javascript
async function getTenantGeoConfig(pool, cd_mun) {
  // 1. SELECT settings FROM tenants WHERE cd_mun = $1 AND status IN ('trial','active')
  // 2. Se settings.geo presente → usar
  // 3. Senão → fallback env CITY_* (deprecado, log warn)
}
```

Alterar:
- `isValidCityCep(cep, cd_mun)` — prefixes do tenant
- `isWithinCityBounds(lat, lng, cd_mun)` — bounds do tenant

Chamadas existentes em `authController.register` e `complaintController.create` passam `cd_mun` resolvido do tenant ativo ou `home_cd_mun`.

### 11.2 `requireTenantMember`

Adicionar após validar membership:

```javascript
const tenantStatus = await getTenantStatus(pool, tenantId);
if (tenantStatus === 'suspended' && !req.user.impersonating) {
  return res.status(403).json({ message: 'Município suspenso.' });
}
```

### 11.3 Migration Campinas settings

`028_seed_campinas_settings.sql`:

```sql
UPDATE public.tenants
SET settings = settings || jsonb_build_object(
  'geo', jsonb_build_object(
    'cep_prefixes', '["130","1310","1311","1312","1313","1314"]'::jsonb,
    'bounds', jsonb_build_object(
      'lat_min', -23.15,
      'lat_max', -22.65,
      'lng_min', -47.40,
      'lng_max', -46.90
    )
  ),
  'features', jsonb_build_object('chat_enabled', true, 'missions_enabled', true)
)
WHERE slug = 'campinas';
```

---

## 12. Estimativa comercial (MVP billing)

Indicativo para proposta com prefeitura — **sem cobrança integrada**. Persistido em `tenants.settings.billing`.

### 12.1 População

Ordem de resolução:

```sql
-- 1) Soma UTB/demografia municipal (Campinas e municípios importados)
SELECT COALESCE(SUM(tot_pop), 0)::bigint AS population
FROM malhas.utb_demografia WHERE cd_mun = $1;

-- 2) Fallback: input manual no wizard (populationOverride)
```

Response de `/municipalities/search` inclui `population` e `populationSource` (`utb_demografia` | `manual` | `unknown`).

### 12.2 Fórmula de precificação (referência de mercado B2G)

Produto SaaS municipal de engajamento cívico — faixa de mercado **R$ 1.000–2.000/mês** para cidades médias; escala com população.

Implementar em `services/billingEstimateService.js`:

```javascript
function estimateBilling({ population, contractMonths = 24 }) {
  const pop = Math.max(0, Number(population) || 0);

  // Assinatura plataforma (valor de mercado por tier)
  let baseMonthly;
  if (pop < 20_000)        baseMonthly = 1000;
  else if (pop < 100_000)  baseMonthly = 1500;
  else if (pop < 500_000)  baseMonthly = 2000;
  else if (pop < 1_000_000) baseMonthly = 2800;
  else                     baseMonthly = 3500;

  // Infra nuvem + tráfego (Supabase, storage, FCM, egress) — estimativa conservadora
  const infraMonthly = Math.min(800, 120 + Math.ceil(pop * 0.0015));

  const totalMonthly = baseMonthly + infraMonthly;
  const months = [12, 24, 36].includes(contractMonths) ? contractMonths : 24;
  const totalContract = totalMonthly * months;

  return {
    population: pop,
    base_monthly_brl: baseMonthly,
    infra_monthly_brl: infraMonthly,
    total_monthly_brl: totalMonthly,
    contract_months: months,
    total_contract_brl: totalContract,
    breakdown: {
      base_label: 'Licença LifeCity (SaaS)',
      infra_label: 'Infraestrutura estimada (nuvem + tráfego)',
    },
  };
}
```

**Nota:** valores revisáveis comercialmente; constantes em config (`platformBillingTiers.js`) — não hardcode espalhado.

### 12.3 API de preview (wizard)

**GET `/platform/billing/estimate`** — `platformRole ≥ operator`

Query: `cd_mun`, `contractMonths` (12|24|36), `populationOverride?`

Response:

```json
{
  "population": 1224527,
  "populationSource": "utb_demografia",
  "baseMonthlyBrl": 3500,
  "infraMonthlyBrl": 800,
  "totalMonthlyBrl": 4300,
  "contractMonths": 24,
  "totalContractBrl": 103200,
  "disclaimer": "Valores indicativos para proposta comercial. Não constitui fatura."
}
```

`infraMonthlyBrl` capped em 800 — cidades muito grandes não explodem a estimativa.

### 12.4 UI wizard — passo Comercial

Exibir:
- População (editável se `unknown`)
- Radio: **12 / 24 / 36 meses**
- Cards: **R$ X/mês** · **Total contrato R$ Y**
- Tooltip com breakdown base + infra

Ao confirmar onboarding, snapshot gravado em `settings.billing` com `estimated_at`.

---

## 13. Serviços backend — arquivos novos

| Arquivo | Responsabilidade |
|---------|------------------|
| `services/platformService.js` | getPlatformMembership, buildPlatformAuditLog |
| `services/tenantOnboardingService.js` | createTenant + seed ops/SLA transacional |
| `services/tenantInvitationService.js` | criar convite (conta pré-criada), accept-invite, e-mail opcional |
| `services/billingEstimateService.js` | população + tiers + infra |
| `controllers/platform/tenantsController.js` | CRUD tenants, health |
| `controllers/platform/membersController.js` | members, invitations |
| `controllers/platform/impersonationController.js` | enter/exit |
| `controllers/platform/auditController.js` | audit log |
| `controllers/platform/staffController.js` | platform_users CRUD |
| `controllers/platform/municipalitiesController.js` | autocomplete IBGE |
| `controllers/platform/billingController.js` | GET estimate |
| `routes/platformRoutes.js` | montagem `/api/platform` |

Montagem em `app.js`:

```javascript
app.use('/api/platform', platformRoutes);
```

---

## 14. Seed ops/SLA template

Extrair lógica de `018_seed_campinas_ops.sql` para `tenantOnboardingService.seedDefaults(tenantId)`:

- 5 equipes: triagem-geral, obras, seguranca, limpeza, transito
- SLA por slug de categoria (mesmos defaults da Fase 4)
- Idempotente: `ON CONFLICT (tenant_id, slug) DO NOTHING`

---

## 15. Critérios de aceite

### 6a — Auth platform

- [ ] Migration `024`, `025` aplicadas
- [ ] Staff LifeCity consegue login e recebe `platformRole` no JWT
- [ ] Cidadão puro (`user_level=1`, sem memberships) → 403 no admin-web
- [ ] `/api/platform/tenants` retorna 403 sem `platformRole`
- [ ] Testes manuais: token tampered (role alterado) → 403

### 6b — CRUD tenants

- [ ] POST `/platform/tenants` cria tenant + seed ops/SLA
- [ ] Autocomplete municípios retorna `hasTenant` correto
- [ ] PATCH suspend → cidadão bloqueado em `resolveLocation` (já existia)
- [ ] Health check reflete estado real do tenant Campinas
- [ ] GET `/platform/billing/estimate` retorna valores coerentes para Campinas (~1,2M hab.)

### 6c — Membros e impersonation

- [ ] Convite conta nova: user + member existem **antes** do link ser aberto
- [ ] `setupLink` retornado e copiável sem SMTP configurado
- [ ] Aceite define senha e login funciona em `/admin`
- [ ] Conta existente: member adicionado sem setupLink
- [ ] SMTP opcional: se env ausente, `emailSent: false` sem erro
- [ ] Impersonation: staff entra em Campinas, vê inbox, audit registrado
- [ ] Exit impersonation restaura JWT platform-only

- [ ] `lucasgiazzi@gmail.com` e `bernardo.wiemer333@gmail.com` acessam `/platform` após seed 027

### 6d — UI platform

- [ ] Rotas `/platform/*` acessíveis só com `platformRole`
- [ ] Wizard onboarding cria tenant end-to-end
- [ ] Banner impersonation visível em `/admin/*`
- [ ] Municipal-only user não vê nav platform

- [ ] Wizard passo comercial exibe 12/24/36 meses e totais

### 6e — Multi-cidade

- [ ] Campinas settings migrados de env
- [ ] Novo tenant com settings.geo distinto valida CEP/bounds corretos
- [ ] Admin municipal de tenant suspended → 403 (exceto impersonation)

---

## 16. Ordem de implementação sugerida (agentes)

| Ordem | Tarefa | Arquivos principais |
|-------|--------|---------------------|
| 1 | Migrations 024–025 + platformService | `migrations/`, `platformService.js` |
| 2 | Middleware + platformRoutes skeleton | `requirePlatformStaff.js`, `platformRoutes.js` |
| 3 | Estender authController + tenantService JWT | `authController.js`, `tenantService.js` |
| 4 | tenantsController + onboardingService | `tenantsController.js`, `tenantOnboardingService.js` |
| 5 | invitations + accept-invite | `tenantInvitationService.js`, `authController.js` |
| 6 | impersonation + audit | `impersonationController.js`, `auditController.js` |
| 7 | admin-web PlatformProvider + rotas | `admin-web/src/auth/`, `admin-web/src/pages/platform/` |
| 8 | cityValidator + requireTenantMember status | `cityValidator.js`, `requireTenantMember.js` |

---

## 17. Referências

- ADR: [ADR-005](../adr/ADR-005-gestao-plataforma-clientes.md)
- Multi-tenant: [ADR-001](../adr/ADR-001-multi-tenant-municipal.md)
- Seed ops: `backend/migrations/018_seed_campinas_ops.sql`
- E-mail: `backend/src/infra/mailer.js`
- admin-web auth: `admin-web/src/auth/AuthContext.tsx`
