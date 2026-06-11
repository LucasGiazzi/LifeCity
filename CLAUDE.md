# LifeCity — Gamificação & Social: Design Doc
**Data:** 2026-05-05  
**Status:** Aprovado  
**Objetivo central:** Gamificação e social são meios — a meta é gerar dados urbanos de qualidade para a prefeitura.

---

## PRIMEIRO DE TUDO!
Sempre atualize este arquivo quando descobrir:
- Decisões arquiteturais e o motivo delas
- Convenções de código adotadas no projeto
- Bugs conhecidos ou armadilhas a evitar
- Integrações e dependências não óbvias
- Mudanças de escopo ou direção do projeto

## Decisões arquiteturais e convenções

### Sistema de ícones — Material Symbols
Todos os `Icons.*` do Flutter foram migrados para `material_symbols_icons` (`Symbols.*`).
A classe `AppSymbols` em `lib/core/constants/app_symbols.dart` centraliza aliases semânticos.
- `fill: 1.0` = ícone preenchido/ativo; sem `fill` = outline/inativo
- Exceção: logos de marca (Google, Apple, Facebook, Twitter) continuam como SVG em `AppIcons`

### CPF — sempre armazenado sem formatação
O backend sempre chama `.replace(/\D/g, '')` antes de salvar no banco.
Uma migration aplica essa limpeza nos registros existentes.
Nunca confiar no formato recebido do Flutter.

### Sistema de denúncias (reports)
- Tabela `reports` com `UNIQUE(reporter_id, target_type, target_id)` — um usuário denuncia cada item só uma vez
- Threshold: 5 denúncias → `complaints.is_hidden = TRUE`; 10 denúncias → `users.is_restricted = TRUE`
- Queries de `getAll` e `getHighlights` de complaints filtram `WHERE is_hidden = FALSE`
- **Fase 4c:** `reports.target_id` migrado para `TEXT` (migration `019`) — ocorrências usam `bigint`, usuários usam `uuid`; admin moderação faz join `c.id::text = r.target_id`

### Gestão operacional municipal (ADR-003, Fase 4)
- `ops_teams` / `ops_team_members` ≠ `teams` / `team_members` (gamificação cidadã)
- Roteamento automático (`opsRoutingService`): categoria → bairro → equipe `triagem-geral`; dispara em transição para `triaged`/`assigned` sem equipe
- Admin-web: Inbox, Equipes, SLA, Moderação; export CSV em `/complaints/export`
- RBAC: `viewer` leitura; `operator+` workflow; `admin+` CRUD equipes/SLA/moderação
- **Prod Supabase (jun/2026):** ADR-003 aplicado — 210 complaints, 439 complaint_events, GiST em `location`, 5 ops_teams Campinas

### Comunicação cidadão ↔ prefeitura (ADR-004, Fase 5 — proposto)
- **Dedup:** `GET /api/complaints/nearby` com PostGIS `ST_DWithin` + índice GiST existente; raio default 200 m
- **Watchers:** tabela `complaint_watchers` (levels `basic`|`full`); like→basic, witness/autor→full; backfill de likes/witnesses existentes
- **Push:** FCM + `user_device_tokens`; notificação de status **desacoplada** de `isInternal` (hoje admin manda `isInternal:true` → 0 push ao cidadão)
- **Timeline cidadã:** subset de `complaint_events` públicos; card equipe via JOIN (`assigned_ops_team_id`) — prod tem 0 assignment público em events
- **Chat 5d:** `complaint_messages` (022) + `complaintMessageController`; citizen `created_by` only; admin `operator+` POST; push `complaint_message` respeita `muted_at`
- **Cripto 5e:** `messageCryptoService.js` (AES-256-GCM Node); ativa quando `TENANT_MESSAGE_MASTER_KEY` definida; audit `complaint_message_access_log`
- **Armadilha:** novas tabelas Fase 5 usam `timestamptz`; `complaint_likes/witnesses.complaint_id` é `integer` mas PK de complaints é `bigint` — novas FKs usar `BIGINT`
- Contrato: `docs/contracts/phase-5-citizen-communication.md`

### Malhas Campinas — UTB como bairros + demografia (migration 020)
- Campinas **não tem bairros IBGE** (`malhas.bairros` vazio para `3509502`); fonte oficial: **UTB/UTR PD2018** (`pd2018_utbs.zip`, Prefeitura/DIDC)
- Staging: schema `malhas_staging` (`utb_raw`, `setores_ibge_csv`); produção: `malhas.bairros` + `malhas.utb_demografia` + `malhas.setores_indicadores`
- `cd_bairro` sintético: `3509502` + seq 3 dígitos; `nm_bairro` = `DENOMINACA` da UTB; lookup espacial via `geo.resolve_cd_bairro`
- Indicadores IBGE por setor (CSV Censo 2022) ficam em `malhas.setores_indicadores` (jsonb por dataset: `renda_responsavel`, `caracteristicas_domicilios`, etc.)
- Import: `npm run import:malhas:campinas -- --utb-zip <path> --setores-dir <IBGE/Setores> --backfill-complaints` (requer **ogr2ogr** no PATH)

### Recuperação de senha
- Fluxo 3 telas: (1) `ForgetPasswordPage` — digita e-mail; (2) `CodeVerificationPage` — digita código de 6 dígitos; (3) `PasswordResetPage` — digita nova senha
- Backend: gera código, hash SHA-256, salva em `password_reset_tokens` com expiração de 15 min via `NOW() + INTERVAL '15 minutes'`, envia por e-mail via Nodemailer/Gmail
- Tabela `password_reset_tokens`: apaga tokens anteriores do mesmo usuário antes de criar novo; token consumido (`used_at`) após reset bem-sucedido
- Endpoint `POST /api/auth/forgot-password` sempre retorna 200 (não revela quais e-mails estão cadastrados)
- Rotas: `codeVerification` recebe `String email`; `passwordReset` recebe `Map<String, dynamic>` com `email` e `code`
- Variáveis de ambiente necessárias: `EMAIL_USER` (endereço Gmail) e `EMAIL_PASS` (senha de app do Gmail — não a senha da conta)

### ARMADILHA: TIMESTAMP WITHOUT TIME ZONE + Node.js pg
**Sintoma:** token de reset sempre retorna "expirado" mesmo recém-criado. `expires_at > NOW()` falha.  
**Causa:** o driver `pg` serializa objetos `Date` do JS como string de hora LOCAL para colunas `TIMESTAMP WITHOUT TIME ZONE`. Se o servidor roda em UTC-3 (Brasil), o valor salvo fica 3h atrás do UTC. PostgreSQL usa UTC no `NOW()`, então o token parece expirado antes de existir.  
**Fix:** nunca passe `Date` do JS para colunas TIMESTAMP. Use aritmética inteiramente dentro do SQL:
```sql
-- ERRADO: passa JS Date que é serializado em UTC-3
INSERT INTO ... (expires_at) VALUES ($1)  -- com new Date(Date.now() + 15*60*1000)

-- CORRETO: deixa o PostgreSQL calcular
INSERT INTO ... (expires_at) VALUES (NOW() + INTERVAL '15 minutes')
```
**Onde se aplica:** qualquer `INSERT`/`UPDATE` com valor de timestamp calculado no Node.js.

### Tela de detalhe da equipe — chat integrado
O chat da equipe foi integrado diretamente na `TeamDetailPage`, ocupando a parte inferior da tela (abaixo do card de cabeçalho). O ícone de chat que existia na AppBar foi substituído por um ícone de membros (`Symbols.group`) que abre um `ModalBottomSheet` com a lista de membros.
- Polling automático a cada 5 s via `Timer.periodic` — só inicia quando `myStatus == 'active'`
- `TeamChatPage` permanece no projeto mas não é mais navegada diretamente

### ARMADILHA: my_status ausente em getTeamById
**Sintoma:** botão de chat não aparecia para membros ativos da equipe.
**Causa:** `getTeamById` fazia `SELECT * FROM teams` (sem `my_status`) e retornava o objeto puro. Flutter recebia `my_status: null`, `isActiveMember` ficava `false`.
**Fix:** `res.json({ team: { ...team, my_status: membership.status }, members })` — injeta o status do usuário logado no objeto da equipe antes de retornar.

### Filtro inteligente de reclamações no mapa
Pins são filtrados por distância da **localização atual do usuário** (GPS, atualiza conforme o usuário se move):
- **≤ 5 km:** todas as reclamações visíveis — tamanho 44 px, opacidade total
- **> 5 km:** apenas reclamações com score de relevância `>= 3`, onde `score = likesCount + commentsCount + witnessCount`; exibidas menores (36 px) e com 65 % de opacidade para sinalizar distância
- Fallback quando GPS não disponível: usa centro padrão de Campinas (`-22.9099, -47.0626`)
- O `_positionStream` já chama `setState` a cada atualização de posição — filtro recalcula automaticamente
- Distância calculada via fórmula de Haversine em `_MapBodyState._haversineKm`

### ARMADILHA: --read-only=false inválido no MCP Supabase
O servidor `@supabase/mcp-server-supabase` não aceita `--read-only=false` — encerra com `ERR_PARSE_ARGS_INVALID_OPTION_VALUE`. Para habilitar escrita, basta omitir o flag. O token deve ser passado via `--access-token` como argumento explícito no `.mcp.json` (não via campo `env`), pois o Claude Code no Windows pode não repassar variáveis de ambiente corretamente para subprocessos MCP.

### Verificação de cidade — CEP + geofencing passivo
Dois mecanismos combinados para garantir que usuários pertencem à cidade:

**1. CEP no cadastro (barreira de entrada)**
- Campo CEP obrigatório no sign-up com máscara `#####-###`
- Backend valida se o CEP pertence à cidade via `isValidCityCep()` em `backend/src/infra/cityValidator.js`
- Prefixos configurados em `CITY_CEP_PREFIXES` (comma-separated). Se não configurado, validação é pulada (sem quebrar)
- CEP armazenado como 8 dígitos (sem hífen) na coluna `users.cep`

**2. Geofencing passivo (sinal comportamental)**
- Cada reclamação criada salva `is_within_city BOOLEAN` calculado por `isWithinCityBounds(lat, lng)`
- Após ≥ 5 reclamações geolocalizadas, se nenhuma for dentro dos limites → `users.low_trust = TRUE`
- A checagem roda em background (não bloqueia a resposta de criação da reclamação)
- Se os bounds não estiverem configurados ou a reclamação não tiver GPS, `is_within_city = NULL` (não penalizado)

**Configuração atual (Campinas-SP):**
```
CITY_CEP_PREFIXES=130,1310,1311,1312,1313,1314   # 13000–13149
CITY_LAT_MIN=-23.15
CITY_LAT_MAX=-22.65
CITY_LNG_MIN=-47.40
CITY_LNG_MAX=-46.90
```

**Arquivos relevantes:**
- `backend/src/infra/cityValidator.js` — funções `isValidCityCep` e `isWithinCityBounds`
- `backend/src/controllers/authController.js` → `register` — valida CEP
- `backend/src/controllers/complaintController.js` → `create` — salva `is_within_city`, chama `checkUserTrust`

### Variáveis de ambiente do backend (.env)
```
DATABASE_URL
JWT_SECRET
JWT_REFRESH_SECRET
SUPABASE_URL
SUPABASE_SERVICE_KEY
EMAIL_USER            # endereço Gmail para envio
EMAIL_PASS            # senha de app gerada em myaccount.google.com → Segurança → Senhas de app
CITY_CEP_PREFIXES     # prefixos de CEP válidos da cidade (ex: 130,1310,1311)
CITY_LAT_MIN          # limite sul do município
CITY_LAT_MAX          # limite norte do município
CITY_LNG_MIN          # limite oeste do município
CITY_LNG_MAX          # limite leste do município
```

### Migrations
Todas as alterações de schema são aplicadas automaticamente via `runMigrations()` em `server.js` ao iniciar o servidor. Padrão: `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` e `CREATE TABLE IF NOT EXISTS`.

### Supabase free tier — cold start
O projeto é pausado automaticamente após 7 dias sem uso. A primeira requisição após pausa demora 20–30 s para acordar o banco. Não é bug do app.

### Navegação com argumentos
Rotas que precisam de dados usam `settings.arguments` no `RouteGenerator`. Exemplo: `AppRoutes.passwordReset` espera `String email`; `AppRoutes.friendProfile` espera `Map<String, dynamic>`.

---

## Contexto

O LifeCity já possui um MVP funcional com mapa interativo, reclamações georreferenciadas, sistema de amizades, perfil com XP/níveis e autenticação. As features descritas neste doc expandem o engajamento social e a gamificação sem alterar as entidades centrais existentes.

**Stack:** Flutter (mobile) + Node.js/Express + PostgreSQL (Supabase) + Storage Supabase

---

## Objetivo das features

Aumentar a frequência e qualidade de uso do app através de missões, conquistas e interações sociais — gerando mais dados urbanos consistentes para subsidiar decisões da prefeitura.

---

## Plano de lançamento — Opção A (incremental)

| Fase | Features | Dependências |
|------|----------|--------------|
| 1 | Conquistas + Notificações sociais | Nenhuma — adição sobre o que existe |
| 2 | Missões em grupo | Fase 1 concluída |
| 3 | Missões de bairro + Pins de amigos no mapa + Feed de atividade | Fase 2 concluída |

---

## Modelo de dados

### Fase 1 — Conquistas e Notificações

#### `achievements` (catálogo de conquistas)
```sql
CREATE TABLE achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  icon VARCHAR(100),
  xp_reward INTEGER DEFAULT 0,
  trigger_type VARCHAR(50) NOT NULL, -- complaint_created | likes_received | comments_received | mission_completed | etc.
  trigger_count INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### `user_achievements` (conquistas desbloqueadas)
```sql
CREATE TABLE user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  achievement_id UUID REFERENCES achievements(id),
  unlocked_at TIMESTAMP DEFAULT NOW(),
  is_featured BOOLEAN DEFAULT FALSE,
  UNIQUE(user_id, achievement_id)
);
```

#### `notifications`
```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,        -- destinatário
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,      -- quem gerou
  type VARCHAR(50) NOT NULL,                                  -- like | comment | friend_request | achievement_unlocked | mission_invite | mission_completed
  reference_type VARCHAR(50),                                 -- complaint | mission | achievement
  reference_id UUID,
  read_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### Alteração em `users`
```sql
ALTER TABLE users ADD COLUMN featured_achievements UUID[] DEFAULT '{}';
-- Array de até 3 IDs de conquistas para exibir no perfil público
```

---

### Fase 2 — Missões e Equipes

#### Mecânica de missões

- **Diárias:** individuais, simples, sorteadas aleatoriamente para cada usuário todo dia a partir de um pool cadastrado por admin
- **Semanais:** individuais também, mais complexas, sorteadas aleatoriamente por usuário toda semana
- **Bônus de equipe (semanais):** se o usuário pertence a uma equipe, o progresso é colaborativo e cada membro ganha XP bônus proporcional ao desempenho dos outros membros da equipe
- **Equipes:** criadas por um usuário que convida amigos — mínimo 2, máximo 7 integrantes. Persistem ao longo do tempo (estilo equipe permanente)
- **Limite por usuário:** cada usuário pode criar no máximo 1 equipe e entrar em no máximo 1 equipe criada por outra pessoa (total: 2 equipes)

#### `mission_templates` (pool de missões — gerenciado por admin)
```sql
CREATE TABLE mission_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(150) NOT NULL,
  description TEXT,
  frequency VARCHAR(10) NOT NULL,         -- daily | weekly
  goal_type VARCHAR(30) NOT NULL,         -- count | count_and_resolved
  goal_count INTEGER NOT NULL,
  goal_resolved_percent INTEGER,          -- usado apenas quando goal_type = count_and_resolved
  complaint_category VARCHAR(50),         -- infraestrutura | segurança | limpeza | trânsito | outros | NULL
  base_xp_reward INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### `teams` (equipes permanentes)
```sql
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  creator_id UUID REFERENCES users(id) ON DELETE SET NULL,
  total_xp INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### `team_members`
```sql
CREATE TABLE team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(team_id, user_id)
  -- aplicar constraint: mínimo 2, máximo 7 membros na camada de validação do backend
);
```

#### `user_missions` (missões sorteadas por usuário)
```sql
CREATE TABLE user_missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  mission_template_id UUID REFERENCES mission_templates(id),
  frequency VARCHAR(10) NOT NULL,         -- daily | weekly
  contribution_count INTEGER DEFAULT 0,
  xp_earned INTEGER DEFAULT 0,
  bonus_xp_earned INTEGER DEFAULT 0,      -- XP bônus recebido via equipe
  completed_at TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

> **Fase 3 — Missões de bairro e Feed:** nenhuma tabela nova. Missões de bairro usam `user_missions` com lógica de bairro. Feed e pins de amigos são queries sobre `complaints` + `friendships` existentes.

---

## Fluxos principais

### Conquistas

1. Usuário realiza uma ação (cria reclamação, recebe curtida, etc.)
2. Backend dispara verificador de conquistas em background
3. Verifica conquistas ainda não desbloqueadas cujo `trigger_type` bate com a ação
4. Se `trigger_count` for atingido, insere em `user_achievements` e emite notificação
5. No perfil, usuário escolhe até 3 conquistas para exibir em destaque (`is_featured = true`)
6. As 3 conquistas em destaque aparecem no card do perfil público

### Notificações

1. Notificações são geradas nos mesmos pontos onde hoje acontecem curtidas, comentários e pedidos de amizade — adição de um insert em `notifications`
2. Centro de notificações acessível pelo ícone no app com badge de não lidas
3. Ao tocar numa notificação, navega direto para o objeto referenciado (reclamação, missão ou conquista)

### Equipes

1. Usuário cria uma equipe, define o nome e convida amigos (mínimo 2, máximo 7 membros)
2. Convidados recebem notificação do tipo `team_invite`
3. Ao aceitar, entram em `team_members`
4. A equipe é permanente — persiste ao longo do tempo

### Missões diárias e semanais

1. Todo dia, o sistema sorteia uma missão do pool (`mission_templates` com `frequency = daily`) para cada usuário e registra em `user_missions`
2. Toda semana, o mesmo processo com `frequency = weekly`
3. O progresso é calculado automaticamente quando reclamações são criadas ou mudam de status
4. **Bônus de equipe (semanais):** ao completar uma missão semanal, o usuário recebe XP bônus proporcional ao progresso dos outros membros da equipe no mesmo período — registrado em `bonus_xp_earned`
5. Notificação `mission_completed` enviada ao concluir
6. Aba dedicada mostra missões ativas (diária + semanal) com progresso em tempo real

### Missões de bairro

1. Qualquer morador cria a missão — fica visível para todos do bairro na aba de missões
2. Participação é automática: basta criar uma reclamação que se encaixe nos critérios durante o período
3. Para `goal_type = count_and_resolved`: conclusão exige volume de reclamações **e** percentual delas marcadas como resolvidas atingindo `goal_resolved_percent`
4. Ao concluir: todos os participantes com `contribution_count > 0` recebem XP

### Pins de amigos no mapa

- Reclamações de amigos exibem pin com cor/ícone diferente das de desconhecidos
- Serve para: descoberta de reclamações próximas, colaboração via "Também vi isso", e visibilidade de progresso em missões compartilhadas

### Feed de atividade

- Timeline mostrando: reclamações criadas por amigos, missões concluídas, conquistas desbloqueadas
- Ordenado por recência
- Acessível numa aba da tela social

---

## Tratamento de erros e casos de borda

| Cenário | Comportamento |
|---------|---------------|
| Reclamação criada após `ends_at` da missão | Não conta para o progresso |
| Usuário sai de missão em grupo | `contribution_count` mantido no histórico; para de receber XP futuro |
| Conquista duplicada | Verificador checa `user_achievements` antes de inserir — nunca desbloqueia duas vezes |
| Notificação para usuário deletado | Soft delete em usuários; notificações órfãs ficam invisíveis mas não quebram |
| Missão de bairro sem participantes ao expirar | Encerra como não concluída, sem penalidade |
| Percentual resolvidas em `count_and_resolved` | Calculado apenas sobre as reclamações que contaram para a meta, não todas do bairro |

---

## Backlog — próximas fases

- Comunidades de bairro (espaço coletivo por região)
- Chat privado entre usuários
- Dashboard de dados cívicos para a prefeitura
- Ranking de bairros por engajamento

---

## O que NÃO está no escopo desta fase

- Chat direto entre usuários
- Moderação de missões por administradores
- Integração direta com sistemas da prefeitura

