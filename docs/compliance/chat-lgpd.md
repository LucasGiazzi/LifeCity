# Chat municipal — Conformidade LGPD

| Campo | Valor |
|-------|-------|
| **Escopo** | Mensagens `complaint_messages` (Fase 5d/5e, ADR-004) |
| **Canal** | 1:1 autor da ocorrência ↔ prefeitura (tenant) |
| **Última revisão** | 2026-06-10 |

---

## 1. Dados tratados

- Conteúdo textual das mensagens (até 2000 caracteres).
- Metadados: remetente (`citizen` / `municipality`), timestamps, IDs de ocorrência e tenant.
- `sender_user_id` do operador municipal (auditoria interna; **não** exposto ao cidadão).

## 2. Base legal e finalidade

- **Finalidade:** comunicação oficial sobre ocorrências urbanas registradas no LifeCity.
- **Interesse público / execução de política pública municipal** na gestão de solicitações cidadãs.

## 3. Medidas de segurança

| Camada | Medida |
|--------|--------|
| Trânsito | HTTPS/TLS (API + app + admin-web) |
| Repouso (5e) | AES-256-GCM por ocorrência; chave envelope com `TENANT_MESSAGE_MASTER_KEY` |
| Acesso | RBAC: autor cidadão; operador+ envia; viewer lê |
| Auditoria | `complaint_message_access_log` em leituras admin com decrypt |

## 4. Retenção

- Mensagens retidas pelo **ciclo de vida da ocorrência + 5 anos** após encerramento (`closed` / `cancelled`).
- Exclusão em cascata via `ON DELETE CASCADE` na ocorrência.
- Backups Supabase: alinhar política de retenção de backups à mesma janela.

## 5. Direitos do titular

- **Acesso:** autor visualiza mensagens no app; export sob demanda via processo municipal.
- **Retificação:** novas mensagens corrigem contexto; não há edição de mensagens enviadas (integridade).
- **Eliminação:** vinculada ao ciclo de vida da ocorrência; solicitações extras via canal oficial da prefeitura.

## 6. Operadores e sigilo

- Nome individual do operador **não** é exibido ao cidadão (`display_name` = "Prefeitura de {município}").
- PII do cidadão (e-mail, telefone) permanece restrita ao admin-web autenticado.

## 7. Variáveis de ambiente

```
TENANT_MESSAGE_MASTER_KEY=   # 32 bytes, base64 — obrigatório para criptografia 5e
PUSH_ENABLED=true          # notificações FCM de novas mensagens
```

Gerar chave: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`

## 8. Migração plaintext → criptografado

Após configurar `TENANT_MESSAGE_MASTER_KEY`:

```bash
node backend/scripts/migrate-complaint-messages-encrypt.js
```

Verificar: `SELECT COUNT(*) FROM complaint_messages WHERE body IS NOT NULL` → 0.
