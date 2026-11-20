-- Public links use the company name. The original slug remains a permanent lookup key.
ALTER TABLE public.prospect_site_previews ADD COLUMN share_slug text;
CREATE UNIQUE INDEX prospect_site_previews_share_slug_key
  ON public.prospect_site_previews (share_slug);

CREATE FUNCTION public.prospect_share_name(label text)
RETURNS text LANGUAGE sql IMMUTABLE STRICT SET search_path = '' AS $$
  SELECT trim(both '-' from left(
    regexp_replace(regexp_replace(normalize(lower(label), NFD), U&'[\0300-\036F]', '', 'g'),
      '[^a-z0-9]+', '-', 'g'), 42));
$$;

CREATE FUNCTION public.prospect_assign_share_slug()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  base text := public.prospect_share_name(NEW.business_name);
  city text := public.prospect_share_name(NEW.city);
  stem text;
  candidate text;
  suffix integer := 1;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.share_slug IS NOT NULL THEN
      NEW.share_slug := OLD.share_slug;
      RETURN NEW;
    END IF;
  END IF;
  IF length(base) < 3 THEN
    base := CASE WHEN base <> '' THEN 'site-' || base ELSE 'empresa' END;
  END IF;
  -- Serialize allocation only when a permanent public address is first assigned.
  PERFORM pg_catalog.pg_advisory_xact_lock(861105, 20261120);
  stem := base;
  candidate := base;
  WHILE EXISTS (
    SELECT 1 FROM public.prospect_site_previews p WHERE p.id <> NEW.id
      AND (p.slug = candidate OR p.share_slug = candidate)
  ) LOOP
    IF candidate = base AND city <> '' AND city <> base THEN
      stem := base || '-' || city;
      candidate := stem;
    ELSE
      suffix := suffix + 1;
      candidate := rtrim(left(stem, 80), '-') || '-' || suffix;
    END IF;
  END LOOP;
  NEW.share_slug := candidate;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.prospect_assign_share_slug() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER prospect_assign_share_slug
BEFORE INSERT OR UPDATE OF share_slug ON public.prospect_site_previews
FOR EACH ROW EXECUTE FUNCTION public.prospect_assign_share_slug();

UPDATE public.prospect_site_previews SET share_slug = NULL WHERE share_slug IS NULL;
ALTER TABLE public.prospect_site_previews ALTER COLUMN share_slug SET NOT NULL;
ALTER TABLE public.prospect_site_previews ADD CONSTRAINT prospect_share_slug_format
  CHECK (length(share_slug) BETWEEN 3 AND 90 AND share_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
