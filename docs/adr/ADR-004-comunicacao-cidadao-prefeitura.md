# ADR-004 — Comunicação cidadão ↔ prefeitura: deduplicação, push e chat

| Campo | Valor |
|-------|-------|
| **Status** | Proposto |
| **Data** | 2026-06-10 |
| **Decisores** | Equipe LifeCity |
| **Relacionado** | [ADR-001](ADR-001-multi-tenant-municipal.md) · [ADR-003](ADR-003-gestao-operacional-ocorrencias.md) |
| **Contrato** | [Fase 5 — Comunicação cidadão](../contracts/phase-5-citizen-communication.md) |

---

## 1. Contexto

Com o [ADR-003](ADR-003-gestao-operacional-ocorrencias.md) **aplicado em produção** (validado via Supabase MCP em jun/2026), a prefeitura opera ocorrências no admin-web: workflow municipal, equipes `ops_teams`, SLA, timeline em `complaint_events`. O app Flutter continua com UX legada: criação direta via formulário, detalhe em bottom sheet, status simplificado (`pending` / `in_progress` / `resolved`), notificações **somente in-app** (poll REST) e **sem FCM**.

### Estado atual — aplicativo e backend

| Camada | Situação |
|--------|----------|
| **Flutter — criação** | FAB no mapa → `CreateComplaintPage` direto. Sem passo de verificação de duplicatas. |
| **Flutter — proximidade** | Filtro client-side no mapa (5 km, score de relevância). Não reutilizado na criação. |
| **Flutter — detalhe** | `complaint_sheet.dart`: likes, witness, comentários, **3 status legados**. Sem timeline municipal, equipe ou chat. |
| **Flutter — notificações** | `NotificationPage` + badge no perfil. `NotificationSettingsPage` com toggles **locais** (não persistidos). Sem `firebase_messaging`. |
| **Android** | `AndroidManifest.xml`: internet + localização. Sem FCM, sem `google-services.json`, sem `POST_NOTIFICATIONS`. |
| **Backend — notificações** | Tabela `notifications`; tipos sociais + `complaint_status` via `complaintWorkflowService.notifyCitizen`. **Sem** push, **sem** tokens de dispositivo. |
| **Backend — workflow** | `notifyCitizen` só notifica `created_by` quando `isInternal === false`. Admin-web envia `isInternal: true` em status/atribuição → cidadão **não** é notificado na prática. |
| **Backend — interações** | `complaint_likes`, `complaint_witnesses`, comentários. Witness **não** gera notificação. **Sem** conceito de "watch". |
| **Backend — chat** | `team_messages` (gamificação). **Zero** mensagens ligadas a reclamações ou `ops_teams`. |
| **admin-web** | Gestão operacional ativa. Notas internas + timeline. **Sem** chat. Checkbox "nota interna" controla notificação pontual ao autor. |

### Inventário Supabase — validado MCP (jun/2026)

> Fonte: MCP `user-supabase-lifecity` — projeto Campinas (`tenants.slug = 'campinas'`).

#### Dados operacionais (já existem — ADR-003 aplicado)

| Objeto | Registros / detalhe |
|--------|---------------------|
| `complaints` | **210** ocorrências; **100%** com `location` (geometry) + `latitude`/`longitude`; **100%** com `tenant_id` |
| Status em uso | `pending`(78), `in_progress`(31), `triaged`(30), `assigned`(25), `resolved`(20), `cancelled`(16), `closed`(10) |
| `assigned_ops_team_id` | **116/210** (55%) com equipe atribuída |
| `complaint_events` | **439** eventos: `status_change`×236, `assignment`×202 |
| Eventos públicos (`is_internal = false`) | Apenas **30** `status_change`; **0** `assignment` públicos |
| `ops_teams` | **5** equipes (Campinas seed) |
| `ops_team_members` | **6** membros |
| `tenant_sla_policies` | **5** políticas |
| `tenants` | **1** tenant (`campinas`, cd_mun IBGE) |
| `tenant_members` | **7** gestores |

#### Interações cidadãs (base para watchers)

| Tabela | Registros | Constraints relevantes |
|--------|-----------|--------------------------|
| `complaint_likes` | 5 | `UNIQUE (complaint_id, user_id)` |
| `complaint_witnesses` | 1 | `UNIQUE (complaint_id, user_id)` |
| Autores distintos | 20 | em 210 ocorrências (dados demo) |

#### Infraestrutura geoespacial (dedup pronta)

| Recurso | Status |
|---------|--------|
| PostGIS | **3.3.7** instalado (`public`) |
| `complaints.location` | `geometry`, **210/210** preenchido |
| Índice espacial | `idx_complaints_location` — **GiST** em `location` |
| Pares duplicados potenciais | **18 pares** de ocorrências a ≤ 200 m entre si (em 210 total) |

#### Notificações existentes

| type | count | Observação |
|------|-------|------------|
| `complaint_status` | 30 | `reference_id` = ID bigint da ocorrência (texto) |
| `like`, `comment`, etc. | 4 | Tipos sociais legados |
| Coluna `payload` | **ausente** | Metadados de push precisam ser adicionados |
| Timestamps | `timestamp without time zone` | **Armadilha ADR-001** — novas colunas usar `timestamptz` ou SQL puro |

#### O que **não existe** no banco (precisa criar — Fase 5)

| Objeto | Fase |
|--------|------|
| `complaint_watchers` | 5a |
| `user_device_tokens` | 5a |
| `complaint_messages` | 5d |
| `complaint_message_keys` | 5e |
| `complaint_message_access_log` | 5e |
| Enum `complaint_watch_level` | 5a |
| Enum `complaint_message_sender` | 5d |
| Endpoint `/api/complaints/nearby` | 5a |
| Endpoint `/api/complaints/:id` (detalhe) | 5c |
| Endpoint `/api/complaints/:id/timeline` | 5c |

#### Extensões disponíveis (relevantes para Fase 5e)

| Extensão | Schema | Uso proposto |
|----------|--------|--------------|
| `pgcrypto` | `extensions` | AES-256-GCM at-rest (Fase 5e) |
| `supabase_vault` | `vault` | Alternativa futura à chave mestra em env |

#### Armadilhas de schema identificadas

1. **`complaint_likes.complaint_id`** e **`complaint_witnesses.complaint_id`** são `integer`; **`complaints.id`** é `bigint`. FK funciona, mas novas tabelas devem usar **`BIGINT`** para alinhar ao PK.
2. **`team_messages.created_at`** usa `timestamp without time zone` — **não replicar**; `complaint_messages` e `complaint_watchers` usam **`timestamptz`** (padrão de `complaint_events`).
3. **Fotos** não estão no Postgres — bucket Supabase Storage `complaints/{id}/`. Endpoint nearby deve gerar signed URL via `listBlobs` (mesmo padrão de `GET /:id/photos`).
4. **Timeline cidadã esparso hoje:** 202 eventos `assignment` são **todos** `is_internal = true`. A UI de tracking deve mostrar equipe via **JOIN em `complaints.assigned_ops_team_id`** (estado atual) e timeline via eventos públicos — ver D-005.
5. **Desalinhamento Flutter ↔ banco:** app reconhece 3 status; banco usa **7 status municipais**. Fase 5c é **obrigatória** antes de push de status fazer sentido ao cidadão.
6. **RLS:** maioria das tabelas `public.*` com RLS desabilitado — acesso via backend Node + JWT customizado (não Supabase Auth). Novas tabelas seguem o mesmo padrão; **não** habilitar RLS sem policies (bloquearia tudo).

### Problema

1. **Duplicatas** — cidadãos registram ocorrências redundantes no mesmo ponto porque não veem o que já existe antes de publicar.
2. **Acompanhamento passivo** — quem apoia ou confirma ("Também vi") não recebe atualizações quando a prefeitura avança o caso.
3. **Canal oficial inexistente** — gestores precisam de detalhes (foto extra, horário, acesso ao local) sem expor e-mail/telefone do cidadão em planilhas paralelas.
4. **Assimetria de informação** — o app não reflete workflow municipal, equipe atribuída nem histórico de status que já existe no banco.

### Restrição LGPD

Mensagens prefeitura ↔ cidadão contêm dados pessoais e contexto urbano sensível. Exige:
- Canal exclusivo autor ↔ prefeitura (sem exposição a terceiros).
- Criptografia em trânsito (HTTPS/TLS — já existente).
- Criptografia em repouso e controle de acesso documentado (sub-fase posterior se MVP for texto plano com RBAC estrito).
- Retenção e exclusão alinhadas ao ciclo de vida da ocorrência.

---

## 2. Objetivos

1. **Reduzir duplicatas** — passo obrigatório antes do formulário mostrando ocorrências próximas com preview.
2. **Push notifications** — FCM para acompanhar status de ocorrências "watching".
3. **Níveis de watch** — derivados de interações (apoio / witness / autor) + controle manual.
4. **Chat municipal** — canal assíncrono prefeitura ↔ autor da ocorrência, com push.
5. **Detalhe enriquecido** — timeline pública, equipe responsável, chat e status municipal traduzidos para o cidadão.
6. **Retrocompatibilidade** — APIs existentes preservadas; novos campos/endpoints aditivos.

## 3. Não-objetivos (escopo deste ADR)

- Chat entre cidadãos ou chat de `ops_teams` interno.
- Notificações de "reclamações próximas" genéricas (geofencing passivo) — toggle placeholder permanece backlog.
- Integração WhatsApp/SMS/e-mail transacional (além de push).
- App mobile para agentes de campo.
- Moderação de conteúdo do chat por IA.
- E2E encryption estilo Signal (fora de escopo; ver §7.4 para criptografia pragmática).

---

## 4. Personas

| Persona | Necessidade |
|---------|-------------|
| **Cidadão autor** | Saber andamento, conversar com prefeitura, evitar duplicar registro. |
| **Cidadão apoiador** | Ser avisado quando caso for resolvido/cancelado. |
| **Cidadão testemunha** | Acompanhar todas as mudanças de status. |
| **Operador municipal** | Solicitar detalhes, registrar contato oficial, ver histórico. |
| **Viewer municipal** | Ler chat e timeline; não enviar mensagens. |

---

## 5. Decisões arquiteturais

### D-001 — Passo de deduplicação antes do formulário

**Decisão:** ao tocar no FAB "Nova reclamação", abrir `NearbyCheckPage` (nome provisório) **antes** de `CreateComplaintPage`.

**Fluxo:**

```
FAB → NearbyCheckPage (GPS ou última posição conhecida)
    → GET /api/complaints/nearby?lat=&lng=&radius_m=&limit=
    → Lista cards (descrição truncada, 1ª foto, distância, status)
    → Tap abre complaint_sheet existente
    → Botão fixo inferior: "Não é nenhuma dessas" → CreateComplaintPage
```

**Raio padrão:** `200 m` (configurável via `NEARBY_COMPLAINT_RADIUS_M` no backend e espelho no Flutter). Motivo: duplicatas típicas são no mesmo trecho de via; 5 km (filtro do mapa) é amplo demais para dedup. Dado real Campinas: **18 pares** de ocorrências existentes a ≤ 200 m — valida a utilidade da feature.

**Query canônica (PostGIS — usa índice GiST existente):**

```sql
SELECT c.id, c.description, c.status, c.category, c.created_at,
       ST_Distance(
         c.location::geography,
         ST_SetSRID(ST_MakePoint($lng, $lat), 4326)::geography
       ) AS distance_m
FROM public.complaints c
WHERE c.is_hidden = FALSE
  AND c.location IS NOT NULL
  AND ST_DWithin(
        c.location::geography,
        ST_SetSRID(ST_MakePoint($lng, $lat), 4326)::geography,
        $radius_m
      )
  -- tenant: filtrar por cd_mun do usuário ou tenant_id quando autenticado
ORDER BY distance_m ASC
LIMIT $limit;
```

**Filtros adicionais:** `is_hidden = FALSE`; se autenticado, restringir por `cd_mun` do usuário (`users.home_cd_mun`) ou `tenant_id` derivado. Ordenação por `distance_m ASC`.

**Preview de fotos:** signed URL da 1ª foto via Storage (`complaints/{id}/`) — **não** há tabela de fotos. Implementar batch assíncrono no controller para evitar N+1 sequencial.

**Exceção:** se GPS indisponível após tentativa, exibir aviso e permitir pular para o formulário (não bloquear criação). Fallback opcional: centro Campinas (`-22.9099, -47.0626`) com banner "Usando localização aproximada".

---

### D-002 — Modelo `complaint_watchers` com níveis `basic` e `full`

**Decisão:** nova tabela `complaint_watchers` — uma linha por `(complaint_id, user_id)`.

```sql
-- Seguir padrão de enums existentes: tenant_role, ops_team_role
CREATE TYPE complaint_watch_level AS ENUM ('basic', 'full');
CREATE TYPE complaint_watch_source AS ENUM ('creator', 'like', 'witness', 'manual');

CREATE TABLE complaint_watchers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id BIGINT NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  level complaint_watch_level NOT NULL,
  source complaint_watch_source NOT NULL,
  muted_at TIMESTAMPTZ,          -- silenciou push desta ocorrência
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (complaint_id, user_id)
);

CREATE INDEX idx_complaint_watchers_complaint ON complaint_watchers (complaint_id);
CREATE INDEX idx_complaint_watchers_user ON complaint_watchers (user_id);
CREATE INDEX idx_complaint_watchers_notify
  ON complaint_watchers (complaint_id, level)
  WHERE muted_at IS NULL;
```

**Backfill na migration 021** (dados existentes em prod):

```sql
-- Autores → full / creator
INSERT INTO complaint_watchers (complaint_id, user_id, level, source)
SELECT c.id, c.created_by, 'full', 'creator'
FROM complaints c
WHERE c.created_by IS NOT NULL
ON CONFLICT (complaint_id, user_id) DO NOTHING;

-- Witnesses → full (prioridade sobre like)
INSERT INTO complaint_watchers (complaint_id, user_id, level, source)
SELECT cw.complaint_id::bigint, cw.user_id, 'full', 'witness'
FROM complaint_witnesses cw
ON CONFLICT (complaint_id, user_id) DO UPDATE
  SET level = 'full', source = 'witness', updated_at = NOW();

-- Likes sem witness → basic
INSERT INTO complaint_watchers (complaint_id, user_id, level, source)
SELECT cl.complaint_id::bigint, cl.user_id, 'basic', 'like'
FROM complaint_likes cl
WHERE NOT EXISTS (
  SELECT 1 FROM complaint_witnesses cw
  WHERE cw.complaint_id = cl.complaint_id AND cw.user_id = cl.user_id
)
ON CONFLICT (complaint_id, user_id) DO NOTHING;
```

**Regras de atribuição automática:**

| Evento | Nível resultante | `source` |
|--------|------------------|----------|
| Usuário **cria** ocorrência | `full` | `creator` |
| Usuário **confirma** ("Também vi") | `full` | `witness` |
| Usuário **apoia** (like) sem witness | `basic` | `like` |
| Usuário **apoia** já sendo witness | mantém `full` | `witness` |
| Botão manual "Acompanhar" | `full` | `manual` |
| Botão manual "Só avisos importantes" | `basic` | `manual` |

**Regras de downgrade/remoção:**

- Remove witness → se ainda liked, downgrade para `basic`; senão remove watcher (exceto `creator`).
- Remove like → se witness, mantém `full`; senão remove watcher (exceto `creator`).
- Autor **nunca** perde watch por toggle de like/witness; pode silenciar push via `muted_at`.
- `muted_at IS NOT NULL` → não envia push, mas mantém registro (útil para reativar).

**Notificações por nível em mudança de status:**

| Nível | Status que disparam push |
|-------|--------------------------|
| `basic` | `resolved`, `closed`, `cancelled` |
| `full` | **Qualquer** transição de status municipal visível ao cidadão |

Status terminais para `basic` incluem `closed` além de `resolved`/`cancelled` — encerramento formal da prefeitura.

---

### D-003 — Push via FCM; in-app via tabela `notifications` existente

**Decisão:** Firebase Cloud Messaging como transporte push mobile. Persistência in-app continua em `notifications`.

**Nova tabela:**

```sql
CREATE TABLE user_device_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform VARCHAR(10) NOT NULL CHECK (platform IN ('android', 'ios')),
  app_version VARCHAR(20),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, token)
);

CREATE INDEX idx_device_tokens_user ON user_device_tokens (user_id);
```

**Serviço:** `pushNotificationService.js` — recebe lista de `user_id`, monta payload FCM, registra falhas (token inválido → delete).

**Extensão obrigatória em `notifications` (tabela existente — 35 rows):**

```sql
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS payload JSONB;
-- Ex.: { "complaint_id": "403", "from_status": "assigned", "to_status": "in_progress",
--        "title": "Ocorrência em andamento", "body": "..." }
```

> **Nota:** `notifications.created_at` e `read_at` permanecem `timestamp without time zone` (legado). Novos INSERTs de notificação devem usar `NOW()` no SQL — nunca passar `Date` do Node.js (armadilha ADR-001). Colunas novas (`payload`) seguem convenção moderna; migração de timestamps legados fica fora de escopo.

**Tipos novos:**

| type | Quando |
|------|--------|
| `complaint_status` | (existente) qualquer watcher elegível |
| `complaint_message` | nova mensagem no chat municipal |
| `complaint_assigned` | (opcional fase 5c) equipe atribuída — só watchers `full` |

**Flutter:** adicionar `firebase_core`, `firebase_messaging`, `flutter_local_notifications` (foreground Android). Registrar token após login; refresh no `onTokenRefresh`.

**Android:** `google-services.json`, plugin Google Services, permissão `POST_NOTIFICATIONS` (API 33+).

**Deep link:** tap na push → abrir `complaint_sheet` ou tela dedicada `ComplaintTrackingPage` via `reference_type` + `reference_id`.

---

### D-004 — Desacoplar notificação ao cidadão de `isInternal` no workflow

**Decisão:** `isInternal` continua controlando visibilidade em `complaint_events` (API admin e timeline cidadã filtrada). **Notificação push/in-app para watchers** dispara sempre que houver transição de status, **independente** de `isInternal`.

**Motivo:** operadores precisam registrar notas internas sem spammar o cidadão, mas mudanças de status devem ser transparentes. Hoje o admin-web fixa `isInternal: true` em PATCH status. No banco: **206** `status_change` internos vs **30** públicos; as **30** notificações `complaint_status` existentes correspondem aos eventos públicos — confirmando que o fluxo atual silencia o cidadão na operação normal.

**Alteração em `complaintWorkflowService.transitionStatus`:**

1. Após UPDATE de status, chamar `notifyComplaintWatchers(complaintId, fromStatus, toStatus)` **independente de `isInternal`**.
2. `notifyCitizen` legado (só autor) → substituído pelo serviço de watchers (autor já é watcher `full` via backfill + create).
3. Notas (`addNote`) continuam respeitando `isInternal` — nota interna não gera push.
4. **`isInternal` passa a controlar apenas** visibilidade em `complaint_events` e timeline — **não** mais gating de push.

---

### D-005 — Timeline cidadã = subset de `complaint_events`

**Decisão:** combinar **estado atual** (JOIN em `complaints`) + **histórico** (subset de `complaint_events`).

#### Estado atual — `GET /api/complaints/:id` (endpoint **novo**)

Hoje o app consome apenas `GET /api/complaints` (lista bulk). Criar detalhe dedicado:

```json
{
  "complaint": {
    "id": 403,
    "description": "...",
    "status": "in_progress",
    "status_label": "Em andamento",
    "assigned_ops_team": { "id": "uuid", "name": "Limpeza Urbana" },
    "assigned_at": "2026-06-04T09:00:00Z",
    "sla_state": "on_track",
    "sla_due_at": "2026-06-12T18:00:00Z",
    "is_under_municipal_management": true,
    "watch": { "level": "full", "source": "creator", "muted": false }
  },
  "photos": ["signed-url-..."]
}
```

Campos operacionais já existem em `complaints`: `assigned_ops_team_id`, `assigned_at`, `sla_due_at`, `priority`, `resolved_at`, `closed_at`. JOIN com `ops_teams.name` para nome público da equipe.

#### Histórico — `GET /api/complaints/:id/timeline`

Retorna eventos com `is_internal = FALSE`:

| `event_type` | Label cidadão | Observação banco atual |
|--------------|---------------|------------------------|
| `status_change` | "Sua ocorrência está em andamento" | **30** eventos públicos existentes |
| `assignment` | "Equipe X assumiu o caso" | **0** públicos hoje — ver abaixo |
| `note` | Texto da nota pública | Raro; depende de operador desmarcar "interna" |
| `priority_change` | Omitido na v1 | — |

**Não expor:** `moderation`, `sla_breach`, eventos internos.

**Decisão complementar D-005b — eventos de atribuição públicos:**

Como **100%** dos 202 eventos `assignment` são `is_internal = true`, a timeline histórica ficaria vazia de atribuições. Duas ações:

1. **UI (Fase 5c):** card "Equipe responsável" sempre via JOIN no detalhe (estado atual) — **não depende de eventos**.
2. **Workflow (Fase 5c):** ao atribuir equipe, inserir **evento adicional** `assignment` com `is_internal = false` contendo `{ opsTeamName }` — ou alterar `assignComplaint` para gravar evento público de atribuição separado do evento interno de roteamento.

**Índice existente reutilizável:** `idx_complaint_events_complaint (complaint_id, created_at DESC)`.

---

### D-006 — Chat municipal assíncrono (fases)

**Decisão:** canal 1:1 **prefeitura (tenant)** ↔ **autor da ocorrência**. Identidade municipal unificada ("Prefeitura de Campinas"), não o nome individual do operador — reduz exposição e simplifica UX.

#### Fase 5d — MVP (texto plano, TLS, RBAC)

```sql
CREATE TYPE complaint_message_sender AS ENUM ('citizen', 'municipality');

CREATE TABLE complaint_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id BIGINT NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  sender_type complaint_message_sender NOT NULL,
  sender_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  body TEXT NOT NULL CHECK (char_length(body) <= 2000),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  read_by_citizen_at TIMESTAMPTZ,
  read_by_municipality_at TIMESTAMPTZ
);
```

**Permissões:**

| Ação | Quem |
|------|------|
| Ler/enviar como cidadão | `complaints.created_by` |
| Ler/enviar como prefeitura | `tenant_members` com role ≥ `operator` |
| Ler only | `viewer` |

**Endpoints citizen:** `GET/POST /api/complaints/:id/messages`  
**Endpoints admin:** `GET/POST /api/admin/complaints/:id/messages`

**Push:** `complaint_message` para autor (mensagem municipal) ou operadores da equipe atribuída / triagem (mensagem cidadã) — fase inicial: notificar autor + inbox badge admin (poll ou websocket futuro).

**admin-web:** painel de chat em `ComplaintDetailPage`, abaixo da gestão ou tab "Conversa com cidadão".

#### Fase 5e — Criptografia em repouso (LGPD)

**Decisão:** substituir `body TEXT` por `body_ciphertext BYTEA` + `body_nonce BYTEA`; chave simétrica AES-256-GCM por ocorrência (`complaint_message_keys`), envelope criptografado com chave mestra do tenant (`TENANT_MESSAGE_MASTER_KEY` em env / `supabase_vault` futuro).

> **Extensão `pgcrypto` 1.3 já instalada** no projeto Supabase (`extensions` schema) — usar `pgp_sym_encrypt`/`pgp_sym_decrypt` ou crypto Node.js com armazenamento BYTEA; avaliar na implementação.

**Escopo explícito da 5e:**
- Criptografia at-rest no PostgreSQL.
- Auditoria de acesso (`complaint_message_access_log`) para export LGPD.
- Migração de mensagens MVP → ciphertext.
- **Não** E2E client-side nesta fase.

**Justificativa:** entrega conformidade pragmática sem bloquear MVP; operadores leem via backend descriptografando — fluxo igual ao MVP, com camada de storage segura.

---

### D-007 — UI Flutter: detalhe enriquecido para "minhas ocorrências"

**Decisão:** evoluir `complaint_sheet.dart` **ou** nova `ComplaintTrackingPage` para ocorrências do próprio usuário / watch ativo, com:

1. Status municipal traduzido (7 estados ADR-003 + labels pt-BR).
2. Timeline vertical (eventos públicos).
3. Card equipe responsável.
4. Seção chat (autor only).
5. Controles de watch: nível atual, silenciar, deixar de acompanhar.

Bottom sheet permanece para visualização rápida no mapa; tracking page para acompanhamento profundo (link no perfil e deep link de push).

---

### D-008 — Botão de watch ao lado de Apoiar / Também vi

**Decisão:** na barra de engajamento do detalhe:

```
[ Apoiar ]  [ Também vi ]  [ 🔔 Acompanhar ▾ ]
```

- Se não watcher: menu → "Acompanhar tudo" / "Só resolução".
- Se watcher: indicador de nível + opção silenciar / parar.
- Apoio/witness continuam toggles independentes; watch é derivado **e** ajustável manualmente.

---

## 6. Mapa de status: municipal → cidadão

| Status admin (`complaints.status`) | Label Flutter | Notifica `basic` | Notifica `full` |
|-----------------------------------|---------------|------------------|-----------------|
| `pending` | Registrada | — | transição |
| `triaged` | Em análise | — | ✓ |
| `assigned` | Encaminhada | — | ✓ |
| `in_progress` | Em andamento | — | ✓ |
| `resolved` | Resolvida | ✓ | ✓ |
| `closed` | Encerrada | ✓ | ✓ |
| `reopened` | Reaberta | — | ✓ |
| `cancelled` | Cancelada | ✓ | ✓ |

Status legado `in_progress`/`resolved` do PATCH cidadão permanece até deprecação; quando `assigned_ops_team_id IS NOT NULL`, PATCH cidadão de status continua bloqueado (regra ADR-003).

---

## 7. Alternativas consideradas

| Alternativa | Prós | Contras | Veredito |
|-------------|------|---------|----------|
| Reutilizar `notifications` sem watchers | Simples | Não distingue basic/full; like ≠ interesse real | Rejeitada |
| Supabase Realtime para push | Sem Firebase | Flutter já sem Supabase SDK; FCM é padrão mobile | Rejeitada para mobile |
| Chat via `complaint_events` tipo `note` | Sem tabela nova | Mistura audit com conversa; difícil criptografar | Rejeitada |
| E2E encryption day-one | Máxima privacidade | Atraso 4–6 semanas; complexidade de chaves no mobile | Adiada (5e) |
| Deduplicação só client-side | Zero backend | Carrega todas reclamações; impreciso | Rejeitada |
| Notificar todos apoiadores igual witness | Menos código | Spam em transições intermediárias | Rejeitada |

---

## 8. Riscos e mitigações

| Risco | Mitigação |
|-------|-----------|
| Firebase não configurado no projeto | Documentar setup; feature flag `PUSH_ENABLED` |
| Spam de push em reaberturas | Respeitar `muted_at`; batching opcional futuro |
| Chat abusivo | Rate limit; limite 2000 chars; moderação via `reports` |
| Timeline cidadã vazia de atribuições | Card equipe via JOIN + evento público de assignment (D-005b) |
| Flutter exibe status errado (3 vs 7) | Fase 5c obrigatória antes de push de status |
| Signed URL lento no nearby (N+1) | Batch paralelo com limite; lazy load foto no card |
| Duplicatas mesmo com dedup | Raio configurável; futuro: similaridade textual |

---

## 9. Métricas de sucesso

- Redução ≥ 20% de ocorrências novas a < 200 m de existente (30 dias pós-deploy).
- ≥ 60% dos autores com push token registrado (90 dias).
- ≥ 40% dos witnesses mantêm watch `full` ativo.
- Tempo médio primeira resposta municipal no chat < 24 h (piloto Campinas).

---

## 10. Referências no código

| Área | Arquivos |
|------|----------|
| Criação Flutter | `lib/views/complaints/create_complaint_page.dart` |
| Detalhe Flutter | `lib/views/complaints/complaint_sheet.dart` |
| Mapa / proximidade | `lib/views/entrypoint/entrypoint_ui.dart` |
| Notificações Flutter | `lib/core/services/notification_service.dart`, `lib/views/profile/notification_page.dart` |
| Workflow backend | `backend/src/services/complaintWorkflowService.js` |
| Likes / witness | `backend/src/controllers/likeController.js`, `complaintController.js` (witness) |
| Admin gestão | `admin-web/src/components/complaints/ComplaintManagementPanel.tsx` |
| Chat equipes (referência polling) | `backend/src/controllers/missionController.js` (`team_messages`) |

---

## 11. Histórico

| Data | Alteração |
|------|-----------|
| 2026-06-10 | Proposta inicial — dedup, watchers, FCM, chat faseado |
| 2026-06-10 | Revisão pós MCP Supabase — inventário prod, PostGIS, backfill, D-005b |
