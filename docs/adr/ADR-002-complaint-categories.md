# ADR-002 — Catálogo de categorias de reclamações

| Campo | Valor |
|-------|-------|
| **Status** | Proposto |
| **Data** | 2026-06-04 |
| **Relacionado** | [ADR-001](ADR-001-multi-tenant-municipal.md) |

## Contexto

Categorias (`infraestrutura`, `seguranca`, etc.) existiam como `text` em `complaints.category` e hardcoded no Flutter/admin. Sem cor, ícone ou metadados centralizados.

## Decisão

1. Tabela **`public.complaint_categories`** como catálogo global (slug estável + `name`, `short_name`, `color_hex`, `icon_key`).
2. **`complaints.category_id`** FK para o catálogo; coluna **`category` (slug)** mantida para retrocompat com o app Flutter.
3. **Trigger `sync_complaint_category`**: ao inserir/atualizar, resolve `category_id` ↔ slug; slug desconhecido → `outros`.
4. API **`GET /api/categories`** (pública) e **`GET /api/admin/categories`** (mesmo payload).
5. Analytics e mapa admin passam a usar `color_hex` do catálogo.

## Migrations

| Arquivo | Conteúdo |
|---------|----------|
| `012_complaint_categories.sql` | Tabela + seed das 5 categorias |
| `013_complaints_category_fk.sql` | `category_id`, backfill, trigger |

## Fora de escopo (futuro)

- Categorias por tenant (`tenant_id` em `complaint_categories`)
- CRUD admin de categorias
- Migrar `events.category` e `missions.complaint_category` para o mesmo catálogo
- Flutter consumir `/api/categories` (continua hardcoded até próxima fase)

## Ordem de execução

```powershell
psql $env:SUPABASE_URL -f .\012_complaint_categories.sql
psql $env:SUPABASE_URL -f .\013_complaints_category_fk.sql
```

## Validação

```sql
SELECT c.id, c.category, c.category_id, cat.name, cat.color_hex
FROM complaints c
LEFT JOIN complaint_categories cat ON cat.id = c.category_id
ORDER BY c.id DESC LIMIT 5;
```
