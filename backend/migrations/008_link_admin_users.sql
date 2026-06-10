-- Executar após revisão
-- ADR-001 Fase 1: script MANUAL — vincular servidores municipais ao tenant (executar sob demanda)
--
-- Substituir o email pelo usuário admin real antes de descomentar e rodar.
-- Pré-requisitos: 003, 006 aplicados; usuário já existente em public.users.

INSERT INTO tenant_members (tenant_id, user_id, role)
SELECT t.id, u.id, 'admin' FROM tenants t, users u
WHERE t.slug = 'campinas' AND u.email = 'bernardo.wiemer333@gmail.com';
