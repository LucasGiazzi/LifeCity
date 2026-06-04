# Contrato de implementação — Fase 1: Fundação multi-tenant (banco)

| Campo | Valor |
|-------|-------|
| **ADR** | [ADR-001](../adr/ADR-001-multi-tenant-municipal.md) |
| **Status** | Pronto para execução |
| **Pré-requisito** | Nenhum |
| **Bloqueia** | Fase 2 |

---

## 1. Objetivo

Criar a fundação multi-tenant no PostgreSQL/Supabase de forma **100% retrocompatível** com o app Flutter e APIs atuais. Nenhum endpoint existente pode mudar comportamento observável.

---

## 2. Escopo

### Incluído

- Constraints e índices em `malhas.*`
- Schema `geo` com funções espaciais
- Tabelas `public.tenants`, `public.tenant_members`
- Colunas aditivas nullable em `users` e `complaints`
- Seed tenant Campinas (`3509502`)
- Script de backfill (opcional, separado) para `complaints.location`, `tenant_id`, `cd_mun`, `cd_setor`, `cd_bairro`
- Associação manual inicial de usuários admin a `tenant_members`

### Excluído

- Alteração de endpoints backend
- Alteração admin-web ou Flutter
- RLS policies
- Tornar colunas NOT NULL
- Gestão de reclamações

---

## 3. Invariantes (obrigatório)

1. **MCP Supabase:** apenas `SELECT` / `list_tables` / `get_advisors`. DDL/DML via arquivos `.sql` em `backend/migrations/`.
2. **`malhas.municipios`** é a dimensão — não criar tabela dim duplicada.
3. Toda coluna nova em tabelas usadas pelo app (`users`, `complaints`) deve ser **nullable** ou ter **default** que preserve inserts atuais.
4. Não remover/renomear colunas existentes.
5. FKs referenciam `malhas.municipios(cd_mun)` — exige `UNIQUE` prévio.

---

## 4. Entregáveis (arquivos)

Criar em `backend/migrations/`, um arquivo por concern, ordem numérica sugerida:

| Arquivo | Conteúdo |
|---------|----------|
| `001_malhas_constraints.sql` | `NOT NULL cd_mun`, `UNIQUE(cd_mun)`, índices em bairros/setores |
| `002_geo_schema_functions.sql` | `CREATE SCHEMA geo`, funções resolve/backfill |
| `003_tenants_and_members.sql` | `tenant_role` enum, `tenants`, `tenant_members`, RLS off |
| `004_users_tenant_columns.sql` | `home_cd_mun`, `registration_address`, `address_confirmed_at` |
| `005_complaints_tenant_columns.sql` | `tenant_id`, `cd_mun`, `cd_setor`, `cd_bairro`, `location` + índices GIST |
| `006_seed_tenant_campinas.sql` | INSERT tenant Campinas |
| `007_backfill_complaints_geo.sql` | UPDATE batch (opcional, idempotente) |

---

## 5. Contrato SQL detalhado

### 5.1 `001_malhas_constraints.sql`

```sql
-- Tornar cd_mun referenciável
ALTER TABLE malhas.municipios
  ALTER COLUMN cd_mun SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_malhas_municipios_cd_mun
  ON malhas.municipios (cd_mun);

CREATE INDEX IF NOT EXISTS idx_malhas_bairros_cd_mun
  ON malhas.bairros (cd_mun);

-- setores: idx já existe (idx_setores_cd_mun)
```

### 5.2 `002_geo_schema_functions.sql`

```sql
CREATE SCHEMA IF NOT EXISTS geo;

CREATE OR REPLACE FUNCTION geo.point_from_latlng(p_lat text, p_lng text)
RETURNS geometry(Point, 4326) AS $$
  SELECT CASE
    WHEN p_lat IS NULL OR p_lng IS NULL THEN NULL
    WHEN p_lat !~ '^-?[0-9]+(\.[0-9]+)?$' THEN NULL
    WHEN p_lng !~ '^-?[0-9]+(\.[0-9]+)?$' THEN NULL
    ELSE ST_SetSRID(ST_MakePoint(p_lng::float8, p_lat::float8), 4326)
  END;
$$ LANGUAGE sql IMMUTABLE;

CREATE OR REPLACE FUNCTION geo.resolve_cd_mun(p_point geometry)
RETURNS char(7) AS $$
  SELECT m.cd_mun::char(7)
  FROM malhas.municipios m
  WHERE p_point IS NOT NULL
    AND ST_Contains(m.geometry, p_point)
  LIMIT 1;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION geo.resolve_cd_bairro(p_point geometry, p_cd_mun char(7))
RETURNS varchar AS $$
  SELECT b.cd_bairro
  FROM malhas.bairros b
  WHERE p_cd_mun IS NOT NULL AND p_point IS NOT NULL
    AND b.cd_mun = p_cd_mun::varchar
    AND ST_Contains(b.geometry, p_point)
  LIMIT 1;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION geo.resolve_cd_setor(p_point geometry, p_cd_mun char(7))
RETURNS varchar AS $$
  SELECT s.cd_setor
  FROM malhas.setores s
  WHERE p_cd_mun IS NOT NULL AND p_point IS NOT NULL
    AND s.cd_mun = p_cd_mun::varchar
    AND ST_Contains(s.geometry, p_point)
  LIMIT 1;
$$ LANGUAGE sql STABLE;
```

### 5.3 `003_tenants_and_members.sql`

```sql
CREATE TYPE public.tenant_role AS ENUM (
  'owner', 'admin', 'operator', 'viewer'
);

CREATE TABLE public.tenants (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cd_mun       char(7) NOT NULL,
  slug         text NOT NULL,
  display_name text NOT NULL,
  status       text NOT NULL DEFAULT 'trial'
               CHECK (status IN ('trial', 'active', 'suspended')),
  settings     jsonb NOT NULL DEFAULT '{}',
  activated_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tenants_cd_mun_fkey
    FOREIGN KEY (cd_mun) REFERENCES malhas.municipios (cd_mun),
  CONSTRAINT tenants_cd_mun_unique UNIQUE (cd_mun),
  CONSTRAINT tenants_slug_unique UNIQUE (slug)
);

CREATE TABLE public.tenant_members (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  role       public.tenant_role NOT NULL DEFAULT 'operator',
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tenant_members_unique UNIQUE (tenant_id, user_id)
);

CREATE INDEX idx_tenant_members_user ON public.tenant_members (user_id);
CREATE INDEX idx_tenant_members_tenant ON public.tenant_members (tenant_id);
```

### 5.4 Colunas aditivas

**users:**
```sql
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS home_cd_mun char(7)
    REFERENCES malhas.municipios (cd_mun),
  ADD COLUMN IF NOT EXISTS registration_address text,
  ADD COLUMN IF NOT EXISTS address_confirmed_at timestamptz;
```

**complaints:**
```sql
ALTER TABLE public.complaints
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants (id),
  ADD COLUMN IF NOT EXISTS cd_mun char(7) REFERENCES malhas.municipios (cd_mun),
  ADD COLUMN IF NOT EXISTS cd_setor varchar REFERENCES malhas.setores (cd_setor),
  ADD COLUMN IF NOT EXISTS cd_bairro varchar,
  ADD COLUMN IF NOT EXISTS location geometry(Point, 4326);

CREATE INDEX IF NOT EXISTS idx_complaints_tenant_id ON public.complaints (tenant_id);
CREATE INDEX IF NOT EXISTS idx_complaints_cd_mun ON public.complaints (cd_mun);
CREATE INDEX IF NOT EXISTS idx_complaints_location ON public.complaints USING GIST (location);
```

### 5.5 Seed Campinas

```sql
INSERT INTO public.tenants (cd_mun, slug, display_name, status, activated_at)
SELECT '3509502', 'campinas', nm_mun, 'trial', now()
FROM malhas.municipios WHERE cd_mun = '3509502'
ON CONFLICT (cd_mun) DO NOTHING;
```

### 5.6 Backfill complaints (idempotente)

```sql
UPDATE public.complaints c
SET
  location = geo.point_from_latlng(c.latitude, c.longitude),
  cd_mun   = geo.resolve_cd_mun(geo.point_from_latlng(c.latitude, c.longitude)),
  cd_setor = geo.resolve_cd_setor(
               geo.point_from_latlng(c.latitude, c.longitude),
               geo.resolve_cd_mun(geo.point_from_latlng(c.latitude, c.longitude))
             ),
  cd_bairro = geo.resolve_cd_bairro(
                geo.point_from_latlng(c.latitude, c.longitude),
                geo.resolve_cd_mun(geo.point_from_latlng(c.latitude, c.longitude))
              ),
  tenant_id = t.id
FROM public.tenants t
WHERE c.location IS NULL
  AND c.latitude IS NOT NULL
  AND c.longitude IS NOT NULL
  AND t.cd_mun = geo.resolve_cd_mun(geo.point_from_latlng(c.latitude, c.longitude));
```

---

## 6. Prompt EXPLORE (Fase 1)

Copiar para agente **antes** de escrever SQL:

```
Contexto: LifeCity ADR-001 Fase 1. Objetivo: fundação multi-tenant no Postgres SEM quebrar app Flutter.

Explore (read-only):
1. MCP user-supabase-lifecity: list_tables verbose em schemas public e malhas
2. Verificar: cd_mun único em malhas.municipios; PKs; índices GIST existentes
3. Contar registros em malhas.municipios, bairros, setores
4. Verificar colunas atuais de public.users e public.complaints
5. Testar geo functions se já existirem; senão validar ST_Contains com SELECT:
   SELECT geo.resolve_cd_mun(ST_SetSRID(ST_MakePoint(-47.06, -22.91), 4326));
6. Ler backend/migrations/ existentes para numeração
7. Confirmar que INSERT atual em complaints (via complaintController.js) não especifica colunas novas

Não executar DDL/DML. Reportar gaps vs contrato phase-1-database.md.
```

---

## 7. Prompt EXECUTE (Fase 1)

```
Contexto: LifeCity ADR-001 Fase 1. Contrato: docs/contracts/phase-1-database.md

Execute:
1. Criar arquivos SQL em backend/migrations/ conforme seção 4 do contrato
2. NÃO rodar migrations — apenas arquivos para revisão humana
3. Incluir comentários `-- Executar após revisão` no topo de cada arquivo
4. Adicionar script manual 008_link_admin_users.sql (comentado) exemplificando:
   INSERT INTO tenant_members (tenant_id, user_id, role)
   SELECT t.id, u.id, 'admin' FROM tenants t, users u
   WHERE t.slug = 'campinas' AND u.email = 'admin@example.com';
5. Não alterar backend/, admin-web/, lib/

Validação local (agente pode sugerir queries; humano roda após apply):
- Ver seção 8 deste contrato
```

---

## 8. Testes de validação (pós-apply humano)

### 8.1 Estrutura

```sql
-- UNIQUE cd_mun
SELECT indexname FROM pg_indexes
WHERE schemaname = 'malhas' AND indexdef LIKE '%UNIQUE%cd_mun%';
-- Esperado: 1 linha

-- Tabelas tenant
SELECT COUNT(*) FROM public.tenants WHERE slug = 'campinas';
-- Esperado: 1

-- Colunas nullable (app safe)
SELECT is_nullable FROM information_schema.columns
WHERE table_name = 'complaints' AND column_name = 'tenant_id';
-- Esperado: YES
```

### 8.2 Retrocompatibilidade API (obrigatório)

Com backend rodando, **sem deploy de código novo**:

```bash
# Registro (deve continuar 200)
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test-fase1@example.com","password":"senha123","name":"Test","cpf":"12345678901","phone":"11999999999"}'

# Login + criar reclamação (deve continuar 201)
# Usar token retornado no POST /api/complaints/create
```

### 8.3 Funções geo

```sql
-- Ponto em Campinas (~centro)
SELECT geo.resolve_cd_mun(ST_SetSRID(ST_MakePoint(-47.0608, -22.9056), 4326));
-- Esperado: 3509502

-- Fora de SP
SELECT geo.resolve_cd_mun(ST_SetSRID(ST_MakePoint(-43.2, -22.9), 4326));
-- Esperado: NULL ou cd_mun do RJ se malha nacional (hoje só SP → provavelmente NULL)
```

### 8.4 Backfill

```sql
SELECT
  COUNT(*) AS total,
  COUNT(location) AS com_location,
  COUNT(tenant_id) AS com_tenant,
  COUNT(cd_mun) AS com_cd_mun
FROM public.complaints;
```

### 8.5 Critérios de aceite

- [ ] Migrations aplicadas na ordem sem erro
- [ ] App Flutter registra usuário e cria reclamação sem alteração de código
- [ ] Tenant Campinas existe
- [ ] Funções `geo.*` retornam `3509502` para ponto em Campinas
- [ ] Nenhuma coluna nova é NOT NULL em users/complaints

---

## 9. Rollback

Ordem inversa. Scripts de rollback separados (human review):

```sql
-- Exemplo: 005 rollback
ALTER TABLE public.complaints
  DROP COLUMN IF EXISTS location,
  DROP COLUMN IF EXISTS cd_bairro,
  DROP COLUMN IF EXISTS cd_setor,
  DROP COLUMN IF EXISTS cd_mun,
  DROP COLUMN IF EXISTS tenant_id;
```

---

## 10. Handoff para Fase 2

Após aceite, registrar:

- UUID do tenant Campinas: `SELECT id FROM tenants WHERE slug = 'campinas'`
- Emails dos admins vinculados em `tenant_members`
- Cobertura de backfill (% complaints com location/tenant_id)
