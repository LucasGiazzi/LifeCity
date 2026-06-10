/**
 * Resolve location, cd_mun, setor, bairro e tenant_id a partir de lat/lng text.
 * Usado no INSERT de complaints (ADR-001).
 */
const INSERT_COMPLAINT_WITH_GEO = `
  INSERT INTO public.complaints (
    description,
    occurrence_date,
    created_by,
    category,
    address,
    latitude,
    longitude,
    location,
    cd_mun,
    cd_setor,
    cd_bairro,
    tenant_id,
    is_within_city
  )
  SELECT
    $1,
    $2,
    $3,
    $4,
    $5,
    $6,
    $7,
    pt.location,
    pt.cd_mun,
    geo.resolve_cd_setor(pt.location, pt.cd_mun),
    geo.resolve_cd_bairro(pt.location, pt.cd_mun),
    t.id,
    pt.cd_mun IS NOT NULL
  FROM (
    SELECT
      geo.point_from_latlng($6::text, $7::text) AS location,
      geo.resolve_cd_mun(geo.point_from_latlng($6::text, $7::text)) AS cd_mun
  ) pt
  LEFT JOIN public.tenants t ON t.cd_mun = pt.cd_mun
  RETURNING *
`;

module.exports = {
    INSERT_COMPLAINT_WITH_GEO,
};
