# Contrato de implementação — Fase 2: Painel admin MVP

| Campo | Valor |
|-------|-------|
| **ADR** | [ADR-001](../adr/ADR-001-multi-tenant-municipal.md) |
| **Status** | Aguardando Fase 1 |
| **Pré-requisito** | Fase 1 aplicada + admin user em `tenant_members` |
| **Bloqueia** | Fase 3 |

---

## 1. Objetivo

Entregar dashboard MVP no **admin-web** com isolamento por tenant, mapa territorial interativo e painel analítico. App Flutter **permanece inalterado**.

---

## 2. Escopo

### Incluído

**Backend**
- Namespace `/api/admin/*` tenant-scoped
- JWT enriquecido: `tenantId`, `cd_mun`, `tenantRole`
- Middleware `requireTenantMember`
- Endpoints malhas (GeoJSON) e analytics

**admin-web**
- Tenant context pós-login (auto-select se único tenant)
- Layout dashboard split 50/50
- Mapa Leaflet: malha municipal + toggles bairros/setores + markers reclamações
- Painel direito: KPI cards, gráfico categorias, ranking setores/bairros
- Correção tipo `AdminUser.id`: `string` (uuid)

### Excluído

- Gestão de reclamações (status, assign, workflow) → ADR futuro
- Alterações Flutter
- RLS Supabase
- CRUD de tenants (criar municípios via SQL manual)
- Edição de malhas pelo painel

---

## 3. Invariantes

1. Endpoints `/api/auth/*`, `/api/complaints/*` (app) **inalterados** em contrato/consumo Flutter.
2. `/api/admin/*` exige JWT + membership ativa no tenant.
3. Servidor sem `tenant_members` ativo → 403 mesmo com `user_level > 1`.
4. Malhas servidas como **GeoJSON** filtradas por `cd_mun` do tenant.
5. Reclamações sem `tenant_id` no backfill: incluir em analytics se `cd_mun` = tenant OU se `geo.resolve_cd_mun(location)` bate (query unificada).

---

## 4. Contrato de API

Base: `{API_BASE}/api/admin` — header `Authorization: Bearer {token}`

### 4.1 Auth estendido

**POST `/api/auth/login`** (alteração retrocompatível — campos adicionais)

Response existente + quando user tem membership:
```json
{
  "accessToken": "...",
  "refreshToken": "...",
  "user": { "id": "uuid", "email": "...", "name": "...", "user_level": 2 },
  "tenants": [
    {
      "id": "uuid",
      "slug": "campinas",
      "displayName": "Campinas",
      "cd_mun": "3509502",
      "role": "admin"
    }
  ],
  "activeTenantId": "uuid"
}
```

Regras:
- Se 1 tenant → `activeTenantId` preenchido; JWT inclui claims tenant.
- Se 0 tenants mas `user_level > 1` → login OK, `tenants: []`, admin routes 403 (legado deprecado).
- Se N tenants → `activeTenantId` = primeiro; UI permite switch (dropdown header).

**JWT payload adicional:**
```json
{
  "userId": "uuid",
  "tenantId": "uuid",
  "cd_mun": "3509502",
  "tenantRole": "admin"
}
```

### 4.2 Tenants

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/tenants/mine` | Lista tenants do user logado |
| POST | `/tenants/switch` | Body `{ "tenantId": "uuid" }` → novo accessToken |

### 4.3 Malhas (GeoJSON)

| Método | Rota | Query | Response |
|--------|------|-------|----------|
| GET | `/malhas/municipio` | — | `FeatureCollection` malha do tenant |
| GET | `/malhas/bairros` | — | `FeatureCollection` bairros do `cd_mun` |
| GET | `/malhas/setores` | — | `FeatureCollection` setores do `cd_mun` |

Implementação SQL (exemplo):
```sql
SELECT json_build_object(
  'type', 'FeatureCollection',
  'features', COALESCE(json_agg(
    json_build_object(
      'type', 'Feature',
      'properties', json_build_object('cd_mun', cd_mun, 'nm_mun', nm_mun),
      'geometry', ST_AsGeoJSON(geometry)::json
    )
  ), '[]'::json)
)
FROM malhas.municipios WHERE cd_mun = $1;
```

### 4.4 Reclamações (read-only admin)

| Método | Rota | Query params | Response |
|--------|------|--------------|----------|
| GET | `/complaints` | `category?`, `from?`, `to?` | `{ complaints: ComplaintPoint[] }` |

```typescript
type ComplaintPoint = {
  id: number
  category: string | null
  status: string
  latitude: number | null
  longitude: number | null
  cd_setor: string | null
  cd_bairro: string | null
  created_at: string
  address: string | null
}
```

Filtro tenant:
```sql
WHERE c.tenant_id = $tenantId
   OR (c.tenant_id IS NULL AND c.cd_mun = $cd_mun)
   OR (c.tenant_id IS NULL AND c.cd_mun IS NULL
       AND geo.resolve_cd_mun(c.location) = $cd_mun)
```

### 4.5 Analytics

| Método | Rota | Response |
|--------|------|----------|
| GET | `/analytics/summary` | KPIs |
| GET | `/analytics/by-category` | Distribuição categorias |
| GET | `/analytics/ranking-areas` | Ranking setores/bairros |

**GET `/analytics/summary`**
```json
{
  "total": 120,
  "pending": 85,
  "last7Days": 12,
  "distinctCategories": 4,
  "coverage": {
    "bairrosLoaded": true,
    "setoresLoaded": false
  }
}
```

**GET `/analytics/by-category`**
```json
{
  "items": [
    { "category": "Infraestrutura", "count": 45, "percent": 37.5 }
  ]
}
```

**GET `/analytics/ranking-areas`**
```json
{
  "bySetor": [{ "code": "350950200001", "label": "Setor ...", "count": 8 }],
  "byBairro": [{ "code": "...", "label": "Centro", "count": 15 }]
}
```

Query ranking (exemplo setor):
```sql
SELECT c.cd_setor AS code, COUNT(*) AS count
FROM public.complaints c
WHERE /* filtro tenant */ AND c.cd_setor IS NOT NULL
GROUP BY c.cd_setor
ORDER BY count DESC
LIMIT 10;
```

Join label opcional em `malhas.bairros` / metadados do setor.

---

## 5. Contrato UI — Dashboard

### 5.1 Layout

```
┌─────────────────────────────────────────────────────────────┐
│ Header: Logo | Campinas ▼ | User menu                       │
├──────────────────────────┬──────────────────────────────────┤
│ MAPA (50%)               │ ANALYTICS (50%)                  │
│ ┌──────────────────────┐ │ ┌──────┐┌──────┐┌──────┐┌──────┐ │
│ │ [✓] Município        │ │ │Total ││Pend. ││ 7 dias││Cats │ │
│ │ [ ] Bairros          │ │ └──────┘└──────┘└──────┘└──────┘ │
│ │ [ ] Setores          │ │ ┌─────────────────────────────┐ │
│ │                      │ │ │ Gráfico categorias (bar/pie)│ │
│ │    Leaflet map       │ │ └─────────────────────────────┘ │
│ │    + complaint pins  │ │ ┌────────────┬────────────────┐ │
│ │                      │ │ Top setores│ Top bairros    │ │
│ └──────────────────────┘ │ └────────────┴────────────────┘ │
│                          │ ┌─────────────────────────────┐ │
│                          │ │ Área reservada (expansão)   │ │
│                          │ └─────────────────────────────┘ │
└──────────────────────────┴──────────────────────────────────┘
```

### 5.2 Mapa

| Requisito | Detalhe |
|-----------|---------|
| Lib | `leaflet`, `react-leaflet`, `@types/leaflet` |
| Tiles | OpenStreetMap (consistente com app) |
| Default | Malha municipal do tenant (fill opacity ~0.1, stroke primary) |
| Toggles | Checkboxes sobrepõem bairros (cor A) e setores (cor B) |
| Markers | CircleMarker por reclamação; popup: categoria, data, endereço |
| Fit bounds | `fitBounds` na malha municipal ao carregar |
| Empty state | "Nenhuma reclamação no período" |

Cores malhas sugeridas:
- Município: `#2563eb` stroke
- Bairros: `#16a34a` stroke, fill 0.05
- Setores: `#9333ea` stroke, fill 0.05

### 5.3 Analytics panel

| Componente | Fonte |
|------------|-------|
| KPI cards | `/analytics/summary` |
| Gráfico categorias | `/analytics/by-category` — CSS bars ou `recharts` se adicionar dep |
| Rankings | `/analytics/ranking-areas` — tabela top 10 |
| Badge cobertura | Se `setoresLoaded: false`, tooltip "Malha de setores em carga" |

### 5.4 Dependências npm sugeridas

```json
{
  "leaflet": "^1.9.4",
  "react-leaflet": "^5.0.0"
}
```

Opcional gráficos: `recharts` (^2.x)

---

## 6. Estrutura de arquivos (admin-web)

```
admin-web/src/
  api/
    auth.ts          # estender tipos tenants
    admin/
      malhas.ts
      complaints.ts
      analytics.ts
  auth/
    TenantContext.tsx   # tenant ativo + switch
  components/
    dashboard/
      DashboardMap.tsx
      MeshLayerToggles.tsx
      ComplaintMarkers.tsx
      KpiCards.tsx
      CategoryChart.tsx
      AreaRanking.tsx
  pages/
    DashboardPage.tsx   # composição split layout
```

Backend:
```
backend/src/
  middleware/
    requireTenantMember.js
  controllers/
    admin/
      malhasController.js
      adminComplaintsController.js
      analyticsController.js
  routes/
    adminRoutes.js
```

---

## 7. Prompt EXPLORE (Fase 2)

```
Contexto: LifeCity ADR-001 Fase 2. Fase 1 concluída.

Explore:
1. Confirmar tenant Campinas e tenant_members via MCP SELECT
2. Ler admin-web/src: AuthContext, DashboardPage, api/auth.ts
3. Ler backend: authController login/JWT, complaintController getAll, authMiddleware
4. Verificar reclamações com location/tenant_id (COUNT)
5. Verificar malhas.bairros COUNT para cd_mun='3509502'
6. Identificar bug AdminUser.id number vs uuid
7. Ler docs/contracts/phase-2-admin-web.md

Reportar: endpoints a criar, deps npm faltantes, sample GeoJSON size estimate.
Não implementar ainda.
```

---

## 8. Prompt EXECUTE (Fase 2)

```
Contexto: LifeCity ADR-001 Fase 2. Contrato: docs/contracts/phase-2-admin-web.md
Rule: .cursor/rules/lifecity-multi-tenant.mdc

Execute em ordem:
1. Backend middleware requireTenantMember + admin routes/controllers conforme contrato API
2. Estender login JWT com tenant claims (retrocompatível)
3. admin-web: deps leaflet, TenantContext, API clients
4. DashboardPage split layout com mapa + analytics
5. Corrigir AdminUser.id para string (uuid)
6. NÃO alterar lib/ (Flutter)
7. NÃO alterar POST /api/complaints/create behavior

Testes manuais: seção 9 deste contrato.
Lint + build admin-web sem erros.
```

---

## 9. Testes de validação

### 9.1 Auth + tenant

```bash
# Login admin com membership
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"ADMIN_EMAIL","password":"..."}'
# Esperado: tenants[], activeTenantId, accessToken

# Admin route sem tenant no token → 403
# User level>1 sem tenant_members → tenants:[] → dashboard erro amigável
```

### 9.2 Malhas GeoJSON

```bash
curl http://localhost:3000/api/admin/malhas/municipio \
  -H "Authorization: Bearer TOKEN"
# Esperado: FeatureCollection type, features[0].geometry.type = MultiPolygon
```

### 9.3 Analytics coerência

```sql
-- Total manual vs API summary.total deve bater
SELECT COUNT(*) FROM complaints c
JOIN tenants t ON t.slug = 'campinas'
WHERE c.tenant_id = t.id OR c.cd_mun = t.cd_mun;
```

### 9.4 UI checklist

- [ ] Login redireciona para `/admin`
- [ ] Mapa centraliza em Campinas
- [ ] Malha municipal visível
- [ ] Toggle bairros sobrepõe polígonos (se dados existem)
- [ ] Pins de reclamações clicáveis
- [ ] KPI cards populados
- [ ] Gráfico categorias renderiza
- [ ] Rankings listam top áreas
- [ ] App Flutter ainda cria reclamação sem mudança

### 9.5 Regressão Flutter (smoke)

Sem deploy Flutter — apenas API:
```bash
# GET /api/complaints ainda funciona para app (rota pública existente)
curl http://localhost:3000/api/complaints
```

---

## 10. Critérios de aceite

- [ ] Isolamento: admin Campinas não vê dados de outro cd_mun (testar com seed futuro ou mock)
- [ ] Dashboard MVP completo conforme wireframe
- [ ] Zero alteração no código Flutter
- [ ] APIs app (`/api/auth/register`, `/api/complaints/create`) intactas
- [ ] `npm run build` admin-web OK
- [ ] Documentar credenciais teste em `.env.example` (sem secrets)

---

## 11. Handoff para Fase 3

Registrar:
- Contratos API usados pelo Flutter a estender (`/api/auth/register`, `/api/auth/confirm-location`)
- Padrão Nominatim já no app (`create_complaint_page.dart`)
- Decisão: reclamações ainda sem restrição geográfica
