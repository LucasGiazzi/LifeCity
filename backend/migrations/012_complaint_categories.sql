-- Executar após revisão
-- Catálogo de categorias de reclamações (substitui strings soltas em complaints.category)

CREATE TABLE public.complaint_categories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        text NOT NULL,
  name        text NOT NULL,
  short_name  text NOT NULL,
  color_hex   char(7) NOT NULL
              CONSTRAINT complaint_categories_color_hex_check
              CHECK (color_hex ~ '^#[0-9A-Fa-f]{6}$'),
  icon_key    text NOT NULL DEFAULT 'category',
  description text,
  sort_order  integer NOT NULL DEFAULT 0,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT complaint_categories_slug_unique UNIQUE (slug)
);

COMMENT ON TABLE public.complaint_categories IS
  'Catálogo global de categorias de reclamações (cor, ícone, rótulos).';
COMMENT ON COLUMN public.complaint_categories.slug IS
  'Chave estável usada pelo app (ex.: infraestrutura).';
COMMENT ON COLUMN public.complaint_categories.icon_key IS
  'Nome Material Icons (Flutter/web).';

CREATE INDEX idx_complaint_categories_active_sort
  ON public.complaint_categories (is_active, sort_order);

-- Seed alinhado ao app Flutter (entrypoint_ui / create_complaint_page)
INSERT INTO public.complaint_categories
  (slug, name, short_name, color_hex, icon_key, description, sort_order)
VALUES
  ('infraestrutura', 'Infraestrutura', 'Infra', '#FF9800', 'construction',
   'Buracos, calçadas, iluminação pública, sinalização.', 10),
  ('seguranca', 'Segurança', 'Segurança', '#F44336', 'security',
   'Iluminação, vandalismo, situações de risco.', 20),
  ('limpeza', 'Limpeza', 'Limpeza', '#009688', 'cleaning_services',
   'Lixo, entulho, limpeza urbana.', 30),
  ('transito', 'Trânsito', 'Trânsito', '#FFC107', 'traffic',
   'Estacionamento irregular, semáforos, fluxo viário.', 40),
  ('outros', 'Outros', 'Outros', '#9E9E9E', 'report_problem',
   'Demais ocorrências não classificadas.', 50);
