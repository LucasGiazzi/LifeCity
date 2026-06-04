# Documentação técnica — LifeCity

## ADRs (Architecture Decision Records)

| ADR | Título | Status |
|-----|--------|--------|
| [ADR-001](adr/ADR-001-multi-tenant-municipal.md) | Multi-tenant municipal e dashboard admin | Proposto |
| [ADR-002](adr/ADR-002-complaint-categories.md) | Catálogo de categorias de reclamações | Proposto |

## Contratos de implementação (ADR-001)

Ordem obrigatória:

1. [Fase 1 — Banco de dados](contracts/phase-1-database.md)
2. [Fase 2 — Painel admin MVP](contracts/phase-2-admin-web.md)
3. [Fase 3 — Cadastro municipal (Flutter)](contracts/phase-3-flutter.md)

## Cursor

- Rule: `.cursor/rules/lifecity-multi-tenant.mdc` (sempre ativa)
- Ao iniciar implementação, referenciar: *"Siga ADR-001 e o contrato da Fase N"*

## TCC (LaTeX)

Documentação acadêmica em `sections/` — ver [README](README.md).
