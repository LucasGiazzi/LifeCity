# Prompts para agentes — Fase 5 (ADR-004)

Dois agentes independentes. **Ordem de execução:** Agente A (5a→5b→5c) **antes** do Agente B (5d→5e).

Documentos canônicos (ler primeiro):
- `docs/adr/ADR-004-comunicacao-cidadao-prefeitura.md`
- `docs/contracts/phase-5-citizen-communication.md`
- `CLAUDE.md` (armadilhas: timestamps, RLS, Material Symbols)

Repositório: `c:\WS\LifeCity`

---

## Agente A — Fases 5a + 5b + 5c

### A1 — EXPLORE (somente leitura)

```
Você está no projeto LifeCity (Flutter + Node/Express + admin-web + Supabase Postgres).

Tarefa: EXPLORAÇÃO READ-ONLY para implementar Fases 5a, 5b e 5c do ADR-004.
NÃO altere arquivos. NÃO crie commits.

Leia obrigatoriamente:
- docs/adr/ADR-004-comunicacao-cidadao-prefeitura.md
- docs/contracts/phase-5-citizen-communication.md (§5, §6, §7)
- CLAUDE.md (seções ADR-003 e ADR-004)

Escopo EXCLUSIVO deste agente:
- 5a: migration 021 + GET /api/complaints/nearby
- 5b: complaintWatchService, pushNotificationService, FCM Flutter, NearbyCheckPage, watch UI
- 5c: GET /api/complaints/:id, GET /api/complaints/:id/timeline, ComplaintTrackingPage, status municipal, evento assignment público

FORA DE ESCOPO (agente B): complaint_messages, chat, migration 022/023, ComplaintChatPanel admin.

Explore e documente:

BACKEND
1. backend/src/server.js — padrão runMigration(), onde registrar 021
2. backend/src/routes/complaintRoutes.js — ordem de rotas (/nearby ANTES de /:id)
3. backend/src/controllers/complaintController.js — create, getPhotos, listBlobs pattern
4. backend/src/controllers/likeController.js — toggle like
5. backend/src/services/complaintWorkflowService.js — notifyCitizen, transitionStatus, assignComplaint
6. backend/src/services/slaService.js — computeSlaState (reutilizar em 5c)
7. backend/src/services/complaintGeoService.js — geo existente
8. backend/src/routes/userRoutes.js ou app.js — onde adicionar device-token
9. Listar como listBlobs/signing de fotos funciona (Storage Supabase)

FLUTTER
10. lib/views/entrypoint/entrypoint_ui.dart — FAB criação reclamação
11. lib/views/complaints/create_complaint_page.dart
12. lib/views/complaints/complaint_sheet.dart — likes, witness, status map (3 status hoje)
13. lib/core/services/complaint_service.dart — endpoints atuais
14. lib/core/services/notification_service.dart + notification_model.dart
15. lib/views/profile/notification_page.dart — deep link ausente
16. lib/core/routes/app_routes.dart + on_generate_route.dart
17. lib/views/team/team_detail_page.dart — referência polling 5s (NÃO implementar chat)

ADMIN-WEB (só 5c)
18. admin-web/src/components/complaints/ComplaintManagementPanel.tsx — isInternal: true fixo

ANDROID
19. android/app/build.gradle, AndroidManifest.xml — estado FCM (ausente)

OPCIONAL — validar schema prod via MCP user-supabase-lifecity:
- list_tables verbose public
- confirmar: complaint_watchers NÃO existe; idx_complaints_location GiST existe
- complaints: 100% com location

Entregável: relatório markdown com:
- Mapa arquivo → responsabilidade → o que muda em 5a/5b/5c
- Dependências entre sub-fases (5b depende 021 aplicada; 5c depende watchers + push opcional)
- Riscos/blockers (Firebase não configurado? google-services.json ausente?)
- Lista ordenada de arquivos a criar/alterar
- Gaps vs contrato §5–§7
- Checklist critérios de aceite §5.4, §6.7, §7.5 com estado atual (pass/fail)
```

---

### A2 — EXECUTE (implementação)

```
Você está no projeto LifeCity. Implemente Fases 5a → 5b → 5c conforme ADR-004 e docs/contracts/phase-5-citizen-communication.md.

Pré-requisito: leia ADR-004, contrato Fase 5 §5–§7, CLAUDE.md.
Se ainda não explorou, faça exploração rápida dos arquivos listados no prompt A1.

ORDEM OBRIGATÓRIA: 5a completa → 5b → 5c. Não pule.

=== FASE 5a (backend only) ===

1. Criar backend/migrations/021_complaint_watchers_and_tokens.sql
   - DDL exato do contrato §5.1 (enums, complaint_watchers, user_device_tokens, notifications.payload, backfill)
   - complaint_id BIGINT; timestamptz em colunas novas

2. Registrar migration em backend/src/server.js

3. GET /api/complaints/nearby em complaintController + rota ANTES de /:id
   - PostGIS ST_DWithin + ST_Distance (índice GiST)
   - is_hidden = FALSE; filtro cd_mun se autenticado
   - preview_photo_url via listBlobs batch (paralelo, cap 10)
   - Env NEARBY_COMPLAINT_RADIUS_M default 200

4. Verificar: reiniciar backend ou runMigration; testar endpoint manualmente

Critérios §5.4: todos devem passar antes de 5b.

=== FASE 5b (backend + Flutter) ===

BACKEND:
5. backend/src/services/complaintWatchService.js — API do contrato §6.1
6. Integrar em: complaintController.create, likeController.toggle, toggleWitness
7. backend/src/services/pushNotificationService.js — FCM; PUSH_ENABLED=false default
8. Endpoints:
   - POST/DELETE /api/users/device-token
   - GET/PATCH/DELETE /api/complaints/:id/watch
9. complaintWorkflowService: notifyStatusChange via watchers SEMPRE em status change (ignorar isInternal para push)
   - INSERT notifications com payload JSONB; NOW() no SQL para timestamps legados
10. Matriz basic/full conforme ADR-004 §6 e contrato §10

FLUTTER:
11. NearbyCheckPage + alterar FAB em entrypoint_ui.dart
12. complaint_service.dart — nearby, watch endpoints
13. firebase_core, firebase_messaging, flutter_local_notifications
14. push_service.dart; registrar token pós-login
15. android: google-services plugin, POST_NOTIFICATIONS (placeholder google-services.json se ausente — documentar)
16. complaint_sheet.dart — botão watch (🔔)
17. notification_page.dart — tap abre ocorrência (complaint_status)

Critérios §6.7: validar watch rules mesmo com PUSH_ENABLED=false (in-app notifications).

=== FASE 5c (backend + Flutter + admin-web mínimo) ===

BACKEND:
18. GET /api/complaints/:id — detalhe com JOIN ops_teams, categories, complaint_watchers
19. GET /api/complaints/:id/timeline — eventos is_internal=false
20. assignComplaint: inserir evento assignment is_internal=false (§7.1b)
21. Mapa status_label (7 status municipais)

FLUTTER:
22. ComplaintTrackingPage + rota /complaint/:id/track
23. complaint_timeline_citizen.dart widget
24. Estender _municipalStatusMap em complaint_sheet.dart (7 status)
25. Perfil → minhas ocorrências abre tracking page
26. Placeholder "Chat em breve" (5d é outro agente)

ADMIN-WEB:
27. ComplaintManagementPanel: documentar/remover dependência de isInternal para notificação (nota interna mantém checkbox)

NÃO IMPLEMENTAR: complaint_messages, chat UI, migration 022/023.

INVARIANTES (contrato §4):
- Endpoints existentes intactos; watch é side-effect
- Timestamps: NOW() no SQL, nunca Date JS em timestamp without time zone
- Autor watch full não removível por toggle like/witness

Ao finalizar, entregue:
- Resumo do que foi feito por sub-fase
- Checklist §5.4 / §6.7 / §7.5 marcado
- O que ficou bloqueado (Firebase, device físico, etc.)
- Handoff para Agente B: "5c entregue; ComplaintTrackingPage tem placeholder chat; pushNotificationService.sendComplaintMessage stub OK"
- NÃO commitar salvo se pedido explicitamente
```

---

## Agente B — Fases 5d + 5e

> **Pré-requisito:** Agente A concluiu 5a–5c (migration 021, watchers, push service, ComplaintTrackingPage existente).

### B1 — EXPLORE (somente leitura)

```
Você está no projeto LifeCity. EXPLORAÇÃO READ-ONLY para Fases 5d e 5e (chat municipal + cripto LGPD).

NÃO altere arquivos.

Leia:
- docs/adr/ADR-004-comunicacao-cidadao-prefeitura.md (D-006, Fase 5d/5e)
- docs/contracts/phase-5-citizen-communication.md (§8, §9)
- CLAUDE.md

Confirme que Agente A entregou (grep/read):
- complaint_watchers existe (migration 021)
- pushNotificationService.js existe com sendComplaintMessage ou stub
- ComplaintTrackingPage existe em lib/
- GET /api/complaints/:id funciona

Escopo EXCLUSIVO:
- 5d: complaint_messages, chat citizen + admin, push complaint_message, ComplaintChatPanel
- 5e: criptografia at-rest, messageCryptoService, migration 023, audit log

Explore:

BACKEND
1. backend/src/controllers/missionController.js — team_messages GET/POST (padrão polling, paginação cursor)
2. pushNotificationService.js (criado pelo Agente A) — estender para mensagens
3. backend/src/routes/adminRoutes.js — padrão requireTenantRole
4. backend/src/controllers/admin/adminComplaintsController.js
5. complaintWorkflowService / tenantService — tenant_id em complaints

FLUTTER
6. lib/views/complaints/complaint_tracking_page.dart (Agente A)
7. lib/views/team/team_detail_page.dart — UI bubbles chat (copiar estilo)
8. complaint_service.dart — endpoints atuais

ADMIN-WEB
9. admin-web/src/pages/ComplaintDetailPage.tsx — layout tabs
10. admin-web/src/components/complaints/ComplaintManagementPanel.tsx
11. admin-web/src/api/admin/complaintOperations.ts — padrão adminFetch

SUPABASE (MCP user-supabase-lifecity):
- confirmar complaint_messages NÃO existe
- confirmar pgcrypto 1.3 instalado (extensions schema)

Entregável:
- Mapa de integração chat ↔ push ↔ watchers (muted_at)
- Diferenças team_messages vs complaint_messages (timestamptz!)
- Plano migration 022 + 023
- RBAC matrix (citizen autor, operator+, viewer read-only)
- Riscos LGPD e ordem 5d antes de 5e
- Checklist §8.8 / §9.5
```

---

### B2 — EXECUTE (implementação)

```
Você está no projeto LifeCity. Implemente Fases 5d → 5e (chat municipal).

Pré-requisito: 5a–5c já implementadas (watchers, push service, ComplaintTrackingPage).
Leia contrato §8–§9 e ADR-004 D-006.

ORDEM: 5d MVP completo → 5e criptografia (5e pode ser feature-flag se bloqueado).

=== FASE 5d ===

BACKEND:
1. backend/migrations/022_complaint_messages.sql — DDL contrato §8.1
2. Registrar em server.js
3. backend/src/controllers/complaintMessageController.js (citizen + admin handlers)
4. Rotas:
   - GET/POST/PATCH /api/complaints/:id/messages (+ read)
   - GET/POST/PATCH /api/admin/complaints/:id/messages (+ read)
5. Guards: created_by para citizen; requireTenantRole('operator') POST admin; viewer GET only
6. display_name = "Prefeitura de " + tenants.display_name (nunca nome do operador)
7. Rate limit 10 msg/min/usuário/ocorrência → 429
8. Push tipo complaint_message via pushNotificationService (autor quando municipality envia)
9. Paginação cursor `before` uuid, limit 50 — copiar padrão team_messages

FLUTTER:
10. lib/widgets/complaint_chat_section.dart
11. Integrar em ComplaintTrackingPage (substituir placeholder) — só autor
12. Polling 10s quando tela ativa
13. Push deep link → tracking aba chat
14. complaint_service.dart — messages endpoints

ADMIN-WEB:
15. admin-web/src/api/admin/complaintMessages.ts
16. admin-web/src/components/complaints/ComplaintChatPanel.tsx
17. ComplaintDetailPage — tab "Conversa com cidadão"
18. Polling ou refresh manual (MVP)

Critérios §8.8 todos passando.

=== FASE 5e (opcional go-live, obrigatório se pedido) ===

19. backend/migrations/023_complaint_messages_encryption.sql
20. backend/src/services/messageCryptoService.js — AES-256-GCM ou pgcrypto
21. Controller: encrypt on write, decrypt on read; API JSON inalterada (body string)
22. backend/scripts/migrate-complaint-messages-encrypt.js
23. complaint_message_access_log em cada batch decrypt admin
24. docs/compliance/chat-lgpd.md — retenção 5 anos pós-ocorrência
25. Env TENANT_MESSAGE_MASTER_KEY

INVARIANTES:
- timestamptz em complaint_messages (NÃO copiar team_messages timestamp without tz)
- complaint_id BIGINT FK
- Chat só autor ↔ prefeitura; sem RLS Supabase

NÃO alterar: nearby, watchers rules, timeline (salvo integração chat).

Entregável final:
- Resumo 5d/5e
- Checklist §8.8 / §9.5
- Instruções teste manual (autor ↔ operador admin Campinas)
- NÃO commitar salvo se pedido
```

---

## Handoff entre agentes

| De → Para | O que o Agente A deve deixar pronto |
|-----------|-------------------------------------|
| A → B | Migration 021 aplicada; `pushNotificationService.js` com hook `sendComplaintMessage`; `ComplaintTrackingPage` com seção chat placeholder; `GET /api/complaints/:id` retorna `tenant_id` |

| De → Para | O que o Agente B assume |
|-----------|-------------------------|
| B ← A | Watchers + muted_at para suprimir push de chat; FCM infra (mesmo que PUSH_ENABLED=false) |

---

## Configuração Cursor sugerida

| Agente | Modo explore | Modo execute |
|--------|--------------|----------------|
| A | Ask / subagent explore, readonly | Agent |
| B | Ask / subagent explore, readonly | Agent (após A merge) |

MCP útil: `user-supabase-lifecity` para validar migrations aplicadas (`execute_sql` SELECT em complaint_watchers / complaint_messages).
