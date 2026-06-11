UPDATE public.tenants
SET settings = settings || jsonb_build_object(
    'geo', jsonb_build_object(
        'cep_prefixes', '["130","1310","1311","1312","1313","1314"]'::jsonb,
        'bounds', jsonb_build_object(
            'lat_min', -23.15,
            'lat_max', -22.65,
            'lng_min', -47.40,
            'lng_max', -46.90
        )
    ),
    'features', jsonb_build_object('chat_enabled', true, 'missions_enabled', true)
)
WHERE slug = 'campinas';
