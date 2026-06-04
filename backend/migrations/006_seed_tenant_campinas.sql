-- Executar após revisão
-- ADR-001 Fase 1: tenant piloto Campinas (cd_mun 3509502)

INSERT INTO public.tenants (cd_mun, slug, display_name, status, activated_at)
SELECT '3509502', 'campinas', nm_mun, 'trial', now()
FROM malhas.municipios WHERE cd_mun = '3509502'
ON CONFLICT (cd_mun) DO NOTHING;
