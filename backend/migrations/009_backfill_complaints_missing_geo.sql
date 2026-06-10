-- Executar após revisão
-- ADR-001: corrige complaints com lat/lng mas sem tenant_id/cd_mun/location (ex.: criadas antes do fix no controller)

UPDATE public.complaints c
SET
  location = geo.point_from_latlng(c.latitude, c.longitude),
  cd_mun   = geo.resolve_cd_mun(geo.point_from_latlng(c.latitude, c.longitude)),
  cd_setor = geo.resolve_cd_setor(
               geo.point_from_latlng(c.latitude, c.longitude),
               geo.resolve_cd_mun(geo.point_from_latlng(c.latitude, c.longitude))
             ),
  cd_bairro = geo.resolve_cd_bairro(
                geo.point_from_latlng(c.latitude, c.longitude),
                geo.resolve_cd_mun(geo.point_from_latlng(c.latitude, c.longitude))
              ),
  tenant_id = t.id,
  is_within_city = geo.resolve_cd_mun(geo.point_from_latlng(c.latitude, c.longitude)) IS NOT NULL
FROM public.tenants t
WHERE c.tenant_id IS NULL
  AND c.latitude IS NOT NULL
  AND c.longitude IS NOT NULL
  AND t.cd_mun = geo.resolve_cd_mun(geo.point_from_latlng(c.latitude, c.longitude));
