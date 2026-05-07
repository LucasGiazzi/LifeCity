# LifeCity — Gamificação & Social: Design Doc
**Data:** 2026-05-05  
**Status:** Aprovado  
**Objetivo central:** Gamificação e social são meios — a meta é gerar dados urbanos de qualidade para a prefeitura.

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