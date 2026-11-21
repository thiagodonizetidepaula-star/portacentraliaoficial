ALTER TABLE public.prospect_crm_leads
  ADD COLUMN whatsapp text NOT NULL DEFAULT '',
  ADD COLUMN whatsapp_use_phone boolean NOT NULL DEFAULT true;
