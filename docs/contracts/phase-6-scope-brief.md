# Scope Brief — Fase 6: Platform Admin (ADR-005)

| Campo | Valor |
|-------|-------|
| **Status** | Pronto para execução |
| **Data** | 2026-06-11 |
| **ADR** | [ADR-005](../adr/ADR-005-gestao-plataforma-clientes.md) |
| **Contrato** | [phase-6-platform-admin.md](./phase-6-platform-admin.md) |
| **Audiência** | Agentes de implementação (backend + admin-web) |

---

## 0. Instruções para o agente executor

1. **Leia obrigatoriamente** antes de codar: este arquivo, `phase-6-platform-admin.md` §6–§15, ADR-005 §5–§7.
2. **Ordem obrigatória:** 6a → 6b → 6c → 6d → 6e. **6a bloqueia tudo.**
3. **DDL somente** em `backend/migrations/` + registro em `server.js`. **Nunca** DDL via MCP Supabase.
4. **Não alterar** app Flutter nas sub-fases 6a–6d (6e = backend geo only).
5. **Atualizar** `CLAUDE.md` ao concluir cada sub-fase (decisões, armadilhas descobertas).
6. **Não commitar** secrets (`.env`, Firebase JSON, etc.).

---

## 1. Objetivo em uma frase

Entregar namespace `/api/platform/*` + UI `/platform/*` no mesmo admin-web para staff LifeCity gerir prefeituras (tenants), convidar gestores municipais, monitorar saúde cross-tenant e dar suporte via impersonation auditada.

---

## 2. Estado atual (baseline — jun/2026)

### 2.1 Supabase prod (confirmado via MCP readonly)

| Item | Valor atual |
|------|-------------|
| `platform_users` | **Não existe** |
| `platform_audit_log` | **Não existe** |
| `tenant_invitations` | **Não existe** |
| `tenants` | 1 registro: Campinas (`id=93615532-d0cc-41c6-849b-87e67e844375`, `cd_mun=3509502`, `slug=campinas`, `status=trial`, **`settings={}`**) |
| `tenant_members` ativos | **8** |
| `complaints` Campinas | **213** |
| Malhas Campinas | **82** bairros, **2592** setores |
| População (`SUM(tot_pop)` em `malhas.utb_demografia`) | **1.078.968** |
| Staff seed emails em `users` | `lucasgiazzi@gmail.com`, `bernardo.wiemer333@gmail.com` (`user_level=2`), **sem** `platform_users` |

### 2.2 Backend — gaps

| Componente | Hoje | Alvo |
|------------|------|------|
| Rotas | `/api/admin/*` only | + `/api/platform/*` |
| JWT payload | `{ userId, tenantId?, cd_mun?, tenantRole? }` | + `platformRole`, `impersonating` |
| `authController.login` | 200 para qualquer user válido | 403 se sem `platform_users` **e** sem `tenant_members` ativos |
| `requireTenantMember` | Exige linha real em `tenant_members` | Bypass quando `impersonating=true`; bloquear `suspended` (6e) |
| `cityValidator.js` | Sync; env global `CITY_*` | Async por `tenants.settings.geo` + fallback env (6e) |
| `mailer.js` | Só reset de senha | + convite municipal (best-effort) |
| Migrations numeradas | Última: **023** | Criar **024–028** |
| `server.js` | Carrega 020–023 de arquivo | Registrar 024–028; **atenção:** loop 014–019 tem `runMigration` **comentado** (L315) |

### 2.3 admin-web — gaps

| Componente | Hoje | Alvo |
|------------|------|------|
| Gate | `user_level > 1` | `platformRole \|\| tenants.length > 0` |
| Rotas | `/login`, `/admin/*` | + `/platform/*`, `/accept-invite` |
| Providers | Auth → Tenant | Auth → **Platform** → Tenant |
| API | `adminFetch` → `/api/admin` | + `platformFetch` → `/api/platform` |
| Login redirect | Sempre `/admin` | Por perfil (§7.1 contrato) |
| Impersonation | Inexistente | Banner fixo em `/admin/*` |

---

## 3. Invariantes (não violar)

1. `platform_users.role` ≠ `tenant_members.role` — enums e middlewares **distintos**.
2. `/api/platform/*` exige `platformRole` + `platform_users.is_active = true` (reconsulta DB anti-tampering).
3. `/api/admin/*` exige membership municipal real **ou** `impersonating=true` com staff platform ativo.
4. Impersonation **nunca** insere em `tenant_members`.
5. Toda mutação platform → `platform_audit_log` (incl. impersonation start/end). Falha no audit **bloqueia** impersonation.
6. Timestamps calculados no SQL (`NOW() + INTERVAL`) — **nunca** `new Date()` do Node para colunas timestamp.
7. Convite municipal: conta + `tenant_members` criados no **POST invite**; token só para definir senha; `setupLink` **sempre** na response.
8. E-mail convite: best-effort se `EMAIL_USER`/`EMAIL_PASS`; falha SMTP **não reverte** convite.
9. Endpoints cidadão inalterados em contrato (exceto resolução geo em 6e).
10. Seed ops/SLA reutiliza template de `018_seed_campinas_ops.sql` parametrizado por `tenant_id`.

---

## 4. Sub-fases e dependências

```
Fase 6a ──► Fase 6b ──► Fase 6d
         ╲              ▲
          ╲──► Fase 6c ─┘
                    │
                    ▼
               Fase 6e
```

| Sub-fase | Entrega | Backend | admin-web |
|----------|---------|---------|-----------|
| **6a** | Schema platform + JWT + middleware + gate login | ✓ | gate mínimo |
| **6b** | CRUD tenants, onboarding seed, health, billing estimate | ✓ | — |
| **6c** | Convites, CRUD members, audit, impersonation | ✓ | — |
| **6d** | UI `/platform/*`, wizard, banner impersonation | ajuste login | ✓ |
| **6e** | Geo multi-tenant, enforcement `suspended` | ✓ | banner opcional |

**Paralelismo:** após 6a, 6b e 6c podem avançar em paralelo. 6d exige 6b+6c. 6e por último.

---

## 5. Migrations 024–028 (ordem e conteúdo)

Registrar em `server.js` no mesmo padrão de 020–023 (`fs.readFileSync` + `runMigration`).

| Arquivo | Fase | Conteúdo |
|---------|------|----------|
| `024_platform_users.sql` | 6a | `CREATE TYPE platform_role`; tabela `platform_users` |
| `025_platform_audit_log.sql` | 6a | Tabela `platform_audit_log` + índices |
| `026_tenant_invitations.sql` | 6c (DDL pode rodar em 6a) | Tabela `tenant_invitations`; `expires_at timestamptz` |
| `027_seed_platform_staff.sql` | 6a | Staff: `lucasgiazzi@gmail.com`, `bernardo.wiemer333@gmail.com` → `admin` |
| `028_seed_campinas_settings.sql` | 6e | Merge `settings.geo` + `features` a partir dos env Campinas |

SQL canônico: ver `phase-6-platform-admin.md` §6.1–6.4 e §11.3.

**Regras DDL:**
- `platform_users`, `platform_audit_log`, `tenant_invitations` → `timestamptz`
- Convite: `expires_at = NOW() + INTERVAL '7 days'` no INSERT
- Convite token: hash SHA-256 (mesmo padrão de `password_reset_tokens`)

---

## 6. Arquivos a CRIAR

### 6.1 Backend — migrations

```
backend/migrations/024_platform_users.sql
backend/migrations/025_platform_audit_log.sql
backend/migrations/026_tenant_invitations.sql
backend/migrations/027_seed_platform_staff.sql
backend/migrations/028_seed_campinas_settings.sql
```

### 6.2 Backend — middleware

```
backend/src/middleware/requirePlatformStaff.js
backend/src/middleware/requirePlatformRole.js
```

Copiar padrão de `requireTenantRole.js`:
- `PLATFORM_ROLE_RANK`: `viewer=0`, `operator=1`, `admin=2`
- `requirePlatformStaff`: valida JWT + reconsulta `platform_users.is_active`

### 6.3 Backend — config + services

```
backend/src/config/platformBillingTiers.js
backend/src/services/platformService.js          # getPlatformMembership, writeAuditLog
backend/src/services/tenantOnboardingService.js  # createTenant + seed ops/SLA (extrair 018)
backend/src/services/tenantInvitationService.js  # conta pré-criada, token, setupLink
backend/src/services/billingEstimateService.js   # população + tiers + infra
```

### 6.4 Backend — controllers

```
backend/src/controllers/platform/tenantsController.js
backend/src/controllers/platform/membersController.js
backend/src/controllers/platform/impersonationController.js
backend/src/controllers/platform/auditController.js
backend/src/controllers/platform/staffController.js
backend/src/controllers/platform/municipalitiesController.js
backend/src/controllers/platform/billingController.js
```

### 6.5 Backend — routes

```
backend/src/routes/platformRoutes.js
```

Montagem em `app.js`:
```javascript
app.use('/api/platform', platformRoutes);
```

Stack por rota:
```
authenticateToken → requirePlatformStaff → requirePlatformRole(minRole)
```

### 6.6 admin-web — auth

```
admin-web/src/auth/PlatformContext.tsx
admin-web/src/auth/platform-context.ts
admin-web/src/auth/usePlatform.ts
```

Expor: `platformRole`, `isPlatformStaff`, `isImpersonating`, `enterTenant(id)`, `exitImpersonation()`.

### 6.7 admin-web — layout + componentes

```
admin-web/src/layout/PlatformLayout.tsx
admin-web/src/layout/PlatformLayout.module.css
admin-web/src/components/PlatformProtectedRoute.tsx
admin-web/src/components/platform/ImpersonationBanner.tsx
admin-web/src/components/platform/ImpersonationBanner.module.css
admin-web/src/components/platform/CopySetupLink.tsx
```

### 6.8 admin-web — páginas

```
admin-web/src/pages/platform/PlatformDashboardPage.tsx
admin-web/src/pages/platform/TenantsListPage.tsx
admin-web/src/pages/platform/TenantOnboardingPage.tsx      # wizard 7 passos
admin-web/src/pages/platform/TenantDetailPage.tsx
admin-web/src/pages/platform/TenantMembersPage.tsx
admin-web/src/pages/platform/AuditLogPage.tsx
admin-web/src/pages/platform/PlatformStaffPage.tsx         # admin only
admin-web/src/pages/AcceptInvitePage.tsx                   # público /accept-invite?token=
```

(+ `.module.css` por página conforme padrão existente em `admin-web/src/pages/`)

### 6.9 admin-web — API

```
admin-web/src/api/platform/client.ts        # platformFetch → /api/platform
admin-web/src/api/platform/tenants.ts
admin-web/src/api/platform/members.ts
admin-web/src/api/platform/municipalities.ts
admin-web/src/api/platform/audit.ts
admin-web/src/api/platform/staff.ts
admin-web/src/api/platform/impersonation.ts
```

Reutilizar refresh em `httpClient.ts`.

---

## 7. Arquivos a ALTERAR

### 7.1 Backend

| Arquivo | O que fazer |
|---------|-------------|
| `backend/src/app.js` | Montar `platformRoutes` em `/api/platform` |
| `backend/src/server.js` | Registrar migrations 024–028 |
| `backend/src/services/tenantService.js` | `getPlatformMembership`; estender `buildAccessToken`/`buildRefreshToken` com `platformRole`, `impersonating`; helper tokens impersonation |
| `backend/src/middleware/authMiddleware.js` | Decodificar `platformRole`, `impersonating` → `req.user` |
| `backend/src/middleware/requireTenantMember.js` | Bypass impersonation (validar platform staff); checar `tenants.status !== 'suspended'` (6e) |
| `backend/src/controllers/authController.js` | Login gate 403; response `platformRole`; refresh revalida platform+impersonation; `invite-info`, `accept-invite` |
| `backend/src/routes/authRoutes.js` | `GET /invite-info`, `POST /accept-invite` |
| `backend/src/infra/mailer.js` | `sendTenantInviteEmail()` — template similar reset; try/catch |
| `backend/src/infra/cityValidator.js` | `getTenantGeoConfig(pool, cd_mun)` async; assinaturas com `cd_mun` (6e) |
| `backend/src/controllers/authController.js` (register) | `isValidCityCep(cep, cd_mun)` (6e) |
| `backend/src/controllers/complaintController.js` | Reativar `isWithinCityBounds(lat, lng, cd_mun)` — hoje **comentado** L50–56 |
| `backend/src/controllers/admin/tenantController.js` | `switchTenant` preservar `platformRole` no JWT |
| `CLAUDE.md` | Atualizar seção Platform Admin pós-implementação |

### 7.2 admin-web

| Arquivo | O que fazer |
|---------|-------------|
| `admin-web/src/App.tsx` | Rotas `/platform/*`, `/accept-invite`; providers Auth→Platform→Tenant |
| `admin-web/src/auth/AuthContext.tsx` | Gate `platformRole \|\| tenants.length`; persistir `platformRole` |
| `admin-web/src/auth/auth-context.ts` | Tipos estendidos |
| `admin-web/src/auth/storage.ts` | Keys `platformRole`, `isImpersonating` |
| `admin-web/src/api/auth.ts` | `LoginResponse` + tipos invite |
| `admin-web/src/components/ProtectedRoute.tsx` | Split ou rotas separadas municipal vs platform |
| `admin-web/src/pages/LoginPage.tsx` | Redirect: só platform→`/platform`; só tenant→`/admin`; ambos→`/platform` |
| `admin-web/src/layout/AdminLayout.tsx` | `<ImpersonationBanner />` quando impersonating |
| `admin-web/src/pages/AccountPage.tsx` | Remover gate `user_level <= 1` |
| `admin-web/src/auth/TenantContext.tsx` | Compatível com tenant do JWT em impersonation |

---

## 8. Contrato JWT (6a)

### Access token

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

Com tenant ativo ou impersonation:

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

### Login response estendida

```json
{
  "user": { "id", "email", "name", "user_level", "photo_url" },
  "accessToken": "...",
  "refreshToken": "...",
  "platformRole": "admin",
  "tenants": [],
  "activeTenantId": null
}
```

### Gate admin-web pós-login

| platformRole | tenants.length | Destino |
|--------------|----------------|---------|
| presente | qualquer | `/platform` |
| ausente | ≥ 1 | `/admin` |
| ausente | 0 | **403** — "Sem permissão para aceder ao painel." |

### Refresh token

- Manter `tenantId` existente.
- Se impersonating: revalidar `platform_users.is_active` antes de reemitir.
- **Armadilha:** refresh payload hoje só `{ userId, tenantId? }` — incluir flag impersonation ou revalidar via DB.

---

## 9. API `/api/platform` — resumo por sub-fase

Detalhe completo (request/response): `phase-6-platform-admin.md` §8–9.

### 6b — Tenants

| Método | Rota | Role mín. |
|--------|------|-----------|
| GET | `/tenants` | viewer |
| POST | `/tenants` | operator |
| GET | `/tenants/:id` | viewer |
| PATCH | `/tenants/:id` | operator (suspend → admin) |
| GET | `/tenants/:id/health` | viewer |
| GET | `/municipalities/search` | operator |
| GET | `/billing/estimate` | operator |

POST `/tenants`: transação atômica tenant + seed ops/SLA + convite opcional + audit + billing em `settings`.

Seed ops: extrair de `018_seed_campinas_ops.sql` → 5 equipes + 5 SLA; `ON CONFLICT DO NOTHING`.

### 6c — Members + impersonation + audit

| Método | Rota | Role mín. |
|--------|------|-----------|
| GET | `/tenants/:id/members` | viewer |
| POST | `/tenants/:id/members/invite` | operator |
| PATCH | `/tenants/:id/members/:userId` | operator |
| POST | `/tenants/:id/enter` | operator |
| POST | `/exit-impersonation` | impersonating |
| GET | `/audit-log` | viewer |
| GET/POST/PATCH | `/staff` | admin |

### Auth público (convite)

| Método | Rota | Auth |
|--------|------|------|
| GET | `/api/auth/invite-info?token=` | nenhuma |
| POST | `/api/auth/accept-invite` | nenhuma → retorna login completo |

Fluxo convite conta nova:
1. POST invite → INSERT `users` (senha aleatória) + `tenant_members` + `tenant_invitations`
2. Response sempre inclui `setupLink` (`ADMIN_WEB_BASE_URL/accept-invite?token=...`)
3. Accept → atualiza senha, `accepted_at = NOW()`, audit `member.invite_accept`

Fluxo conta existente: só `tenant_members`; `setupLink: null`.

---

## 10. UI admin-web — rotas (6d)

```
/login                          → LoginPage (roteamento estendido)
/accept-invite                  → AcceptInvitePage (público)
/platform                       → PlatformDashboardPage
/platform/tenants               → TenantsListPage
/platform/tenants/new           → TenantOnboardingPage (wizard 7 passos)
/platform/tenants/:id           → TenantDetailPage
/platform/tenants/:id/members   → TenantMembersPage
/platform/audit                 → AuditLogPage
/platform/staff                 → PlatformStaffPage (admin only)
/platform/account               → AccountPage (reutilizar)
/admin/*                        → existente + ImpersonationBanner
```

### Wizard onboarding — passos

1. Município (autocomplete + população)
2. Identidade (slug, displayName, status)
3. Comercial (12/24/36 meses, preview R$/mês e total)
4. Geografia (CEP prefixes, bounds)
5. Features (chat, missões)
6. Convite gestor (opcional)
7. Revisão (+ warning malhas incompletas)

### Impersonation banner (AdminLayout)

```
⚠ Modo suporte — {displayName} · [Sair do município]
```

Botão → `POST /api/platform/exit-impersonation`.

---

## 11. Billing estimate (6b)

População: `SELECT COALESCE(SUM(tot_pop),0) FROM malhas.utb_demografia WHERE cd_mun = $1`  
Campinas prod: **1.078.968** → tier `≥1M` → base **R$ 3.500/mês**.

Fórmula: `billingEstimateService.js` + tiers em `platformBillingTiers.js` — ver contrato §12.

Persistir snapshot em `tenants.settings.billing` no create/patch.

---

## 12. Geo multi-tenant (6e)

`cityValidator.js`:

```javascript
async function getTenantGeoConfig(pool, cd_mun) {
  // 1. SELECT settings FROM tenants WHERE cd_mun = $1 AND status IN ('trial','active')
  // 2. Se settings.geo → usar
  // 3. Senão → fallback env CITY_* (log warn)
}
```

Alterar: `isValidCityCep(cep, cd_mun)`, `isWithinCityBounds(lat, lng, cd_mun)`.

`requireTenantMember`: após membership válida, se `tenant.status === 'suspended' && !impersonating` → 403.

Migration 028 popula Campinas:

```sql
UPDATE public.tenants SET settings = settings || jsonb_build_object(
  'geo', jsonb_build_object(
    'cep_prefixes', '["130","1310","1311","1312","1313","1314"]'::jsonb,
    'bounds', jsonb_build_object('lat_min', -23.15, 'lat_max', -22.65, 'lng_min', -47.40, 'lng_max', -46.90)
  ),
  'features', jsonb_build_object('chat_enabled', true, 'missions_enabled', true)
) WHERE slug = 'campinas';
```

---

## 13. RBAC platform

| Ação | viewer | operator | admin |
|------|--------|----------|-------|
| Listar tenants / health / audit | ✓ | ✓ | ✓ |
| Criar/editar tenant | ✗ | ✓ | ✓ |
| Suspender/reativar | ✗ | ✗ | ✓ |
| Convidar/alterar membro municipal | ✗ | ✓ | ✓ |
| Impersonation | ✗ | ✓ | ✓ |
| CRUD platform staff | ✗ | ✗ | ✓ |

---

## 14. Armadilhas conhecidas

| Armadilha | Mitigação |
|-----------|-----------|
| **TIMESTAMP WITHOUT TZ + Node Date** | Convites/audit: `timestamptz` + `NOW() + INTERVAL` no SQL. Padrão correto já em reset senha L403–404 `authController.js` |
| **`user_level` legado** | Gate dual temporário; backend rejeita cidadão puro no login admin-web |
| **Impersonation vs requireTenantMember** | Hoje exige `getMembership` — **quebra** sem bypass. Implementar em 6c |
| **Refresh perde impersonation** | Incluir flag no refresh token ou revalidar platform_users |
| **SMTP ausente** | Convite funciona; `setupLink` na UI; `emailSent: false` |
| **Campinas settings vazio** | Geo 100% via env até migration 028 |
| **Fase 4 migrations comentadas** | `server.js` L315 — verificar prod; Campinas já tem ops/SLA |
| **Confusão admin municipal vs platform** | Nomes distintos: `platformRole` vs `tenantRole`; badges UI |
| **Audit falha** | Bloquear impersonation se log falhar |
| **MCP DDL** | Proibido — usar migrations locais |

---

## 15. Ordem de execução detalhada

### 15.1 Sub-fase 6a (BLOQUEANTE)

1. Criar `024_platform_users.sql`, `025_platform_audit_log.sql`
2. Criar `platformService.js`
3. Criar `requirePlatformStaff.js`, `requirePlatformRole.js`
4. Alterar `tenantService.js` — JWT builders + `getPlatformMembership`
5. Alterar `authMiddleware.js`
6. Alterar `authController.js` — login/refresh + gate 403 + response `platformRole`
7. Criar `platformRoutes.js` (skeleton: ex. `GET /tenants` protegido)
8. Alterar `app.js`
9. Criar `027_seed_platform_staff.sql`
10. Alterar `server.js` — registrar 024, 025, 027
11. admin-web: alterar `AuthContext`, `storage`, `auth.ts` — gate novo (sem UI platform)

**Done quando:** staff seed login → `platformRole: "admin"`; cidadão puro → 403; `/api/platform/*` → 403 sem role.

### 15.2 Sub-fase 6b

1. `platformBillingTiers.js` + `billingEstimateService.js`
2. `tenantOnboardingService.js` (extrair 018)
3. Controllers: `tenantsController`, `municipalitiesController`, `billingController`
4. Wiring `platformRoutes.js` + audit writes
5. (Opcional antecipar DDL) `026_tenant_invitations.sql` se invite no POST `/tenants`

**Done quando:** POST tenant cria + seed; health Campinas OK; billing estimate ~R$ 4.300/mês para 1,08M hab.

### 15.3 Sub-fase 6c

1. `026_tenant_invitations.sql` (se não feita)
2. `tenantInvitationService.js` + `mailer.js`
3. Controllers: `membersController`, `impersonationController`, `auditController`, `staffController`
4. `authController` + `authRoutes` — invite-info, accept-invite
5. Alterar `requireTenantMember.js` — impersonation + (preparar suspended)

**Done quando:** convite sem SMTP retorna link; accept → login `/admin`; impersonation + audit OK.

### 15.4 Sub-fase 6d

1. `api/platform/*` + `PlatformContext`
2. `PlatformLayout` + rotas + `PlatformProtectedRoute`
3. Páginas platform + `AcceptInvitePage`
4. `LoginPage` redirect; `ImpersonationBanner` em `AdminLayout`
5. Wizard com passo comercial

**Done quando:** onboarding E2E; banner impersonation; municipal-only sem nav platform.

### 15.5 Sub-fase 6e

1. `028_seed_campinas_settings.sql`
2. `cityValidator.js` multi-tenant
3. `requireTenantMember` — enforcement suspended
4. `authController.register` + `complaintController.create` com `cd_mun`
5. Registrar 028 em `server.js`

**Done quando:** Campinas settings migrados; tenant suspended → 403 admin (exceto impersonation).

---

## 16. Critérios de aceite (checklist)

### 6a
- [ ] Migrations 024, 025, 027 aplicadas
- [ ] Staff seed recebe `platformRole` no JWT
- [ ] Cidadão puro → 403 no login admin-web
- [ ] `/api/platform/tenants` → 403 sem `platformRole`
- [ ] Token tampered → 403

### 6b
- [ ] POST `/platform/tenants` cria tenant + seed ops/SLA
- [ ] Autocomplete municípios com `hasTenant` correto
- [ ] Health Campinas reflete malhas/ops reais
- [ ] GET `/platform/billing/estimate` coerente para Campinas

### 6c
- [ ] Convite conta nova: user + member existem antes do link
- [ ] `setupLink` sem SMTP
- [ ] Accept define senha → login `/admin`
- [ ] Conta existente: member sem setupLink
- [ ] Impersonation + audit start/end
- [ ] `lucasgiazzi@gmail.com` e `bernardo.wiemer333@gmail.com` acessam `/platform`

### 6d
- [ ] Rotas `/platform/*` só com `platformRole`
- [ ] Wizard E2E + passo comercial 12/24/36
- [ ] Banner impersonation em `/admin/*`
- [ ] Municipal-only não vê nav platform

### 6e
- [ ] Campinas settings migrados (028)
- [ ] Novo tenant valida CEP/bounds próprios
- [ ] Admin municipal tenant suspended → 403 (exceto impersonation)

---

## 17. Variáveis de ambiente novas/opcionais

```
ADMIN_WEB_BASE_URL   # default http://localhost:5173 — usado em setupLink
EMAIL_USER           # já existe — convite opcional
EMAIL_PASS           # já existe — convite opcional
CITY_*               # fallback geo até 028 / multi-tenant completo
```

---

## 18. Referências de código existente (copiar padrão)

| Padrão | Arquivo |
|--------|---------|
| RBAC municipal | `backend/src/middleware/requireTenantRole.js` |
| Tenant membership | `backend/src/middleware/requireTenantMember.js` |
| JWT builders | `backend/src/services/tenantService.js` |
| Seed ops Campinas | `backend/migrations/018_seed_campinas_ops.sql` |
| Reset senha + TIMESTAMP SQL | `backend/src/controllers/authController.js` L401–404 |
| adminFetch | `admin-web/src/api/admin/client.ts` |
| Gate login atual (substituir) | `admin-web/src/auth/AuthContext.tsx` L42, L67–72 |
| Tenant switch | `backend/src/controllers/admin/tenantController.js` |
| Env geo global | `backend/src/infra/cityValidator.js` |
| E-mail | `backend/src/infra/mailer.js` |
| Migration loader | `backend/src/server.js` L323–347 (padrão 020–023) |

---

## 19. Fora de escopo (não implementar)

- Faturamento/cobrança/NF/gateway
- Self-service prefeitura
- App Flutter dedicado staff
- CRUD malhas IBGE no painel
- RLS Supabase
- Remoção física de `users.user_level`
- App web separado para platform

---

*Gerado a partir do mapeamento codebase vs contrato Fase 6 (2026-06-11). Atualizar este arquivo se o escopo mudar antes/durante a execução.*
