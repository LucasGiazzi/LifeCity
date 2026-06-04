-- Executar após revisão
-- FK category_id + backfill + trigger de sync com complaints.category (slug legado)

ALTER TABLE public.complaints
  ADD COLUMN IF NOT EXISTS category_id uuid
    REFERENCES public.complaint_categories (id);

CREATE INDEX IF NOT EXISTS idx_complaints_category_id
  ON public.complaints (category_id);

-- Backfill a partir do texto existente
UPDATE public.complaints c
SET category_id = cat.id
FROM public.complaint_categories cat
WHERE c.category_id IS NULL
  AND c.category IS NOT NULL
  AND cat.slug = TRIM(c.category);

-- Texto desconhecido → outros
UPDATE public.complaints c
SET
  category_id = cat.id,
  category = 'outros'
FROM public.complaint_categories cat
WHERE c.category_id IS NULL
  AND c.category IS NOT NULL
  AND TRIM(c.category) <> ''
  AND cat.slug = 'outros';

-- Mantém slug em complaints.category para retrocompat com app Flutter
CREATE OR REPLACE FUNCTION public.sync_complaint_category()
RETURNS trigger AS $$
BEGIN
  IF NEW.category_id IS NOT NULL THEN
    SELECT slug INTO NEW.category
    FROM public.complaint_categories
    WHERE id = NEW.category_id;
    RETURN NEW;
  END IF;

  IF NEW.category IS NOT NULL AND TRIM(NEW.category) <> '' THEN
    SELECT id INTO NEW.category_id
    FROM public.complaint_categories
    WHERE slug = TRIM(NEW.category) AND is_active = true;

    IF NEW.category_id IS NULL THEN
      SELECT id, slug INTO NEW.category_id, NEW.category
      FROM public.complaint_categories
      WHERE slug = 'outros';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_complaints_sync_category ON public.complaints;

CREATE TRIGGER trg_complaints_sync_category
  BEFORE INSERT OR UPDATE OF category, category_id
  ON public.complaints
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_complaint_category();

-- Re-sincroniza linhas já existentes após trigger criado
UPDATE public.complaints
SET category = category
WHERE category IS NOT NULL;
