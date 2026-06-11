# Documentação técnica — LifeCity

## ADRs (Architecture Decision Records)

| ADR | Título | Status |
|-----|--------|--------|
| [ADR-001](adr/ADR-001-multi-tenant-municipal.md) | Multi-tenant municipal e dashboard admin | Proposto |
| [ADR-002](adr/ADR-002-complaint-categories.md) | Catálogo de categorias de reclamações | Proposto |
| [ADR-003](adr/ADR-003-gestao-operacional-ocorrencias.md) | Gestão operacional: equipes municipais, workflow e SLA | Proposto |
| [ADR-004](adr/ADR-004-comunicacao-cidadao-prefeitura.md) | Comunicação cidadão ↔ prefeitura: dedup, push, chat | Proposto |
| [ADR-005](adr/ADR-005-gestao-plataforma-clientes.md) | Gestão de plataforma: clientes (prefeituras) e staff LifeCity | Proposto |

## Contratos de implementação

### ADR-001 — Multi-tenant (ordem obrigatória)

1. [Fase 1 — Banco de dados](contracts/phase-1-database.md)
2. [Fase 2 — Painel admin MVP](contracts/phase-2-admin-web.md)
3. [Fase 3 — Cadastro municipal (Flutter)](contracts/phase-3-flutter.md)

### ADR-003 — Gestão operacional

4. [Fase 4 — Gestão operacional de ocorrências](contracts/phase-4-operational-management.md) — sub-fases 4a → 4b → 4c

### ADR-004 — Comunicação cidadão

5. [Fase 5 — Comunicação cidadão ↔ prefeitura](contracts/phase-5-citizen-communication.md) — sub-fases 5a → 5b → 5c → 5d → 5e

### ADR-005 — Platform Admin

6. [Fase 6 — Platform Admin (gestão de clientes)](contracts/phase-6-platform-admin.md) — sub-fases 6a → 6b → 6c → 6d → 6e

## Cursor

- Rule: `.cursor/rules/lifecity-multi-tenant.mdc` (sempre ativa)
- Ao iniciar implementação, referenciar: *"Siga ADR-00N e o contrato da Fase N"*

## TCC (LaTeX)

Documentação acadêmica em `sections/` — ver [README](README.md).
