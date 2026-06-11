# Contrato de implementação — Fase 5: Comunicação cidadão ↔ prefeitura

| Campo | Valor |
|-------|-------|
| **ADR** | [ADR-004](../adr/ADR-004-comunicacao-cidadao-prefeitura.md) |
| **Status** | Proposto |
| **Pré-requisito** | ADR-003 Fase 4a+ **confirmado em prod** (MCP Supabase jun/2026): `ops_teams`, `complaint_events`, colunas operacionais, GiST em `location` |
| **Bloqueia** | Nenhuma fase posterior obrigatória |

---

## 1.1 Baseline Supabase (validado MCP — jun/2026)

| Item | Estado prod |
|------|-------------|
| `complaints` | 210 rows; 100% com `location` geometry + lat/lng |
| `idx_complaints_location` | GiST — **reutilizar** para nearby |
| `complaint_events` | 439 rows (236 status, 202 assignment) |
| Eventos públicos | 30 status_change; **0** assignment público |
| `ops_teams` / `tenant_sla_policies` | 5 cada (Campinas) |
| `complaint_likes` / `complaint_witnesses` | 5 / 1 — backfill watchers |
| `notifications` | 35 rows; **sem** coluna `payload` |
| `complaint_watchers` | **não existe** |
| `user_device_tokens` | **não existe** |
| `complaint_messages` | **não existe** |
| PostGIS | 3.3.7 |
| pgcrypto | 1.3 (extensão `extensions`) |
| Pares ≤ 200 m | 18 pares (validação dedup) |

**Migrations Supabase CLI:** lista vazia — schema gerenciado via `runMigration()` em `server.js`. Continuar padrão `021_*.sql` + registro em `server.js`.

## 1. Objetivo

Fechar o loop entre **app cidadão** e **admin-web municipal**: deduplicação na criação, push notifications por nível de interesse, detalhe enriquecido com timeline/equipe, e chat oficial prefeitura ↔ autor.

---

## 2. Sub-fases

```
Fase 5a ──► Fase 5b ──► Fase 5c ──► Fase 5d ──► Fase 5e
 Dedup API    Watch+FCM    Detalhe UX    Chat MVP    Cripto LGPD
```

| Sub-fase | Entrega principal | Flutter | Backend | admin-web |
|----------|-------------------|---------|---------|-----------|
| **5a** | API nearby + migrations watchers/tokens | — | ✓ | — |
| **5b** | Watch rules + push dispatch + FCM app | ✓ | ✓ | — |
| **5c** | Timeline citizen + tracking page + status municipal | ✓ | ✓ | ajuste notificações |
| **5d** | Chat texto plano + push mensagem | ✓ | ✓ | ✓ |
| **5e** | Criptografia at-rest + audit LGPD | — | ✓ | — |

**Ordem obrigatória:** 5a → 5b → 5c → 5d → 5e (5e opcional para go-live piloto).

---

## 3. Escopo

### 3.1 Incluído

- Passo `NearbyCheckPage` antes do formulário de criação
- Tabela `complaint_watchers` + lógica em like/witness/create
- FCM + `user_device_tokens` + serviço push
- Notificação desacoplada de `isInternal` para mudanças de status
- Timeline pública citizen + labels de status municipal
- Chat `complaint_messages` (MVP depois cripto)
- Painel chat no admin-web
- Deep link push → detalhe da ocorrência

### 3.2 Excluído

- Notificações geofenced "perto de você" (backlog)
- Chat entre cidadãos
- Chat interno `ops_teams`
- E2E encryption client-side
- WhatsApp/SMS
- Alteração do fluxo de denúncias (`reports`)

---

## 4. Invariantes

1. Endpoints citizen existentes (`POST /create`, likes, comments, witness) **mantêm contrato**; comportamento adicional é side-effect (watch).
2. `complaint_events` com `is_internal = true` **nunca** retornados em APIs citizen.
3. Apenas `created_by` acessa chat como cidadão.
4. Operador municipal (`tenant_members.role` ≥ `operator`) envia mensagens como `municipality`.
5. Timestamps calculados no SQL — nunca `Date` JS em `timestamp without time zone`.
6. Push falhou por token inválido → remover token; não falhar transação principal.
7. Autor (`creator`) sempre retém watch `full`; pode silenciar via `muted_at`.
8. Migrations via `backend/migrations/` + `runMigration` em `server.js`.

---

## 5. Fase 5a — API deduplicação + schema base

### 5.1 Migrations

**Arquivo:** `backend/migrations/021_complaint_watchers_and_tokens.sql`

Conteúdo completo (DDL validado contra schema prod):

```sql
-- Enums (padrão tenant_role / ops_team_role)
DO $$ BEGIN
  CREATE TYPE complaint_watch_level AS ENUM ('basic', 'full');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE complaint_watch_source AS ENUM ('creator', 'like', 'witness', 'manual');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS complaint_watchers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id BIGINT NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  level complaint_watch_level NOT NULL,
  source complaint_watch_source NOT NULL,
  muted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (complaint_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_complaint_watchers_complaint
  ON complaint_watchers (complaint_id);
CREATE INDEX IF NOT EXISTS idx_complaint_watchers_user
  ON complaint_watchers (user_id);
CREATE INDEX IF NOT EXISTS idx_complaint_watchers_notify
  ON complaint_watchers (complaint_id, level) WHERE muted_at IS NULL;

CREATE TABLE IF NOT EXISTS user_device_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform VARCHAR(10) NOT NULL CHECK (platform IN ('android', 'ios')),
  app_version VARCHAR(20),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, token)
);

CREATE INDEX IF NOT EXISTS idx_device_tokens_user ON user_device_tokens (user_id);

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS payload JSONB;

-- Backfill watchers a partir de dados existentes
INSERT INTO complaint_watchers (complaint_id, user_id, level, source)
SELECT c.id, c.created_by, 'full', 'creator'
FROM complaints c WHERE c.created_by IS NOT NULL
ON CONFLICT (complaint_id, user_id) DO NOTHING;

INSERT INTO complaint_watchers (complaint_id, user_id, level, source)
SELECT cw.complaint_id::bigint, cw.user_id, 'full', 'witness'
FROM complaint_witnesses cw
ON CONFLICT (complaint_id, user_id) DO UPDATE
  SET level = 'full', source = 'witness', updated_at = NOW();

INSERT INTO complaint_watchers (complaint_id, user_id, level, source)
SELECT cl.complaint_id::bigint, cl.user_id, 'basic', 'like'
FROM complaint_likes cl
WHERE NOT EXISTS (
  SELECT 1 FROM complaint_witnesses cw
  WHERE cw.complaint_id = cl.complaint_id AND cw.user_id = cl.user_id
)
ON CONFLICT (complaint_id, user_id) DO NOTHING;
```

Registrar em `server.js` após migration 020:

```javascript
['021_complaint_watchers_and_tokens', '021_complaint_watchers_and_tokens.sql'],
```

### 5.2 Endpoint nearby

```
GET /api/complaints/nearby
```

| Param | Tipo | Default | Descrição |
|-------|------|---------|-----------|
| `lat` | number | obrigatório | Latitude WGS84 |
| `lng` | number | obrigatório | Longitude WGS84 |
| `radius_m` | int | 200 | Raio em metros |
| `limit` | int | 10 | Máx resultados (cap 20) |

**Auth:** opcional (resultados públicos iguais `GET /complaints`); se autenticado, filtrar por `users.home_cd_mun` ou `complaints.tenant_id`.

**Query (PostGIS — 100% das ocorrências prod têm `location`; índice GiST existente):**

```sql
SELECT c.id, c.description, c.category, c.status, c.created_at,
       (SELECT COUNT(*)::int FROM complaint_likes cl WHERE cl.complaint_id = c.id) AS likes_count,
       (SELECT COUNT(*)::int FROM complaint_witnesses cw WHERE cw.complaint_id = c.id) AS witness_count,
       ST_Distance(
         c.location::geography,
         ST_SetSRID(ST_MakePoint($lng, $lat), 4326)::geography
       ) AS distance_m
FROM complaints c
WHERE c.is_hidden = FALSE
  AND c.location IS NOT NULL
  AND ST_DWithin(
        c.location::geography,
        ST_SetSRID(ST_MakePoint($lng, $lat), 4326)::geography,
        $radius_m
      )
  -- AND c.cd_mun = $userHomeCdMun  (quando autenticado)
ORDER BY distance_m ASC
LIMIT LEAST($limit, 20);
```

> **Nota:** fallback haversine só necessário se `location IS NULL` — **0 ocorrências** em prod hoje. Manter como safety net.

**Preview foto:** após query, batch `listBlobs('complaints', id, 3600)` — retornar URL da 1ª foto ou `null`. Paralelizar com `Promise.all` (cap 10).

**Resposta 200:**

```json
{
  "items": [
    {
      "id": 42,
      "description": "Buraco na via...",
      "type": "infraestrutura",
      "status": "in_progress",
      "distance_m": 87,
      "likes_count": 3,
      "witness_count": 1,
      "preview_photo_url": "https://...",
      "created_at": "2026-06-01T10:00:00Z"
    }
  ],
  "radius_m": 200,
  "center": { "lat": -22.91, "lng": -47.06 }
}
```

**Implementação:** `complaintController.getNearby` + rota **antes** de `/:id` em `complaintRoutes.js`.

### 5.3 Config

```env
NEARBY_COMPLAINT_RADIUS_M=200
PUSH_ENABLED=false          # true após Firebase configurado
FCM_SERVICE_ACCOUNT_JSON=   # path ou base64 — fase 5b
```

### 5.4 Critérios de aceite 5a

- [ ] Migration 021 aplicada no boot + backfill executado
- [ ] `complaint_watchers` populado: ~210 creators + likes/witnesses existentes
- [ ] `GET /nearby` retorna resultados ordenados por distância
- [ ] Ocorrências `is_hidden = TRUE` excluídas
- [ ] Query usa `ST_DWithin` (explain mostra uso de GiST)
- [ ] `preview_photo_url` preenchido quando há foto no Storage
- [ ] Teste SQL prod: pares a ≤ 200 m retornam na busca centrada entre eles

---

## 6. Fase 5b — Watchers + FCM

### 6.1 Serviço `complaintWatchService.js`

```javascript
// upsertWatch(complaintId, userId, level, source)
// removeWatchIfAllowed(complaintId, userId, reason)
// syncWatchFromLike(complaintId, userId, liked)
// syncWatchFromWitness(complaintId, userId, witnessed)
// syncWatchFromCreate(complaintId, userId)
// getWatchersForStatusNotify(complaintId, fromStatus, toStatus) → userId[]
// setMuted(complaintId, userId, muted)
// setManualLevel(complaintId, userId, level)
```

**Integração:**

| Ponto | Chamada |
|-------|---------|
| `complaintController.create` | `syncWatchFromCreate` |
| `likeController.toggle` (like true) | `syncWatchFromLike(true)` |
| `likeController.toggle` (like false) | `syncWatchFromLike(false)` |
| `complaintController.toggleWitness` | `syncWatchFromWitness` |

### 6.2 Serviço `pushNotificationService.js`

```javascript
// registerToken(userId, token, platform)
// unregisterToken(userId, token)
// sendToUsers(userIds, { title, body, data })
// sendComplaintStatus(complaintId, fromStatus, toStatus)
// sendComplaintMessage(complaintId, messageId)
```

**Fluxo status:** `complaintWorkflowService.transitionStatus` → após COMMIT → `sendComplaintStatus` (async, não bloqueia).

**In-app + push:** inserir `notifications` com `payload` JSON; push espelha title/body.

### 6.3 Endpoints device tokens

```
POST   /api/users/device-token     { token, platform, app_version? }
DELETE /api/users/device-token     { token }
```

Auth obrigatório.

### 6.4 Endpoints watch (citizen)

```
GET    /api/complaints/:id/watch           → { level, source, muted }
PATCH  /api/complaints/:id/watch           → { level: 'basic'|'full', muted?: boolean }
DELETE /api/complaints/:id/watch           → remove se source=manual|like (não creator)
```

### 6.5 Alteração workflow

Em `complaintWorkflowService.js`:

- Remover/not substituir `notifyCitizen` isolado.
- Chamar `complaintWatchService.notifyStatusChange(...)` **sempre** que `fromStatus !== toStatus`.
- Respeitar `muted_at` e nível basic/full.

### 6.6 Flutter

**Dependências (`pubspec.yaml`):**

```yaml
firebase_core: ^3.x
firebase_messaging: ^15.x
flutter_local_notifications: ^18.x
```

**Arquivos novos/alterados:**

| Arquivo | Mudança |
|---------|---------|
| `lib/core/services/push_service.dart` | init FCM, token sync, handlers |
| `lib/main.dart` | Firebase.initializeApp |
| `android/app/build.gradle` | google-services plugin |
| `android/app/src/main/AndroidManifest.xml` | POST_NOTIFICATIONS, FCM meta |
| `lib/views/complaints/nearby_check_page.dart` | **5a UI pode entrar aqui** |
| `lib/views/complaints/complaint_sheet.dart` | botão watch + ícone nível |
| `lib/views/profile/notification_page.dart` | handler tap → deep link |
| `lib/core/services/notification_service.dart` | tipo `complaint_status`, `complaint_message` |

**Fluxo criação (5a UI + 5b watch):**

```
entrypoint FAB → NearbyCheckPage → [Não é nenhuma dessas] → CreateComplaintPage
```

**NearbyCheckPage:**

- Solicita permissão GPS; loading skeleton.
- Chama `GET /api/complaints/nearby`.
- Lista `NearbyComplaintCard` (foto, descrição 2 linhas, distância, badge status).
- Tap → `showComplaintSheet`.
- Texto: "Sua ocorrência já existe aqui?"
- FAB inferior: `Não é nenhuma dessas`.

### 6.7 Critérios de aceite 5b

- [ ] Like cria watch `basic`; witness cria/atualiza `full`
- [ ] Criador tem watch `full` automático
- [ ] Transição para `resolved` notifica watchers `basic` + `full`
- [ ] Transição para `triaged` notifica só `full`
- [ ] Token registrado após login; push recebida em device físico Android
- [ ] Tap push abre ocorrência correta
- [ ] `NotificationSettingsPage` persiste preferência global push on/off (AsyncStorage + backend flag futuro)

---

## 7. Fase 5c — Detalhe enriquecido + timeline

### 7.1 Endpoint timeline citizen

```
GET /api/complaints/:id/timeline
```

Auth: opcional; se logado e autor, inclui eventos públicos.

**Resposta:**

```json
{
  "events": [
    {
      "id": "uuid",
      "type": "status_change",
      "label": "Em andamento",
      "description": "Sua ocorrência está sendo atendida.",
      "created_at": "2026-06-05T14:00:00Z",
      "payload": { "from": "assigned", "to": "in_progress" }
    },
    {
      "id": "uuid",
      "type": "assignment",
      "label": "Equipe responsável",
      "description": "Limpeza Urbana",
      "created_at": "2026-06-04T09:00:00Z"
    }
  ]
}
```

Filtro SQL (reutiliza índice `idx_complaint_events_complaint`):

```sql
SELECT ce.id, ce.event_type, ce.payload, ce.created_at
FROM complaint_events ce
WHERE ce.complaint_id = $1
  AND ce.is_internal = FALSE
  AND ce.event_type IN ('status_change', 'assignment', 'note')
ORDER BY ce.created_at ASC;
```

> **Dado prod:** apenas **30** eventos passam este filtro (todos `status_change`). **0** `assignment` públicos. Card de equipe **obrigatoriamente** via JOIN — não depender só da timeline.

### 7.1b Workflow — evento público de atribuição

Alterar `complaintWorkflowService.assignComplaint`:

```javascript
// Após atribuir equipe, além do evento interno existente:
await insertEvent(client, {
  complaintId, tenantId, actorId,
  eventType: 'assignment',
  payload: { opsTeamId, opsTeamName: team.name, public: true },
  isInternal: false,  // visível ao cidadão
});
```

Isso passa a popular a timeline para as **116** ocorrências já com equipe (novas atribuições; histórico antigo continua só via card JOIN).

### 7.2 GET /api/complaints/:id (endpoint novo)

Hoje o app usa listagem bulk. Detalhe dedicado com JOINs existentes:

```sql
SELECT c.*,
       ot.id AS team_id, ot.name AS team_name,
       cc.slug AS category_slug, cc.name AS category_name,
       cw.level AS watch_level, cw.source AS watch_source,
       (cw.muted_at IS NOT NULL) AS watch_muted
FROM complaints c
LEFT JOIN ops_teams ot ON ot.id = c.assigned_ops_team_id
LEFT JOIN complaint_categories cc ON cc.id = c.category_id
LEFT JOIN complaint_watchers cw ON cw.complaint_id = c.id AND cw.user_id = $userId
WHERE c.id = $1 AND c.is_hidden = FALSE;
```

Campos derivados no controller:

| Campo API | Fonte DB |
|-----------|----------|
| `status_label` | mapa ADR-004 §6 |
| `sla_state` | `computeSlaState(c.sla_due_at, c.status)` — reutilizar `slaService.js` |
| `is_under_municipal_management` | `isUnderMunicipalManagement()` — reutilizar workflow service |
| `assigned_ops_team` | `{ id: team_id, name: team_name }` — **116/210** ocorrências prod têm valor |
| `watch` | `{ level, source, muted }` — null se anônimo |

### 7.3 Flutter — ComplaintTrackingPage

Rota: `/complaint/:id/track`

Seções:
1. Header status + SLA badge
2. Timeline (`ComplaintTimelineCitizenWidget`)
3. Equipe responsável (card)
4. Placeholder chat (5d) ou seção bloqueada "Em breve"
5. Engajamento (like, witness, watch)

**Status map estendido** em `complaint_sheet.dart`:

```dart
static const _municipalStatusMap = {
  'pending':     ('Registrada', ...),
  'triaged':     ('Em análise', ...),
  'assigned':    ('Encaminhada', ...),
  'in_progress': ('Em andamento', ...),
  'resolved':    ('Resolvida', ...),
  'closed':      ('Encerrada', ...),
  'reopened':    ('Reaberta', ...),
  'cancelled':   ('Cancelada', ...),
};
```

**Perfil:** tap em "minha ocorrência" → `ComplaintTrackingPage` (não só bottom sheet).

### 7.4 admin-web

- Remover `isInternal: true` fixo em PATCH status **ou** documentar que notificação não depende mais dele.
- Opcional: checkbox "Registrar sem notificar" **removido** para status (notificação segue watchers); manter para **notas** internas.

### 7.5 Critérios de aceite 5c

- [ ] Autor vê timeline com mudanças de status públicas (≥ 30 eventos existentes em prod)
- [ ] Card equipe visível via JOIN quando `assigned_ops_team_id IS NOT NULL` (116 casos prod)
- [ ] Novas atribuições geram evento `assignment` público na timeline
- [ ] `_municipalStatusMap` cobre os 7 status presentes no banco (incl. `triaged`, `assigned`, `closed`, `cancelled`)
- [ ] Usuário não-autor vê detalhe/timeline pública (sem chat, sem watch)
- [ ] `complaint_sheet.dart` exibe label correto para ocorrências em `triaged`/`assigned` (hoje caem em fallback)

---

## 8. Fase 5d — Chat municipal MVP

### 8.1 Migration

**Arquivo:** `backend/migrations/022_complaint_messages.sql`

> **Referência:** `team_messages` existe (gamificação) mas usa `timestamp without time zone` — **não copiar**. Usar `timestamptz` como `complaint_events`.

```sql
DO $$ BEGIN
  CREATE TYPE complaint_message_sender AS ENUM ('citizen', 'municipality');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS complaint_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id BIGINT NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  sender_type complaint_message_sender NOT NULL,
  sender_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  body TEXT NOT NULL CHECK (char_length(body) <= 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_by_citizen_at TIMESTAMPTZ,
  read_by_municipality_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_complaint_messages_thread
  ON complaint_messages (complaint_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_complaint_messages_tenant
  ON complaint_messages (tenant_id, created_at DESC);
```

`display_name` municipal = `tenants.display_name` (prod: **"Campinas"** — formatar como "Prefeitura de {display_name}" no controller).

### 8.2 Endpoints citizen

```
GET  /api/complaints/:id/messages?limit=50&before=<uuid>
POST /api/complaints/:id/messages     { body: string }
PATCH /api/complaints/:id/messages/read   → marca read_by_citizen_at
```

Guard: `created_by === req.userId`.

### 8.3 Endpoints admin

```
GET  /api/admin/complaints/:id/messages?limit=50&before=<uuid>
POST /api/admin/complaints/:id/messages     { body: string }
PATCH /api/admin/complaints/:id/messages/read
```

Guard: `requireTenantRole('operator')`.

**Resposta message:**

```json
{
  "id": "uuid",
  "sender_type": "municipality",
  "body": "Pode enviar foto do número da placa?",
  "created_at": "...",
  "read_by_citizen_at": null,
  "display_name": "Prefeitura de Campinas"
}
```

`display_name` calculado no backend — cidadão nunca vê nome do operador.

### 8.4 Push

| Remetente | Destinatários push |
|-----------|-------------------|
| `municipality` | Autor (se `muted_at` null no watch) |
| `citizen` | Membros `operator+` do tenant — fase MVP: push opcional; badge in-app admin via poll 30s ou refresh manual |

Tipo notificação: `complaint_message`.

### 8.5 Flutter

- `ComplaintChatSection` em `ComplaintTrackingPage` (autor only)
- Polling 10s quando tela ativa (mesmo padrão `team_detail_page`)
- Input + lista bubbles (estilo chat equipe)
- Push abre tracking na aba chat

### 8.6 admin-web

**Arquivo:** `admin-web/src/components/complaints/ComplaintChatPanel.tsx`

- Integrar em `ComplaintDetailPage.tsx` aba "Conversa"
- Avatar prefeitura / cidadão
- Indicador mensagens não lidas
- Desabilitado se ocorrência sem `created_by`

### 8.7 Rate limits

- 10 mensagens/minuto por usuário por ocorrência
- 429 com `{ message: 'Aguarde antes de enviar outra mensagem.' }`

### 8.8 Critérios de aceite 5d

- [ ] Autor envia mensagem; operador vê no admin
- [ ] Operador responde; autor recebe push + vê no app
- [ ] Viewer admin lê mas não envia (403)
- [ ] Usuário que não é autor recebe 403 no GET messages

---

## 9. Fase 5e — Criptografia at-rest (LGPD)

### 9.1 Migration

**Arquivo:** `backend/migrations/023_complaint_messages_encryption.sql`

- `complaint_message_keys (complaint_id BIGINT PK, tenant_id UUID, encrypted_key BYTEA, created_at TIMESTAMPTZ)`
- Alter `complaint_messages`: `body` → nullable; add `body_ciphertext BYTEA`, `body_nonce BYTEA`
- `complaint_message_access_log (id, message_id, accessor_user_id, action, created_at TIMESTAMPTZ)`

> **Extensão `pgcrypto` 1.3 já instalada** no Supabase LifeCity (`extensions` schema). Avaliar `pgp_sym_encrypt` vs crypto Node.js; `supabase_vault` disponível para evolução futura da chave mestra.

### 9.2 Serviço `messageCryptoService.js`

```javascript
// getOrCreateComplaintKey(complaintId, tenantId)
// encryptBody(complaintId, plaintext) → { ciphertext, nonce }
// decryptBody(complaintId, ciphertext, nonce) → plaintext
```

Chave mestra: `TENANT_MESSAGE_MASTER_KEY` (32 bytes base64) ou derivada por tenant via HKDF.

### 9.3 Migração dados MVP

Script `backend/scripts/migrate-complaint-messages-encrypt.js`:
- Lê `body` plaintext
- Escreve ciphertext
- Null `body`

### 9.4 API

Contrato externo **inalterado** (request/response JSON com `body` string). Criptografia transparente no controller.

### 9.5 Critérios de aceite 5e

- [ ] Novas mensagens sem `body` plaintext no banco
- [ ] Leitura admin/app funciona igual MVP
- [ ] Log de acesso em cada decrypt batch admin
- [ ] Documentação LGPD em `docs/compliance/chat-lgpd.md` (retention: vida da ocorrência + 5 anos)

---

## 10. Matriz de notificações (referência)

| Evento | basic | full | Push | In-app |
|--------|-------|------|------|--------|
| status → triaged | — | ✓ | ✓ | ✓ |
| status → assigned | — | ✓ | ✓ | ✓ |
| status → in_progress | — | ✓ | ✓ | ✓ |
| status → resolved | ✓ | ✓ | ✓ | ✓ |
| status → closed | ✓ | ✓ | ✓ | ✓ |
| status → cancelled | ✓ | ✓ | ✓ | ✓ |
| status → reopened | — | ✓ | ✓ | ✓ |
| nota interna | — | — | — | — |
| nota pública | — | ✓* | ✓* | ✓* |
| nova msg chat (autor) | — | ✓ | ✓ | ✓ |
| like recebido | — | — | — | ✓ (existente) |

\*Nota pública: considerar watcher `full` ou sempre autor — **decisão:** sempre autor + watchers `full`.

---

## 11. Setup Firebase (checklist operacional)

1. Criar projeto Firebase vinculado ao app Android (`com...lifecity`).
2. Baixar `google-services.json` → `android/app/`.
3. Gerar service account → `FCM_SERVICE_ACCOUNT_JSON` no backend.
4. iOS: `GoogleService-Info.plist` (fase futura).
5. Definir `PUSH_ENABLED=true` em staging antes de prod.

---

## 12. Testes

| ID | Cenário |
|----|---------|
| T-5a-1 | Nearby retorna vazio em área sem ocorrências |
| T-5a-2 | Nearby exclui hidden |
| T-5b-1 | Like → watch basic; status resolved → push |
| T-5b-2 | Witness → full; status triaged → push |
| T-5b-3 | Muted → sem push, in-app opcional |
| T-5c-1 | Timeline filtra internal |
| T-5d-1 | Chat round-trip autor ↔ operador |
| T-5d-2 | Não-autor 403 |
| T-5e-1 | DB sem plaintext após migração |

---

## 13. Rollout sugerido (Campinas piloto)

1. Deploy 5a+5b backend; `PUSH_ENABLED=false`.
2. Release Flutter com NearbyCheck + watch UI; FCM coleta tokens.
3. Ativar push staging; validar 1 semana.
4. Deploy 5c timeline.
5. Deploy 5d chat; treinar operadores.
6. 5e antes de escala > 1000 ocorrências/mês ou exigência jurídica formal.

---

## 14. Referência cruzada de arquivos a criar/alterar

### Backend (novos)

- `migrations/021_complaint_watchers_and_tokens.sql`
- `migrations/022_complaint_messages.sql`
- `migrations/023_complaint_messages_encryption.sql`
- `services/complaintWatchService.js`
- `services/pushNotificationService.js`
- `services/messageCryptoService.js` (5e)
- `controllers/deviceTokenController.js`
- `controllers/complaintMessageController.js`

### Backend (alterar)

- `routes/complaintRoutes.js`
- `routes/userRoutes.js` (device token)
- `routes/adminRoutes.js` (messages)
- `controllers/complaintController.js` (nearby, getById, timeline)
- `controllers/likeController.js`
- `services/complaintWorkflowService.js`
- `server.js` (migrations 021+)

### Flutter (novos)

- `lib/views/complaints/nearby_check_page.dart`
- `lib/views/complaints/complaint_tracking_page.dart`
- `lib/widgets/complaint_timeline_citizen.dart`
- `lib/widgets/complaint_chat_section.dart`
- `lib/core/services/push_service.dart`

### admin-web (novos)

- `src/components/complaints/ComplaintChatPanel.tsx`
- `src/api/admin/complaintMessages.ts`

### admin-web (alterar)

- `src/pages/ComplaintDetailPage.tsx`
- `src/components/complaints/ComplaintManagementPanel.tsx` (isInternal status)
