-- MESSAY E.5.5 — CANDIDAT DE MIGRATION INTERURBAINE (REVUE REQUISE)
-- A versionner dans la branche PR #6, PAS A EXECUTER MAINTENANT.
-- AUCUN paiement LIVE autorise par ce script. Il n'active aucun flag Render.
-- PRECONDITIONS avant execution future :
--  * mot de passe PostgreSQL expose revoque et environnement Render corrige ;
--  * backup restaure et teste sur environnement distinct ;
--  * backend webhook/GeniusPay controlé et PR6 revu ;
--  * fenetre de maintenance, revue humaine de toutes les FKs/permissions.
-- Source : E.5.3, teste en simulation E.5.4 sur messay_preprod_clone le 26/11/2026.
-- Il ne corrige PAS les defaults PAYE/A1 de la table legacy reservations.

BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '120s';

-- Ce garde-fou echoue si la base ne correspond plus a l'inventaire Production du 26/11/2026.
DO $e55_preflight$
DECLARE
  v_tables int;
  v_cols int;
  v_funcs int;
  v_dup_qr bigint;
BEGIN
  IF current_database() <> 'postgres' THEN
    RAISE EXCEPTION 'E55_REFUS_BASE_NON_PRODUCTION_NOM_INATTENDU';
  END IF;
  IF to_regclass('public.messay_bus_affectations') IS NULL
    OR to_regclass('public.messay_bus_sieges_reservations') IS NULL
    OR to_regclass('public.messay_interurbain_payment_intents') IS NULL
    OR to_regclass('public.messay_interurbain_geniuspay_webhook_events') IS NULL
    OR to_regclass('public.tickets') IS NULL
    OR to_regclass('public.companies') IS NULL
    OR to_regclass('public.gares') IS NULL
    OR to_regclass('auth.users') IS NULL THEN
    RAISE EXCEPTION 'E55_TABLE_PARENTE_MANQUANTE';
  END IF;
  SELECT count(*) INTO v_tables FROM (VALUES
    ('messay_interurbain_departs_places_verifies'),
    ('messay_interurbain_embarquements'),
    ('messay_interurbain_reconciliation_jobs'),
    ('messay_interurbain_reference_recovery_jobs')
  ) AS x(name) WHERE to_regclass(format('public.%I',x.name)) IS NOT NULL;
  IF v_tables <> 0 THEN
    RAISE EXCEPTION 'E55_ETAT_PRODUCTION_DIVERGENT: % nouvelle(s) table(s) deja presente(s)', v_tables;
  END IF;
  SELECT count(*) INTO v_cols FROM information_schema.columns c WHERE c.table_schema='public'
    AND ((c.table_name='messay_interurbain_payment_intents'
          AND c.column_name IN ('checkout_url','passenger_name','passenger_phone','review_reason'))
      OR (c.table_name='tickets' AND c.column_name IN ('affectation_id','hold_id','intent_id')));
  IF v_cols <> 0 THEN
    RAISE EXCEPTION 'E55_COLONNES_DEJA_PRESENTES: %', v_cols;
  END IF;
  SELECT count(*) INTO v_funcs FROM pg_proc p JOIN pg_namespace ns ON ns.oid=p.pronamespace
    WHERE ns.nspname='public' AND p.proname IN (
      'messay_interurbain_ack_reconciliation_job',
      'messay_interurbain_ack_reference_recovery_job',
      'messay_interurbain_checkout_a_rapprocher',
      'messay_interurbain_claim_reconciliation_jobs',
      'messay_interurbain_claim_reference_recovery_jobs',
      'messay_interurbain_creer_intention_tarif',
      'messay_interurbain_enregistrer_checkout',
      'messay_interurbain_finaliser_paiement',
      'messay_interurbain_lier_evenements_webhook',
      'messay_interurbain_rattraper_webhooks_tardifs',
      'messay_interurbain_reclamer_checkout',
      'messay_interurbain_recuperer_reference_webhook',
      'messay_interurbain_reference_recovery_on_intent',
      'messay_interurbain_valider_embarquement');
  IF v_funcs <> 0 THEN
    RAISE EXCEPTION 'E55_FONCTIONS_DEJA_PRESENTES: %', v_funcs;
  END IF;
  IF (SELECT count(*) FROM public.messay_interurbain_payment_intents) <> 0
    OR (SELECT count(*) FROM public.tickets) <> 0 THEN
    RAISE EXCEPTION 'E55_ENTREES_FINANCIERES_OU_BILLETS_PRESENTS: revision requise';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint c
    WHERE c.conrelid='public.messay_bus_affectations'::regclass
       AND c.conname='messay_c_affectations_id_company_gare_uk') THEN
    RAISE EXCEPTION 'E55_CONTRAINTE_COMPOSITE_DEJA_PRESENTE: revue requise';
  END IF;
  SELECT count(*) INTO v_dup_qr FROM (
    SELECT qr_code FROM public.tickets WHERE qr_code IS NOT NULL
    GROUP BY qr_code HAVING count(*)>1
  ) x;
  IF v_dup_qr <> 0 THEN RAISE EXCEPTION 'E55_DOUBLONS_QR'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_class c
    WHERE c.oid='public.tickets'::regclass AND c.relrowsecurity) THEN
    RAISE EXCEPTION 'E55_RLS_TICKETS_INACTIVE';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='tickets'
      AND cmd IN ('INSERT','UPDATE','ALL')) THEN
    RAISE EXCEPTION 'E55_POLITIQUE_ECRITURE_TICKETS_A_REVOIR';
  END IF;
  RAISE NOTICE 'E55_PREFLIGHT_OK';
END;
$e55_preflight$;

-- 4 tables absentes de l'inventaire Production du 26 novembre 2026.
CREATE TABLE IF NOT EXISTS public.messay_interurbain_departs_places_verifies (
    affectation_id uuid NOT NULL,
    company_id uuid NOT NULL,
    gare_id uuid NOT NULL,
    reference_audit text NOT NULL,
    verifie_par uuid NOT NULL,
    verifie_le timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT messay_interurbain_departs_places_verifie_reference_audit_check CHECK (((char_length(btrim(reference_audit)) >= 8) AND (char_length(btrim(reference_audit)) <= 300)))
);

CREATE TABLE IF NOT EXISTS public.messay_interurbain_embarquements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ticket_id uuid NOT NULL,
    company_id uuid NOT NULL,
    gare_id uuid NOT NULL,
    affectation_id uuid NOT NULL,
    agent_auth_user_id uuid NOT NULL,
    valide_le timestamp with time zone DEFAULT clock_timestamp() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.messay_interurbain_reconciliation_jobs (
    intent_id uuid NOT NULL,
    state text DEFAULT 'PENDING'::text NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    lease_token uuid,
    leased_until timestamp with time zone,
    next_attempt_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT messay_interurbain_reconciliation_jobs_attempts_check CHECK (((attempts >= 0) AND (attempts <= 1000))),
    CONSTRAINT messay_interurbain_reconciliation_jobs_state_check CHECK ((state = ANY (ARRAY['PENDING'::text, 'RETRY'::text, 'LEASED'::text, 'DONE'::text, 'REVIEW'::text]))),
    CONSTRAINT messay_reconciliation_lease_consistency CHECK ((((state = 'LEASED'::text) AND (lease_token IS NOT NULL) AND (leased_until IS NOT NULL)) OR ((state <> 'LEASED'::text) AND (lease_token IS NULL) AND (leased_until IS NULL))))
);

CREATE TABLE IF NOT EXISTS public.messay_interurbain_reference_recovery_jobs (
    intent_id uuid NOT NULL,
    state text DEFAULT 'PENDING'::text NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    lease_token uuid,
    leased_until timestamp with time zone,
    next_attempt_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    last_reason text,
    created_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    updated_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    CONSTRAINT messay_ref_recovery_attempts_check CHECK (((attempts >= 0) AND (attempts <= 1000))),
    CONSTRAINT messay_ref_recovery_lease_check CHECK ((((state = 'LEASED'::text) AND (lease_token IS NOT NULL) AND (leased_until IS NOT NULL)) OR ((state <> 'LEASED'::text) AND (lease_token IS NULL) AND (leased_until IS NULL)))),
    CONSTRAINT messay_ref_recovery_state_check CHECK ((state = ANY (ARRAY['PENDING'::text, 'LEASED'::text, 'RETRY'::text, 'REVIEW'::text, 'DONE'::text])))
);

-- Colonnes absentes du dernier export des colonnes Production.
ALTER TABLE public.messay_interurbain_payment_intents ADD COLUMN IF NOT EXISTS checkout_url text;
ALTER TABLE public.messay_interurbain_payment_intents ADD COLUMN IF NOT EXISTS passenger_name text;
ALTER TABLE public.messay_interurbain_payment_intents ADD COLUMN IF NOT EXISTS passenger_phone text;
ALTER TABLE public.messay_interurbain_payment_intents ADD COLUMN IF NOT EXISTS review_reason text;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS affectation_id uuid;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS hold_id uuid;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS intent_id uuid;

-- Blocage detecte dans l'audit Production : contrainte composite ABSENTE.
-- La cle UNIQUE triple est requise pour la FK de certification
-- (affectation_id, company_id, gare_id) qui suit dans ce script.
-- Les valeurs du trio doivent etre coherentes et id doit etre une PK existante.
DO $e53companygate$
BEGIN
 IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.messay_bus_affectations'::regclass
      AND conname='messay_c_affectations_id_company_gare_uk'
 ) THEN
   ALTER TABLE public.messay_bus_affectations
      ADD CONSTRAINT messay_c_affectations_id_company_gare_uk
      UNIQUE (id, company_id, gare_id);
 END IF;
END
$e53companygate$;

-- Contraintes/cles : ajout conditionnel pour les objets financiers testes.
DO $e52constraint$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.messay_interurbain_departs_places_verifies'::regclass AND conname='messay_interurbain_departs_places_verifies_pkey') THEN
   ALTER TABLE public.messay_interurbain_departs_places_verifies ADD CONSTRAINT messay_interurbain_departs_places_verifies_pkey PRIMARY KEY (affectation_id);
 END IF;
END
$e52constraint$;
DO $e52constraint$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.messay_interurbain_embarquements'::regclass AND conname='messay_interurbain_embarquements_pkey') THEN
   ALTER TABLE public.messay_interurbain_embarquements ADD CONSTRAINT messay_interurbain_embarquements_pkey PRIMARY KEY (id);
 END IF;
END
$e52constraint$;
DO $e52constraint$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.messay_interurbain_embarquements'::regclass AND conname='messay_interurbain_embarquements_ticket_id_key') THEN
   ALTER TABLE public.messay_interurbain_embarquements ADD CONSTRAINT messay_interurbain_embarquements_ticket_id_key UNIQUE (ticket_id);
 END IF;
END
$e52constraint$;
DO $e52constraint$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.messay_interurbain_reconciliation_jobs'::regclass AND conname='messay_interurbain_reconciliation_jobs_pkey') THEN
   ALTER TABLE public.messay_interurbain_reconciliation_jobs ADD CONSTRAINT messay_interurbain_reconciliation_jobs_pkey PRIMARY KEY (intent_id);
 END IF;
END
$e52constraint$;
DO $e52constraint$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.messay_interurbain_reference_recovery_jobs'::regclass AND conname='messay_interurbain_reference_recovery_jobs_pkey') THEN
   ALTER TABLE public.messay_interurbain_reference_recovery_jobs ADD CONSTRAINT messay_interurbain_reference_recovery_jobs_pkey PRIMARY KEY (intent_id);
 END IF;
END
$e52constraint$;
DO $e52constraint$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.messay_interurbain_departs_places_verifies'::regclass AND conname='messay_c_certif_affectation_company_gare_fk') THEN
   ALTER TABLE public.messay_interurbain_departs_places_verifies ADD CONSTRAINT messay_c_certif_affectation_company_gare_fk FOREIGN KEY (affectation_id, company_id, gare_id) REFERENCES public.messay_bus_affectations(id, company_id, gare_id);
 END IF;
END
$e52constraint$;
DO $e52constraint$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.messay_interurbain_departs_places_verifies'::regclass AND conname='messay_interurbain_departs_places_verifies_affectation_id_fkey') THEN
   ALTER TABLE public.messay_interurbain_departs_places_verifies ADD CONSTRAINT messay_interurbain_departs_places_verifies_affectation_id_fkey FOREIGN KEY (affectation_id) REFERENCES public.messay_bus_affectations(id) ON DELETE RESTRICT;
 END IF;
END
$e52constraint$;
DO $e52constraint$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.messay_interurbain_departs_places_verifies'::regclass AND conname='messay_interurbain_departs_places_verifies_company_id_fkey') THEN
   ALTER TABLE public.messay_interurbain_departs_places_verifies ADD CONSTRAINT messay_interurbain_departs_places_verifies_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE RESTRICT;
 END IF;
END
$e52constraint$;
DO $e52constraint$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.messay_interurbain_departs_places_verifies'::regclass AND conname='messay_interurbain_departs_places_verifies_gare_id_fkey') THEN
   ALTER TABLE public.messay_interurbain_departs_places_verifies ADD CONSTRAINT messay_interurbain_departs_places_verifies_gare_id_fkey FOREIGN KEY (gare_id) REFERENCES public.gares(id) ON DELETE RESTRICT;
 END IF;
END
$e52constraint$;
DO $e52constraint$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.messay_interurbain_embarquements'::regclass AND conname='messay_interurbain_embarquements_affectation_id_fkey') THEN
   ALTER TABLE public.messay_interurbain_embarquements ADD CONSTRAINT messay_interurbain_embarquements_affectation_id_fkey FOREIGN KEY (affectation_id) REFERENCES public.messay_bus_affectations(id);
 END IF;
END
$e52constraint$;
DO $e52constraint$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.messay_interurbain_embarquements'::regclass AND conname='messay_interurbain_embarquements_company_id_fkey') THEN
   ALTER TABLE public.messay_interurbain_embarquements ADD CONSTRAINT messay_interurbain_embarquements_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);
 END IF;
END
$e52constraint$;
DO $e52constraint$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.messay_interurbain_embarquements'::regclass AND conname='messay_interurbain_embarquements_gare_id_fkey') THEN
   ALTER TABLE public.messay_interurbain_embarquements ADD CONSTRAINT messay_interurbain_embarquements_gare_id_fkey FOREIGN KEY (gare_id) REFERENCES public.gares(id);
 END IF;
END
$e52constraint$;
DO $e52constraint$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.messay_interurbain_embarquements'::regclass AND conname='messay_interurbain_embarquements_ticket_id_fkey') THEN
   ALTER TABLE public.messay_interurbain_embarquements ADD CONSTRAINT messay_interurbain_embarquements_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE RESTRICT;
 END IF;
END
$e52constraint$;
DO $e52constraint$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.messay_interurbain_reconciliation_jobs'::regclass AND conname='messay_interurbain_reconciliation_jobs_intent_id_fkey') THEN
   ALTER TABLE public.messay_interurbain_reconciliation_jobs ADD CONSTRAINT messay_interurbain_reconciliation_jobs_intent_id_fkey FOREIGN KEY (intent_id) REFERENCES public.messay_interurbain_payment_intents(id) ON DELETE RESTRICT;
 END IF;
END
$e52constraint$;
DO $e52constraint$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.messay_interurbain_reference_recovery_jobs'::regclass AND conname='messay_interurbain_reference_recovery_jobs_intent_id_fkey') THEN
   ALTER TABLE public.messay_interurbain_reference_recovery_jobs ADD CONSTRAINT messay_interurbain_reference_recovery_jobs_intent_id_fkey FOREIGN KEY (intent_id) REFERENCES public.messay_interurbain_payment_intents(id) ON DELETE RESTRICT;
 END IF;
END
$e52constraint$;
DO $e52constraint$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.tickets'::regclass AND conname='messay_tickets_affectation_fk') THEN
   ALTER TABLE public.tickets ADD CONSTRAINT messay_tickets_affectation_fk FOREIGN KEY (affectation_id) REFERENCES public.messay_bus_affectations(id) ON DELETE RESTRICT;
 END IF;
END
$e52constraint$;
DO $e52constraint$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.tickets'::regclass AND conname='messay_tickets_hold_fk') THEN
   ALTER TABLE public.tickets ADD CONSTRAINT messay_tickets_hold_fk FOREIGN KEY (hold_id) REFERENCES public.messay_bus_sieges_reservations(id) ON DELETE RESTRICT;
 END IF;
END
$e52constraint$;
DO $e52constraint$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.tickets'::regclass AND conname='messay_tickets_intent_fk') THEN
   ALTER TABLE public.tickets ADD CONSTRAINT messay_tickets_intent_fk FOREIGN KEY (intent_id) REFERENCES public.messay_interurbain_payment_intents(id) ON DELETE RESTRICT;
 END IF;
END
$e52constraint$;

-- Index necessaires pour idempotence, files et QR.
CREATE UNIQUE INDEX IF NOT EXISTS messay_bus_sieges_unique_actif_idx ON public.messay_bus_sieges_reservations USING btree (affectation_id, siege_numero) WHERE (statut = ANY (ARRAY['EN_ATTENTE'::text, 'CONFIRMEE'::text]));
CREATE INDEX IF NOT EXISTS messay_embarquements_company_date_idx ON public.messay_interurbain_embarquements USING btree (company_id, gare_id, valide_le DESC);
CREATE INDEX IF NOT EXISTS messay_interurbain_intents_company_status_idx ON public.messay_interurbain_payment_intents USING btree (company_id, financial_status, created_at DESC);
CREATE INDEX IF NOT EXISTS messay_interurbain_intents_hold_expiry_idx ON public.messay_interurbain_payment_intents USING btree (hold_expires_at, financial_status);
CREATE UNIQUE INDEX IF NOT EXISTS messay_interurbain_tickets_qr_unique ON public.tickets USING btree (qr_code) WHERE (qr_code IS NOT NULL);
CREATE INDEX IF NOT EXISTS messay_interurbain_webhook_intent_idx ON public.messay_interurbain_geniuspay_webhook_events USING btree (intent_id, received_at DESC);
CREATE INDEX IF NOT EXISTS messay_reconciliation_due_idx ON public.messay_interurbain_reconciliation_jobs USING btree (state, next_attempt_at);
CREATE INDEX IF NOT EXISTS messay_reconciliation_lease_idx ON public.messay_interurbain_reconciliation_jobs USING btree (leased_until) WHERE (state = 'LEASED'::text);
CREATE INDEX IF NOT EXISTS messay_ref_recovery_due_idx ON public.messay_interurbain_reference_recovery_jobs USING btree (state, next_attempt_at) WHERE (state = ANY (ARRAY['PENDING'::text, 'RETRY'::text]));
CREATE INDEX IF NOT EXISTS messay_ref_recovery_expired_lease_idx ON public.messay_interurbain_reference_recovery_jobs USING btree (leased_until) WHERE (state = 'LEASED'::text);
CREATE UNIQUE INDEX IF NOT EXISTS messay_tickets_hold_unique_idx ON public.tickets USING btree (hold_id) WHERE (hold_id IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS messay_tickets_intent_unique_idx ON public.tickets USING btree (intent_id) WHERE (intent_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS messay_webhook_order_id_lookup_idx ON public.messay_interurbain_geniuspay_webhook_events USING btree (((payload #>> '{data,metadata,order_id}'::text[]))) WHERE (environment = 'live'::text);

-- 14 fonctions exactes exportees du clone.
CREATE OR REPLACE FUNCTION public.messay_interurbain_ack_reconciliation_job(p_intent_id uuid, p_lease_token uuid, p_outcome text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
  IF p_intent_id IS NULL
     OR p_lease_token IS NULL
     OR p_outcome NOT IN ('DONE', 'RETRY', 'REVIEW')
  THEN
    RAISE EXCEPTION 'Acquittement invalide'
      USING ERRCODE = '22023';
  END IF;

  IF p_outcome = 'DONE'
     AND NOT EXISTS (
       SELECT 1
       FROM public.messay_interurbain_payment_intents i
       WHERE i.id = p_intent_id
         AND i.financial_status = 'SUCCEEDED'
         AND i.issuance_status = 'ISSUED'
     )
  THEN
    RAISE EXCEPTION 'Billet non confirmé'
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.messay_interurbain_reconciliation_jobs j
  SET state = p_outcome,
      lease_token = NULL,
      leased_until = NULL,
      next_attempt_at = CASE
        WHEN p_outcome = 'RETRY' THEN
          clock_timestamp() + make_interval(
            secs => LEAST(3600, 30 * (2 ^ LEAST(j.attempts, 7))::integer)
          )
        ELSE clock_timestamp()
      END,
      updated_at = clock_timestamp()
  WHERE j.intent_id = p_intent_id
    AND j.lease_token = p_lease_token
    AND j.state = 'LEASED';

  RETURN FOUND;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.messay_interurbain_ack_reference_recovery_job(p_intent_id uuid, p_lease_token uuid, p_outcome text, p_reason text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_job public.messay_interurbain_reference_recovery_jobs%ROWTYPE;
  v_ref text;
  v_now timestamptz := clock_timestamp();
  v_reason text;
  v_delay integer;
BEGIN
  IF p_intent_id IS NULL OR p_lease_token IS NULL OR
     p_outcome IS NULL OR p_outcome NOT IN ('RECOVERED','RETRY','REVIEW') OR
     (p_reason IS NOT NULL AND p_reason !~ '^[A-Z0-9_]{3,80}$') THEN
    RAISE EXCEPTION 'MESSAY_D92_ACK_PARAMETRES_INVALIDES' USING ERRCODE='22023';
  END IF;
  SELECT j.* INTO v_job
    FROM public.messay_interurbain_reference_recovery_jobs j
    WHERE j.intent_id=p_intent_id FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  SELECT i.provider_reference INTO v_ref
    FROM public.messay_interurbain_payment_intents i WHERE i.id=p_intent_id;

  IF v_job.state='DONE' THEN
    RETURN p_outcome='RECOVERED' AND v_ref IS NOT NULL;
  END IF;
  IF v_job.state <> 'LEASED' OR v_job.lease_token IS DISTINCT FROM p_lease_token OR
     v_job.leased_until <= v_now THEN
    RETURN false;
  END IF;
  IF p_outcome='RECOVERED' THEN
    IF v_ref IS NULL THEN
      RAISE EXCEPTION 'MESSAY_D92_RECOVERED_SANS_REFERENCE' USING ERRCODE='P0001';
    END IF;
    UPDATE public.messay_interurbain_reference_recovery_jobs
      SET state='DONE', lease_token=NULL, leased_until=NULL,
          last_reason='REFERENCE_ENREGISTREE', updated_at=v_now
      WHERE intent_id=p_intent_id;
    RETURN true;
  END IF;
  IF v_ref IS NOT NULL THEN
    RAISE EXCEPTION 'MESSAY_D92_REFERENCE_DEJA_ENREGISTREE' USING ERRCODE='P0001';
  END IF;
  v_reason:=coalesce(p_reason, CASE WHEN p_outcome='RETRY' THEN 'REPRISE_TEMPORAIRE'
                                    ELSE 'REVUE_MANUELLE' END);
  IF p_outcome='REVIEW' OR v_job.attempts >= 8 THEN
    UPDATE public.messay_interurbain_reference_recovery_jobs
       SET state='REVIEW', lease_token=NULL, leased_until=NULL,
           last_reason=CASE WHEN v_job.attempts>=8 THEN 'MAX_TENTATIVES' ELSE v_reason END,
           updated_at=v_now
     WHERE intent_id=p_intent_id;
  ELSE
    -- 30,60,120,..., 3600 secondes ; l'absence de webhook sera retentee plus tard.
    v_delay := LEAST(3600, (30 * power(2, LEAST(v_job.attempts-1,7)))::integer);
    UPDATE public.messay_interurbain_reference_recovery_jobs
       SET state='RETRY', lease_token=NULL, leased_until=NULL,
           next_attempt_at=v_now + make_interval(secs => v_delay),
           last_reason=v_reason, updated_at=v_now
     WHERE intent_id=p_intent_id;
  END IF;
  RETURN true;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.messay_interurbain_checkout_a_rapprocher(p_intent_id uuid, p_actor uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_intent public.messay_interurbain_payment_intents%ROWTYPE;
BEGIN
  IF p_intent_id IS NULL OR p_actor IS NULL THEN
    RAISE EXCEPTION 'Paramètres invalides' USING ERRCODE = '22023';
  END IF;

  SELECT i.* INTO v_intent FROM public.messay_interurbain_payment_intents i
   WHERE i.id = p_intent_id FOR UPDATE;
  IF NOT FOUND OR v_intent.actor_user_id <> p_actor THEN
    RAISE EXCEPTION 'Intention introuvable' USING ERRCODE = 'P0002';
  END IF;
  IF v_intent.checkout_state = 'CLAIMED' THEN
    UPDATE public.messay_interurbain_payment_intents i
       SET checkout_state = 'RECONCILE', updated_at = clock_timestamp()
     WHERE i.id = p_intent_id;
    RETURN 'RECONCILE';
  END IF;
  RETURN v_intent.checkout_state;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.messay_interurbain_claim_reconciliation_jobs(p_limit integer)
 RETURNS TABLE(intent_id uuid, lease_token uuid, attempts integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 25 THEN
    RAISE EXCEPTION 'Limite invalide' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  WITH candidats AS (
    SELECT j.intent_id
    FROM public.messay_interurbain_reconciliation_jobs j
    JOIN public.messay_interurbain_payment_intents i
      ON i.id = j.intent_id
    WHERE (
      (
        j.state IN ('PENDING', 'RETRY')
        AND j.next_attempt_at <= clock_timestamp()
        AND i.checkout_state IN ('READY', 'RECONCILE')
        AND i.financial_status = 'PENDING'
        AND i.issuance_status = 'NOT_ISSUED'
        AND i.provider_reference IS NOT NULL
      )
      OR (
        j.state = 'LEASED'
        AND j.leased_until <= clock_timestamp()
      )
    )
    ORDER BY j.next_attempt_at, j.intent_id
    LIMIT p_limit
    FOR UPDATE OF j SKIP LOCKED
  )
  UPDATE public.messay_interurbain_reconciliation_jobs j
  SET state = 'LEASED',
      lease_token = gen_random_uuid(),
      leased_until = clock_timestamp() + interval '2 minutes',
      attempts = j.attempts + 1,
      updated_at = clock_timestamp()
  FROM candidats c
  WHERE j.intent_id = c.intent_id
  RETURNING j.intent_id, j.lease_token, j.attempts;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.messay_interurbain_claim_reference_recovery_jobs(p_limit integer DEFAULT 10, p_lease_seconds integer DEFAULT 120)
 RETURNS TABLE(intent_id uuid, lease_token uuid, attempts integer, leased_until timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_closed integer;
BEGIN
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 25 OR
     p_lease_seconds IS NULL OR p_lease_seconds < 30 OR p_lease_seconds > 600 THEN
    RAISE EXCEPTION 'MESSAY_D92_CLAIM_PARAMETRES_INVALIDES' USING ERRCODE='22023';
  END IF;

  -- Nettoyer un nombre borne de baux epuises, sans attendre de verrou concurrent.
  WITH exhausted AS (
    SELECT j.intent_id
    FROM public.messay_interurbain_reference_recovery_jobs j
    JOIN public.messay_interurbain_payment_intents i ON i.id=j.intent_id
    WHERE i.provider_reference IS NULL AND j.attempts >= 8 AND (
      (j.state IN ('PENDING','RETRY') AND j.next_attempt_at <= v_now)
      OR (j.state='LEASED' AND j.leased_until <= v_now)
    )
    ORDER BY j.updated_at
    LIMIT 100 FOR UPDATE OF j SKIP LOCKED
  ), closed AS (
    UPDATE public.messay_interurbain_reference_recovery_jobs j
       SET state='REVIEW', lease_token=NULL, leased_until=NULL,
           last_reason='MAX_TENTATIVES', updated_at=v_now
      FROM exhausted e WHERE j.intent_id=e.intent_id
    RETURNING j.intent_id
  )
  SELECT count(*) INTO v_closed FROM closed;

  RETURN QUERY
  WITH eligible AS (
    SELECT j.intent_id AS job_id
    FROM public.messay_interurbain_reference_recovery_jobs j
    JOIN public.messay_interurbain_payment_intents i ON i.id=j.intent_id
    WHERE i.checkout_state='RECONCILE'
      AND i.financial_status='PENDING'
      AND i.issuance_status='NOT_ISSUED'
      AND i.provider='GENIUSPAY'
      AND i.environment='live'
      AND i.currency='XOF'
      AND i.provider_reference IS NULL
      AND j.attempts < 8
      AND ((j.state IN ('PENDING','RETRY') AND j.next_attempt_at <= v_now)
        OR (j.state='LEASED' AND j.leased_until <= v_now))
    ORDER BY j.next_attempt_at, j.created_at
    LIMIT p_limit FOR UPDATE OF j SKIP LOCKED
  ), leased AS (
    UPDATE public.messay_interurbain_reference_recovery_jobs j
       SET state='LEASED', attempts=j.attempts+1,
           lease_token=gen_random_uuid(),
           leased_until=v_now + make_interval(secs => p_lease_seconds),
           updated_at=v_now
      FROM eligible e WHERE j.intent_id=e.job_id
    RETURNING j.intent_id, j.lease_token, j.attempts, j.leased_until
  )
  SELECT l.intent_id, l.lease_token, l.attempts, l.leased_until FROM leased l;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.messay_interurbain_creer_intention_tarif(p_hold_id uuid, p_actor uuid, p_passenger_name text, p_passenger_phone text)
 RETURNS TABLE(intent_id uuid, company_id uuid, affectation_id uuid, amount_xof bigint, hold_expires_at timestamp with time zone, checkout_state text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_affectation_id uuid;
  v_hold public.messay_bus_sieges_reservations%ROWTYPE;
  v_existing public.messay_interurbain_payment_intents%ROWTYPE;
  v_new public.messay_interurbain_payment_intents%ROWTYPE;
  v_company_id uuid;
  v_destination_id uuid;
  v_gare_id uuid;
  v_capacite integer;
  v_depart_statut text;
  v_depart_local timestamp without time zone;
  v_company_active boolean;
  v_company_verified boolean;
  v_prix integer;
  v_tarif_company_id uuid;
  v_name text := btrim(coalesce(p_passenger_name, ''));
  v_phone text := btrim(coalesce(p_passenger_phone, ''));
  v_now timestamptz;
BEGIN
  IF p_hold_id IS NULL OR p_actor IS NULL OR
     char_length(v_name) NOT BETWEEN 2 AND 160 OR
     char_length(v_phone) NOT BETWEEN 8 AND 16 OR
     v_phone !~ '^\+?[0-9]{8,15}$' THEN
    RAISE EXCEPTION 'Informations passager ou réservation invalides'
      USING ERRCODE = '22023';
  END IF;

  -- Lecture initiale de l'affectation SANS verrou pour déterminer l'ordre
  -- de sérialisation. Elle sera recontrôlée sous verrou plus bas.
  SELECT h.affectation_id INTO v_affectation_id
  FROM public.messay_bus_sieges_reservations h
  WHERE h.id = p_hold_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Réservation introuvable' USING ERRCODE = 'P0002';
  END IF;

  -- Même ordre que messay_mobile_bloquer_place : d'abord le départ...
  SELECT a.company_id, a.destination_id, a.gare_id,
         a.capacite_snapshot, a.statut,
         a.date_depart + hr.heure_depart
    INTO v_company_id, v_destination_id, v_gare_id,
         v_capacite, v_depart_statut, v_depart_local
  FROM public.messay_bus_affectations a
  JOIN public.horaires hr ON hr.id = a.horaire_id
  WHERE a.id = v_affectation_id
  FOR UPDATE OF a;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Départ introuvable' USING ERRCODE = 'P0002';
  END IF;

  -- ...puis le verrou de capacité.
  SELECT h.* INTO v_hold
  FROM public.messay_bus_sieges_reservations h
  WHERE h.id = p_hold_id
  FOR UPDATE;
  v_now := clock_timestamp();
  IF NOT FOUND OR
     v_hold.affectation_id IS DISTINCT FROM v_affectation_id OR
     v_hold.company_id IS DISTINCT FROM v_company_id OR
     v_hold.gare_id IS DISTINCT FROM v_gare_id OR
     v_hold.actor_user_id IS DISTINCT FROM p_actor OR
     v_hold.statut IS DISTINCT FROM 'EN_ATTENTE' OR
     v_hold.expire_le <= v_now OR
     v_hold.request_id IS NULL OR
     v_capacite NOT BETWEEN 1 AND 120 OR
     v_hold.siege_numero NOT BETWEEN 1 AND v_capacite THEN
    RAISE EXCEPTION 'Réservation expirée, incohérente ou non autorisée'
      USING ERRCODE = 'P0001';
  END IF;

  IF upper(coalesce(v_depart_statut, '')) NOT IN ('PROGRAMME', 'PROGRAMMEE') OR
     v_depart_local IS NULL OR
     v_depart_local <= (v_now AT TIME ZONE 'Africa/Abidjan') THEN
    RAISE EXCEPTION 'Départ annulé ou passé' USING ERRCODE = 'P0001';
  END IF;

  -- Inventaire de ce depart obligatoirement rapproche AVANT toute vente.
  IF NOT EXISTS (
    SELECT 1 FROM public.messay_interurbain_departs_places_verifies inv
    WHERE inv.affectation_id=v_affectation_id AND inv.company_id=v_company_id
      AND inv.gare_id=v_gare_id
  ) THEN
    RAISE EXCEPTION 'Inventaire historique non rapproche' USING ERRCODE='P0001';
  END IF;

  -- Une compagnie désactivée ou non vérifiée ne peut pas vendre.
  SELECT c.is_active, c.is_verified INTO v_company_active, v_company_verified
  FROM public.companies c
  WHERE c.id = v_company_id
  FOR SHARE;
  IF NOT FOUND OR
     v_company_active IS DISTINCT FROM true OR
     v_company_verified IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Compagnie non autorisée à vendre' USING ERRCODE = 'P0001';
  END IF;

  -- Le prix est lu en base, jamais transmis par le téléphone.
  SELECT d.prix, d.company_id INTO v_prix, v_tarif_company_id
  FROM public.destinations d
  WHERE d.id = v_destination_id
  FOR SHARE;
  IF NOT FOUND OR
     v_tarif_company_id IS DISTINCT FROM v_company_id OR
     v_prix IS NULL OR v_prix NOT BETWEEN 200 AND 2500000 THEN
    RAISE EXCEPTION 'Tarif de destination absent ou incohérent'
      USING ERRCODE = 'P0001';
  END IF;

  -- Revalidation temporelle APRES toutes les attentes de verrou, avant INSERT.
  v_now := clock_timestamp();
  IF v_hold.expire_le <= v_now OR
     v_depart_local <= (v_now AT TIME ZONE 'Africa/Abidjan') THEN
    RAISE EXCEPTION 'Réservation ou départ expiré pendant la préparation'
      USING ERRCODE = 'P0001';
  END IF;

  -- Même réservation = même intention ; aucun changement silencieux
  -- de passager, d'acteur, d'affectation ou de montant au second appel.
  SELECT i.* INTO v_existing
  FROM public.messay_interurbain_payment_intents i
  WHERE i.hold_id = p_hold_id;
  IF FOUND THEN
    IF v_existing.actor_user_id IS DISTINCT FROM p_actor OR
       v_existing.company_id IS DISTINCT FROM v_company_id OR
       v_existing.affectation_id IS DISTINCT FROM v_affectation_id OR
       v_existing.request_id IS DISTINCT FROM v_hold.request_id OR
       v_existing.hold_expires_at IS DISTINCT FROM v_hold.expire_le OR
       v_existing.passenger_name IS DISTINCT FROM v_name OR
       v_existing.passenger_phone IS DISTINCT FROM v_phone OR
       v_existing.amount_xof IS DISTINCT FROM v_prix::bigint OR
       v_existing.financial_status <> 'PENDING' OR
       v_existing.issuance_status <> 'NOT_ISSUED' OR
       v_existing.checkout_state NOT IN ('NEW', 'CLAIMED', 'READY', 'RECONCILE') THEN
      RAISE EXCEPTION 'Intention existante non réutilisable ; rapprochement requis'
        USING ERRCODE = 'P0001';
    END IF;
    RETURN QUERY SELECT v_existing.id, v_existing.company_id,
                        v_existing.affectation_id, v_existing.amount_xof,
                        v_existing.hold_expires_at, v_existing.checkout_state;
    RETURN;
  END IF;

  INSERT INTO public.messay_interurbain_payment_intents (
    company_id, affectation_id, hold_id, actor_user_id,
    request_id, amount_xof, currency, provider, environment,
    hold_expires_at, passenger_name, passenger_phone
  ) VALUES (
    v_company_id, v_affectation_id, v_hold.id, p_actor,
    v_hold.request_id, v_prix::bigint, 'XOF', 'GENIUSPAY', 'live',
    v_hold.expire_le, v_name, v_phone
  ) RETURNING * INTO v_new;

  RETURN QUERY SELECT v_new.id, v_new.company_id, v_new.affectation_id,
                      v_new.amount_xof, v_new.hold_expires_at,
                      v_new.checkout_state;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.messay_interurbain_enregistrer_checkout(p_intent_id uuid, p_actor uuid, p_reference text, p_checkout_url text)
 RETURNS TABLE(intent_id uuid, checkout_state text, provider_reference text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_intent public.messay_interurbain_payment_intents%ROWTYPE;
  v_hold public.messay_bus_sieges_reservations%ROWTYPE;
  v_status text;
  v_depart_ouvert boolean;
  v_company_ok boolean;
  v_now timestamptz;
BEGIN
  IF p_intent_id IS NULL OR p_actor IS NULL OR
     p_reference IS NULL OR p_reference !~ '^[A-Za-z0-9_-]{4,128}$' OR
     p_checkout_url IS DISTINCT FROM ('https://geniuspay.ci/checkout/' || p_reference) THEN
    RAISE EXCEPTION 'Session fournisseur invalide' USING ERRCODE = '22023';
  END IF;

  SELECT i.* INTO v_intent
    FROM public.messay_interurbain_payment_intents i
   WHERE i.id = p_intent_id FOR UPDATE;
  IF NOT FOUND OR v_intent.actor_user_id <> p_actor THEN
    RAISE EXCEPTION 'Intention introuvable' USING ERRCODE = 'P0002';
  END IF;
  IF v_intent.financial_status <> 'PENDING' OR
     v_intent.issuance_status <> 'NOT_ISSUED' THEN
    RAISE EXCEPTION 'Intention non admissible' USING ERRCODE = 'P0001';
  END IF;

  -- Une session déjà enregistrée ne peut être répétée qu'à l'identique.
  -- Contrairement à l'ancienne version, on ne retourne JAMAIS READY
  -- sans revérifier l'expiration du hold et la disponibilité du départ.
  IF v_intent.provider_reference IS NOT NULL
     OR v_intent.checkout_url IS NOT NULL THEN
    IF v_intent.checkout_state NOT IN ('READY', 'RECONCILE')
       OR v_intent.provider_reference IS DISTINCT FROM p_reference
       OR v_intent.checkout_url IS DISTINCT FROM p_checkout_url THEN
      RAISE EXCEPTION 'Conflit de session fournisseur'
        USING ERRCODE = 'P0001';
    END IF;
  ELSIF v_intent.checkout_state NOT IN ('CLAIMED', 'RECONCILE') THEN
    RAISE EXCEPTION 'Conflit de session fournisseur' USING ERRCODE = 'P0001';
  END IF;

  SELECT h.* INTO v_hold
    FROM public.messay_bus_sieges_reservations h
   WHERE h.id = v_intent.hold_id FOR UPDATE;

  -- Un départ annulé, dépassé ou une compagnie suspendue interdit READY,
  -- même si le prestataire a réussi à créer une session de checkout.
  SELECT EXISTS (
    SELECT 1
    FROM public.messay_bus_affectations a
    JOIN public.horaires horaire ON horaire.id = a.horaire_id
    WHERE a.id = v_intent.affectation_id
      AND a.company_id = v_intent.company_id
      AND a.gare_id = v_hold.gare_id
      AND upper(coalesce(a.statut, '')) IN ('PROGRAMME', 'PROGRAMMEE')
      AND a.capacite_snapshot BETWEEN 1 AND 120
      AND v_hold.siege_numero BETWEEN 1 AND a.capacite_snapshot
      AND (a.date_depart + horaire.heure_depart) >
          (clock_timestamp() AT TIME ZONE 'Africa/Abidjan')
  ) INTO v_depart_ouvert;

  SELECT EXISTS (
    SELECT 1 FROM public.companies c
    WHERE c.id = v_intent.company_id
      AND c.is_active IS TRUE AND c.is_verified IS TRUE
  ) INTO v_company_ok;

  v_now := clock_timestamp();
  IF v_hold.id IS NULL
     OR v_hold.statut IS DISTINCT FROM 'EN_ATTENTE'
     OR v_hold.company_id IS DISTINCT FROM v_intent.company_id
     OR v_hold.actor_user_id IS DISTINCT FROM v_intent.actor_user_id
     OR v_hold.affectation_id IS DISTINCT FROM v_intent.affectation_id
     OR v_hold.request_id IS DISTINCT FROM v_intent.request_id
     OR v_hold.expire_le <= v_now
     OR v_hold.expire_le IS DISTINCT FROM v_intent.hold_expires_at
     OR v_intent.checkout_state = 'RECONCILE'
     OR NOT v_depart_ouvert
     OR NOT v_company_ok THEN
    v_status := 'RECONCILE';
  ELSE
    v_status := 'READY';
  END IF;

  UPDATE public.messay_interurbain_payment_intents i
     SET checkout_state = v_status,
         provider_reference = p_reference,
         checkout_url = p_checkout_url,
         updated_at = clock_timestamp()
   WHERE i.id = p_intent_id;

  -- File durable creee automatiquement apres la session fournisseur.
  -- Job durable si reference connue, meme pour RECONCILE; aucun paiement lance ici.
  IF v_status IN ('READY', 'RECONCILE') THEN
    INSERT INTO public.messay_interurbain_reconciliation_jobs (intent_id)
      VALUES (p_intent_id)
    ON CONFLICT ON CONSTRAINT messay_interurbain_reconciliation_jobs_pkey DO NOTHING;
  END IF;

  RETURN QUERY SELECT p_intent_id, v_status, p_reference;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.messay_interurbain_finaliser_paiement(p_intent_id uuid, p_provider jsonb)
 RETURNS TABLE(resultat text, billet_id uuid, motif text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_intent public.messay_interurbain_payment_intents%ROWTYPE;
  v_hold public.messay_bus_sieges_reservations%ROWTYPE;
  v_date_depart date;
  v_depart_statut text;
  v_depart_local timestamp without time zone;
  v_capacite integer;
  v_active boolean;
  v_verified boolean;
  v_valid_hold boolean;
  v_review text := null;
  v_billet_id uuid;
  v_txid text;
  v_now timestamptz;
BEGIN
  IF p_intent_id IS NULL OR p_provider IS NULL OR jsonb_typeof(p_provider) <> 'object' THEN
    RAISE EXCEPTION 'Arguments invalides' USING ERRCODE = '22023';
  END IF;

  -- Première barrière : verrou sur l'intention, idempotence des reprises.
  SELECT i.* INTO v_intent
    FROM public.messay_interurbain_payment_intents i
   WHERE i.id = p_intent_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Intention introuvable' USING ERRCODE = 'P0002';
  END IF;

  -- Un webhook répété ne crée jamais un second billet.
  IF v_intent.financial_status = 'SUCCEEDED'
     AND v_intent.issuance_status = 'ISSUED' THEN
    SELECT t.id INTO v_billet_id FROM public.tickets t
     WHERE t.intent_id = p_intent_id AND t.hold_id = v_intent.hold_id;
    IF v_billet_id IS NOT NULL
       AND v_intent.ticket_id = v_billet_id::text THEN
      RETURN QUERY SELECT 'DEJA_EMIS'::text, v_billet_id, NULL::text;
      RETURN;
    END IF;
    RAISE EXCEPTION 'Billet émis incohérent : intervention requise'
      USING ERRCODE = 'P0001';
  END IF;

  -- Vérifier la réponse serveur brute de l'API GeniusPay marchande.
  -- En cas de montant / référence divergents, ne rien déclarer comme payé.
  IF v_intent.provider <> 'GENIUSPAY' OR v_intent.environment <> 'live'
     OR v_intent.currency <> 'XOF'
     OR v_intent.provider_reference IS NULL
     OR p_provider->>'reference' IS DISTINCT FROM v_intent.provider_reference
     OR p_provider->>'environment' IS DISTINCT FROM 'live'
     OR p_provider->>'currency' IS DISTINCT FROM 'XOF'
     OR p_provider->>'status' IS DISTINCT FROM 'completed'
     OR COALESCE(p_provider->>'amount','') !~ '^[0-9]{1,10}$'
     OR (p_provider->>'amount')::bigint <> v_intent.amount_xof
     OR p_provider#>>'{metadata,order_id}' IS DISTINCT FROM v_intent.id::text
     OR p_provider#>>'{metadata,company_id}' IS DISTINCT FROM v_intent.company_id::text
     OR COALESCE(p_provider->>'id','') !~ '^[0-9]{1,20}$' THEN
    RAISE EXCEPTION 'Données GeniusPay non rapprochées' USING ERRCODE = '22023';
  END IF;
  v_txid := p_provider->>'id';

  -- Une intention déjà remboursée ne doit pas être remise en SUCCEEDED
  -- simplement parce qu'un ancien GET fournisseur dit encore completed.
  IF v_intent.financial_status = 'REFUNDED' THEN
    RETURN QUERY SELECT 'PAIEMENT_A_RAPPROCHER'::text, NULL::uuid, 'INTENTION_DEJA_REMBOURSEE'::text;
    RETURN;
  END IF;

  -- Pas de réouverture automatique d'une intention déjà en rapprochement.
  IF v_intent.financial_status = 'SUCCEEDED'
     OR v_intent.issuance_status <> 'NOT_ISSUED'
     OR v_intent.financial_status <> 'PENDING'
     OR (v_intent.checkout_state IS DISTINCT FROM 'READY' AND v_intent.checkout_state IS DISTINCT FROM 'RECONCILE') THEN
    v_review := 'ETAT_INTENTION_A_RAPPROCHER';
  END IF;

  -- L'ordre des verrous garde la même sérialisation que la réservation mobile :
  -- départ avant hold. Un autre achat ne peut pas prendre la même place
  -- pendant la confirmation.
  SELECT a.date_depart, a.statut,
         (a.date_depart + hr.heure_depart), a.capacite_snapshot
    INTO v_date_depart, v_depart_statut, v_depart_local, v_capacite
    FROM public.messay_bus_affectations a
    JOIN public.horaires hr ON hr.id = a.horaire_id
   WHERE a.id = v_intent.affectation_id AND a.company_id = v_intent.company_id
   FOR UPDATE OF a;
  IF NOT FOUND THEN
    v_review := COALESCE(v_review, 'DEPART_INTROUVABLE');
  END IF;

  SELECT h.* INTO v_hold
    FROM public.messay_bus_sieges_reservations h
   WHERE h.id = v_intent.hold_id FOR UPDATE;
  v_now := clock_timestamp();  -- après attente des verrous

  v_valid_hold := FOUND
    AND v_hold.company_id = v_intent.company_id
    AND v_hold.affectation_id = v_intent.affectation_id
    AND v_hold.actor_user_id = v_intent.actor_user_id
    AND v_hold.request_id = v_intent.request_id
    AND v_hold.statut = 'EN_ATTENTE'
    AND v_hold.expire_le = v_intent.hold_expires_at
    AND v_hold.expire_le > v_now
    AND v_capacite BETWEEN 1 AND 120
    AND v_hold.siege_numero BETWEEN 1 AND v_capacite;
  IF v_valid_hold IS DISTINCT FROM true THEN
    v_review := COALESCE(v_review, 'CAPACITE_OU_HOLD_INVALIDE');
  END IF;
  IF upper(coalesce(v_depart_statut, '')) NOT IN ('PROGRAMME','PROGRAMMEE')
     OR v_depart_local IS NULL
     OR v_depart_local <= (v_now AT TIME ZONE 'Africa/Abidjan') THEN
    v_review := COALESCE(v_review, 'DEPART_NON_VENDABLE');
  END IF;
  SELECT c.is_active, c.is_verified INTO v_active, v_verified
    FROM public.companies c WHERE c.id = v_intent.company_id;
  IF NOT FOUND OR v_active IS DISTINCT FROM true OR v_verified IS DISTINCT FROM true THEN
    v_review := COALESCE(v_review, 'COMPAGNIE_NON_AUTORISEE');
  END IF;
  IF nullif(btrim(coalesce(v_intent.passenger_name,'')), '') IS NULL
     OR nullif(btrim(coalesce(v_intent.passenger_phone,'')), '') IS NULL THEN
    v_review := COALESCE(v_review, 'PASSAGER_NON_IDENTIFIE');
  END IF;

  -- Aucune emission de billet sans rapprochement de l'inventaire.
  -- Une confirmation fournisseur tardive reste SUCCEEDED mais va en REVIEW.
  IF NOT EXISTS (
    SELECT 1 FROM public.messay_interurbain_departs_places_verifies inv
    JOIN public.messay_bus_affectations a ON a.id=inv.affectation_id
    WHERE inv.affectation_id=v_intent.affectation_id
      AND inv.company_id=v_intent.company_id
      AND inv.gare_id=a.gare_id
  ) THEN
    v_review := COALESCE(v_review, 'INVENTAIRE_NON_RAPPROCHE');
  END IF;

  -- Quoi qu'il arrive à la place, ne pas perdre une confirmation financière
  -- réellement observée. Les erreurs métier de disponibilité ne provoquent
  -- donc PAS de ROLLBACK de cet UPDATE.
  UPDATE public.messay_interurbain_payment_intents i
     SET financial_status = 'SUCCEEDED',
         paid_at = COALESCE(i.paid_at, v_now),
         provider_transaction_id = v_txid,
         checkout_state = CASE WHEN v_review IS NULL THEN i.checkout_state ELSE 'RECONCILE' END,
         issuance_status = CASE WHEN v_review IS NULL THEN i.issuance_status ELSE 'RECONCILE' END,
         review_reason = v_review,
         updated_at = v_now
   WHERE i.id = p_intent_id;

  IF v_review IS NOT NULL THEN
    RETURN QUERY SELECT 'PAIEMENT_A_RAPPROCHER'::text, NULL::uuid, v_review;
    RETURN;
  END IF;

  -- Inventaire canonique : confirme l'unique place technique déjà bloquée.
  -- Son numéro n'est PAS communiqué au voyageur ni stocké comme siège attribué.
  UPDATE public.messay_bus_sieges_reservations h
     SET statut = 'CONFIRMEE', maj_le = v_now
   WHERE h.id = v_intent.hold_id
     AND h.statut = 'EN_ATTENTE';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conflit de capacité après verrouillage' USING ERRCODE = 'P0001';
  END IF;

  -- `tickets.user_id` cible auth.users(id), alors que actor_user_id vient du
  -- JWT backend MESSAY (Prisma User) : on n'invente PAS leur équivalence.
  -- Liaison à l'identité client à traiter explicitement dans le prochain lot.
  v_billet_id := gen_random_uuid();
  INSERT INTO public.tickets (
    id, company_id, route_id, user_id,
    passenger_name, passenger_phone, seat_number, travel_date,
    qr_code, status, price_paid, created_at,
    intent_id, hold_id, affectation_id
  ) VALUES (
    v_billet_id, v_intent.company_id, NULL, NULL,
    v_intent.passenger_name, v_intent.passenger_phone, NULL, v_date_depart,
    gen_random_uuid()::text, 'PAYE', v_intent.amount_xof::integer,
    (v_now AT TIME ZONE 'UTC'),
    v_intent.id, v_intent.hold_id, v_intent.affectation_id
  );

  UPDATE public.messay_interurbain_payment_intents i
     SET issuance_status = 'ISSUED', ticket_id = v_billet_id::text,
         issued_at = v_now, review_reason = NULL, updated_at = v_now
   WHERE i.id = p_intent_id;

  RETURN QUERY SELECT 'BILLET_EMIS'::text, v_billet_id, NULL::text;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.messay_interurbain_lier_evenements_webhook(p_intent_id uuid, p_provider_reference text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_count integer := 0;
BEGIN

  IF p_intent_id IS NULL
     OR p_provider_reference IS NULL
     OR p_provider_reference !~ '^[A-Za-z0-9_-]{4,128}$'
  THEN
    RAISE EXCEPTION 'MESSAY_REFERENCE_INVALIDE'
      USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.messay_interurbain_payment_intents i
    WHERE i.id = p_intent_id
      AND i.provider_reference = p_provider_reference
      AND i.provider = 'GENIUSPAY'
      AND i.environment = 'live'
      AND i.checkout_state IN ('READY', 'RECONCILE')
  ) THEN
    RAISE EXCEPTION 'MESSAY_INTENTION_REFERENCE_INCOHERENTE'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.messay_interurbain_geniuspay_webhook_events e
  SET intent_id = p_intent_id
  WHERE e.intent_id IS NULL
    AND e.environment = 'live'
    AND e.event_type LIKE 'payment.%'

    AND (
      e.payload ->> 'reference' = p_provider_reference
      OR e.payload #>> '{data,reference}' = p_provider_reference
      OR e.payload #>> '{data,payment,reference}' = p_provider_reference
      OR e.payload #>> '{payment,reference}' = p_provider_reference
    )

    -- Aucun autre champ de référence ne doit contredire
    -- la référence marchande attendue.
    AND NOT EXISTS (
      SELECT 1
      FROM unnest(ARRAY[
        e.payload ->> 'reference',
        e.payload #>> '{data,reference}',
        e.payload #>> '{data,payment,reference}',
        e.payload #>> '{payment,reference}'
      ]) AS r(reference_value)
      WHERE r.reference_value IS NOT NULL
        AND r.reference_value <> p_provider_reference
    )

    AND EXISTS (
      SELECT 1
      FROM public.messay_interurbain_payment_intents i
      WHERE i.id = p_intent_id
        AND i.provider_reference = p_provider_reference
        AND i.provider = 'GENIUSPAY'
        AND i.environment = 'live'
        AND i.checkout_state IN ('READY', 'RECONCILE')
    );

  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Rattachement d'audit uniquement.
  -- Aucun changement de statut financier.
  -- Aucune émission de billet.
  RETURN v_count;

END;
$function$
;

CREATE OR REPLACE FUNCTION public.messay_interurbain_rattraper_webhooks_tardifs(p_limit integer)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_count integer := 0;
BEGIN
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 25 THEN
    RAISE EXCEPTION 'MESSAY_RATTRAPAGE_LIMITE_INVALIDE' USING ERRCODE='22023';
  END IF;

  WITH candidats AS (
    SELECT e.id AS event_row_id, i.id AS matched_intent_id
    FROM public.messay_interurbain_geniuspay_webhook_events AS e
    JOIN public.messay_interurbain_payment_intents AS i
      ON i.provider_reference = COALESCE(
        e.payload ->> 'reference',
        e.payload #>> '{data,reference}',
        e.payload #>> '{data,payment,reference}',
        e.payload #>> '{payment,reference}'
      )
    WHERE e.intent_id IS NULL
      AND e.environment = 'live'
      AND e.event_type LIKE 'payment.%'
      AND i.provider = 'GENIUSPAY'
      AND i.environment = 'live'
      AND i.checkout_state IN ('READY', 'RECONCILE')
      AND i.provider_reference ~ '^[A-Za-z0-9_-]{4,128}$'
      -- Un champ de reference contradictoire bloque le rattachement.
      AND NOT EXISTS (
        SELECT 1 FROM unnest(ARRAY[
          e.payload ->> 'reference',
          e.payload #>> '{data,reference}',
          e.payload #>> '{data,payment,reference}',
          e.payload #>> '{payment,reference}'
        ]) AS r(reference_value)
        WHERE r.reference_value IS NOT NULL
          AND r.reference_value <> i.provider_reference
      )
    ORDER BY e.received_at, e.id
    LIMIT p_limit
    FOR UPDATE OF e SKIP LOCKED
  )
  UPDATE public.messay_interurbain_geniuspay_webhook_events AS e
     SET intent_id = c.matched_intent_id
    FROM candidats AS c
   WHERE e.id = c.event_row_id
     AND e.intent_id IS NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.messay_interurbain_reclamer_checkout(p_intent_id uuid, p_actor uuid)
 RETURNS TABLE(intent_id uuid, company_id uuid, amount_xof bigint, hold_expires_at timestamp with time zone, checkout_state text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_intent public.messay_interurbain_payment_intents%ROWTYPE;
  v_hold public.messay_bus_sieges_reservations%ROWTYPE;
  v_active boolean;
  v_verified boolean;
  v_depart_statut text;
  v_depart_local timestamp without time zone;
  v_now timestamptz := clock_timestamp();
BEGIN
  IF p_intent_id IS NULL OR p_actor IS NULL THEN
    RAISE EXCEPTION 'Paramètres invalides' USING ERRCODE = '22023';
  END IF;

  SELECT i.* INTO v_intent
    FROM public.messay_interurbain_payment_intents i
   WHERE i.id = p_intent_id
   FOR UPDATE;
  IF NOT FOUND OR v_intent.actor_user_id <> p_actor THEN
    RAISE EXCEPTION 'Intention introuvable' USING ERRCODE = 'P0002';
  END IF;
  IF v_intent.checkout_state <> 'NEW'
     OR v_intent.financial_status <> 'PENDING'
     OR v_intent.issuance_status <> 'NOT_ISSUED'
     OR v_intent.provider_reference IS NOT NULL
     OR v_intent.checkout_url IS NOT NULL THEN
    RAISE EXCEPTION 'Intention déjà réclamée ou non admissible'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT h.* INTO v_hold
    FROM public.messay_bus_sieges_reservations h
   WHERE h.id = v_intent.hold_id
   FOR UPDATE;
  -- Clock recalculée APRÈS une éventuelle attente de verrou.
  v_now := clock_timestamp();
  IF NOT FOUND
     OR v_hold.company_id <> v_intent.company_id
     OR v_hold.affectation_id <> v_intent.affectation_id
     OR v_hold.actor_user_id <> v_intent.actor_user_id
     OR v_hold.request_id <> v_intent.request_id
     OR v_hold.statut <> 'EN_ATTENTE'
     OR v_hold.expire_le <= v_now
     OR v_intent.hold_expires_at <> v_hold.expire_le THEN
    RAISE EXCEPTION 'Réservation de capacité non valable'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT a.statut, a.date_depart + h.heure_depart
    INTO v_depart_statut, v_depart_local
    FROM public.messay_bus_affectations a
    JOIN public.horaires h ON h.id = a.horaire_id
   WHERE a.id = v_intent.affectation_id
     AND a.company_id = v_intent.company_id
     AND a.gare_id = v_hold.gare_id;
  IF NOT FOUND
     OR upper(coalesce(v_depart_statut, '')) NOT IN ('PROGRAMME', 'PROGRAMMEE')
     OR v_depart_local <= (v_now AT TIME ZONE 'Africa/Abidjan') THEN
    RAISE EXCEPTION 'Départ indisponible' USING ERRCODE = 'P0001';
  END IF;

  SELECT c.is_active, c.is_verified
    INTO v_active, v_verified
    FROM public.companies c WHERE c.id = v_intent.company_id;
  IF NOT FOUND OR v_active IS DISTINCT FROM true OR v_verified IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Compagnie non autorisée' USING ERRCODE = 'P0001';
  END IF;

  -- Le contrôle doit être refait juste avant la mutation, car des locks
  -- précédents peuvent retarder la fonction jusqu'à expiration de la place.
  v_now := clock_timestamp();
  IF v_hold.expire_le <= v_now
     OR v_depart_local <= (v_now AT TIME ZONE 'Africa/Abidjan') THEN
    RAISE EXCEPTION 'Réservation ou départ expiré' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.messay_interurbain_payment_intents i
     SET checkout_state = 'CLAIMED', updated_at = v_now
   WHERE i.id = p_intent_id;

  RETURN QUERY SELECT v_intent.id, v_intent.company_id, v_intent.amount_xof,
                      v_intent.hold_expires_at, 'CLAIMED'::text;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.messay_interurbain_recuperer_reference_webhook(p_intent_id uuid, p_provider jsonb)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_intent public.messay_interurbain_payment_intents%ROWTYPE;
  v_ref text;
  v_events_count integer;
  v_already boolean;
BEGIN
  IF p_intent_id IS NULL OR p_provider IS NULL OR jsonb_typeof(p_provider) <> 'object' THEN
    RAISE EXCEPTION 'MESSAY_RECUPERATION_ARGUMENTS_INVALIDES' USING ERRCODE='22023';
  END IF;

  -- Unique source de verite de l'intention; verrou avant modification.
  SELECT i.* INTO v_intent
  FROM public.messay_interurbain_payment_intents i
  WHERE i.id=p_intent_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'MESSAY_INTENTION_INTROUVABLE' USING ERRCODE='P0002';
  END IF;
  IF v_intent.checkout_state <> 'RECONCILE'
     OR v_intent.financial_status <> 'PENDING'
     OR v_intent.issuance_status <> 'NOT_ISSUED'
     OR v_intent.provider <> 'GENIUSPAY'
     OR v_intent.environment <> 'live'
     OR v_intent.currency <> 'XOF' THEN
    RAISE EXCEPTION 'MESSAY_INTENTION_NON_ADMISSIBLE' USING ERRCODE='P0001';
  END IF;

  v_ref := p_provider->>'reference';
  -- Le JSON doit avoir ete obtenu par GET serveur, jamais accepte d'un mobile.
  -- Ce controle SQL compare des champs mais NE prouve PAS son authenticite.
  IF v_ref IS NULL OR v_ref !~ '^[A-Za-z0-9_-]{4,128}$'
     OR p_provider->>'environment' IS DISTINCT FROM 'live'
     OR p_provider->>'currency' IS DISTINCT FROM 'XOF'
     OR jsonb_typeof(p_provider->'amount') IS DISTINCT FROM 'number'
     OR COALESCE(p_provider->>'amount','') !~ '^[0-9]{1,10}$'
     OR (p_provider->>'amount')::bigint <> v_intent.amount_xof
     OR p_provider#>>'{metadata,order_id}' IS DISTINCT FROM v_intent.id::text
     OR p_provider#>>'{metadata,company_id}' IS DISTINCT FROM v_intent.company_id::text
     OR NULLIF(btrim(COALESCE(p_provider->>'status','')), '') IS NULL
     OR length(p_provider->>'status') > 40 THEN
    RAISE EXCEPTION 'MESSAY_GET_FOURNISSEUR_INCOHERENT' USING ERRCODE='22023';
  END IF;
  IF v_intent.provider_reference IS NOT NULL AND v_intent.provider_reference <> v_ref THEN
    RAISE EXCEPTION 'MESSAY_REFERENCE_EXISTANTE_CONTRADICTOIRE' USING ERRCODE='P0001';
  END IF;

  -- Verrouille tous les indices signes de l'inbox portant le meme order_id.
  -- L'inbox ne doit etre accessible en ecriture qu'au service d'ingestion HMAC.
  PERFORM 1 FROM public.messay_interurbain_geniuspay_webhook_events e
  WHERE e.payload #>> '{data,metadata,order_id}'=p_intent_id::text
  FOR UPDATE;
  SELECT count(*) INTO v_events_count
  FROM public.messay_interurbain_geniuspay_webhook_events e
  WHERE e.payload #>> '{data,metadata,order_id}'=p_intent_id::text;
  IF v_events_count = 0 THEN
    RAISE EXCEPTION 'MESSAY_AUCUN_WEBHOOK_SIGNE_ASSOCIABLE' USING ERRCODE='P0001';
  END IF;
  IF v_events_count > 500 THEN
    RAISE EXCEPTION 'MESSAY_TROP_WEBHOOKS_REVUE_MANUELLE' USING ERRCODE='P0001';
  END IF;

  -- Tous les evenements matches doivent etre coherents; aucun arbitrage au hasard.
  IF EXISTS (
    SELECT 1 FROM public.messay_interurbain_geniuspay_webhook_events e
    WHERE e.payload #>> '{data,metadata,order_id}'=p_intent_id::text
      AND (
        e.environment IS DISTINCT FROM 'live'
        OR e.event_type NOT LIKE 'payment.%'
        OR e.payload->>'environment' IS DISTINCT FROM 'live'
        OR e.payload->>'event' IS DISTINCT FROM e.event_type
        OR e.payload->>'id' IS DISTINCT FROM e.provider_event_id
        OR e.raw_sha256 !~ '^[0-9a-fA-F]{64}$'
        OR e.processing_error_code IS NOT NULL
        OR (e.intent_id IS NOT NULL AND e.intent_id <> p_intent_id)
        OR e.payload #>> '{data,reference}' IS DISTINCT FROM v_ref
        OR e.payload #>> '{data,metadata,company_id}' IS DISTINCT FROM v_intent.company_id::text
        OR e.payload #>> '{data,currency}' IS DISTINCT FROM 'XOF'
        OR jsonb_typeof(e.payload #> '{data,amount}') IS DISTINCT FROM 'number'
        OR COALESCE(e.payload #>> '{data,amount}', '') !~ '^[0-9]{1,10}$'
        OR (e.payload #>> '{data,amount}')::bigint IS DISTINCT FROM v_intent.amount_xof
        OR EXISTS (
          SELECT 1 FROM unnest(ARRAY[
            e.payload ->> 'reference',
            e.payload #>> '{payment,reference}',
            e.payload #>> '{data,payment,reference}'
          ]) refs(value)
          WHERE refs.value IS NOT NULL AND refs.value <> v_ref
        )
      )
  ) THEN
    RAISE EXCEPTION 'MESSAY_WEBHOOKS_CONTRADICTOIRES_REVUE_MANUELLE' USING ERRCODE='P0001';
  END IF;

  -- Une reference dont un webhook identifie un autre order_id est suspecte.
  IF EXISTS (
    SELECT 1 FROM public.messay_interurbain_geniuspay_webhook_events e
    WHERE e.environment='live'
      AND e.payload #>> '{data,reference}'=v_ref
      AND (e.payload #>> '{data,metadata,order_id}' IS DISTINCT FROM p_intent_id::text
           OR (e.intent_id IS NOT NULL AND e.intent_id <> p_intent_id))
  ) THEN
    RAISE EXCEPTION 'MESSAY_REFERENCE_LIEE_A_AUTRE_INTENTION' USING ERRCODE='P0001';
  END IF;

  -- Ne pas ressusciter automatiquement une file fermee en REVIEW ou DONE.
  IF EXISTS (
    SELECT 1 FROM public.messay_interurbain_reconciliation_jobs j
    WHERE j.intent_id=p_intent_id AND j.state IN ('REVIEW','DONE')
  ) THEN
    RAISE EXCEPTION 'MESSAY_JOB_CLOTURE_REVUE_MANUELLE' USING ERRCODE='P0001';
  END IF;

  v_already := v_intent.provider_reference IS NOT NULL;
  IF NOT v_already THEN
    UPDATE public.messay_interurbain_payment_intents i
    SET provider_reference=v_ref, updated_at=clock_timestamp()
    WHERE i.id=p_intent_id;
  END IF;
  -- L'etat reste RECONCILE, PENDING, NOT_ISSUED: ne pas convertir en READY.
  UPDATE public.messay_interurbain_geniuspay_webhook_events e
  SET intent_id=p_intent_id
  WHERE e.intent_id IS NULL
    AND e.payload #>> '{data,metadata,order_id}'=p_intent_id::text;

  INSERT INTO public.messay_interurbain_reconciliation_jobs(intent_id)
  VALUES(p_intent_id)
  ON CONFLICT ON CONSTRAINT messay_interurbain_reconciliation_jobs_pkey DO NOTHING;

  RETURN CASE WHEN v_already THEN 'DEJA_RECUPEREE' ELSE 'REFERENCE_RECUPEREE' END;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.messay_interurbain_reference_recovery_on_intent()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
  IF NEW.checkout_state = 'RECONCILE'
     AND NEW.financial_status = 'PENDING'
     AND NEW.issuance_status = 'NOT_ISSUED'
     AND NEW.provider_reference IS NULL THEN
    INSERT INTO public.messay_interurbain_reference_recovery_jobs(intent_id)
    VALUES (NEW.id)
    ON CONFLICT ON CONSTRAINT messay_interurbain_reference_recovery_jobs_pkey
    DO NOTHING;
  END IF;

  -- DONE signifie ici : *reference retrouvee*, pas paiement confirme.
  IF NEW.provider_reference IS NOT NULL
     AND OLD.provider_reference IS DISTINCT FROM NEW.provider_reference THEN
    UPDATE public.messay_interurbain_reference_recovery_jobs j
       SET state = 'DONE', lease_token = NULL, leased_until = NULL,
           last_reason = 'REFERENCE_ENREGISTREE', updated_at = clock_timestamp()
     WHERE j.intent_id = NEW.id
       AND j.state IN ('PENDING','RETRY','LEASED');
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.messay_interurbain_valider_embarquement(p_qr_code text, p_company_id uuid, p_gare_id uuid, p_agent_auth_user_id uuid)
 RETURNS TABLE(resultat text, billet_id uuid, embarque_le timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_ticket public.tickets%ROWTYPE;
  v_existing public.messay_interurbain_embarquements%ROWTYPE;
  v_date_depart date;
  v_statut_depart text;
  v_today date := (clock_timestamp() AT TIME ZONE 'Africa/Abidjan')::date;
BEGIN
  IF p_qr_code IS NULL OR p_qr_code !~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
    OR p_company_id IS NULL OR p_gare_id IS NULL OR p_agent_auth_user_id IS NULL THEN
    RAISE EXCEPTION 'E32_ARGUMENTS_INVALIDES' USING ERRCODE='22023';
  END IF;

  -- Server verified Supabase Auth, SQL additionally checks CURRENT ACTIVE grants.
  IF NOT (
    EXISTS (SELECT 1 FROM public.messay_company_access a
      WHERE a.auth_user_id = p_agent_auth_user_id AND a.company_id = p_company_id
        AND a.actif IS TRUE AND a.role = 'DIRECTION')
    OR EXISTS (SELECT 1 FROM public.messay_gare_staff s
      WHERE s.auth_user_id = p_agent_auth_user_id AND s.company_id = p_company_id
        AND s.gare_id = p_gare_id AND s.actif IS TRUE
        AND s.role IN ('CHEF_GARE','AGENT_EMBARQUEMENT'))
  ) THEN
    RAISE EXCEPTION 'E32_AGENT_NON_AUTORISE' USING ERRCODE='42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.gares g
                 WHERE g.id=p_gare_id AND g.company_id=p_company_id) THEN
    RAISE EXCEPTION 'E32_GARE_NON_AUTORISEE' USING ERRCODE='42501';
  END IF;

  -- Serialises simultaneous scans for this exact ticket.
  SELECT t.* INTO v_ticket FROM public.tickets t
    WHERE t.qr_code = p_qr_code FOR UPDATE;
  IF NOT FOUND OR v_ticket.company_id IS DISTINCT FROM p_company_id THEN
    RETURN QUERY SELECT 'BILLET_INTRouvable'::text, NULL::uuid, NULL::timestamptz;
    RETURN;
  END IF;

  SELECT a.date_depart, a.statut
    INTO v_date_depart, v_statut_depart
    FROM public.messay_interurbain_payment_intents i
    JOIN public.messay_bus_affectations a ON a.id=i.affectation_id
      AND a.company_id=i.company_id AND a.gare_id=p_gare_id
    JOIN public.messay_bus_sieges_reservations h ON h.id=i.hold_id
      AND h.company_id=i.company_id AND h.affectation_id=i.affectation_id
      AND h.actor_user_id=i.actor_user_id AND h.request_id=i.request_id
    JOIN public.companies c ON c.id=i.company_id AND c.is_active IS TRUE AND c.is_verified IS TRUE
    WHERE i.id=v_ticket.intent_id AND i.company_id=p_company_id
      AND i.affectation_id=v_ticket.affectation_id
      AND i.hold_id=v_ticket.hold_id
      AND i.ticket_id=v_ticket.id::text
      AND i.amount_xof=v_ticket.price_paid::bigint
      AND i.financial_status='SUCCEEDED' AND i.issuance_status='ISSUED'
      AND h.statut='CONFIRMEE';
  IF NOT FOUND OR v_date_depart IS DISTINCT FROM v_ticket.travel_date
     OR upper(coalesce(v_statut_depart,'')) NOT IN ('PROGRAMME','PROGRAMMEE') THEN
    RETURN QUERY SELECT 'BILLET_NON_ADMISSIBLE'::text, NULL::uuid, NULL::timestamptz;
    RETURN;
  END IF;

  SELECT b.* INTO v_existing FROM public.messay_interurbain_embarquements b
    WHERE b.ticket_id=v_ticket.id;
  IF v_ticket.status='UTILISE' THEN
    IF NOT FOUND THEN
      RAISE EXCEPTION 'E32_UTILISE_SANS_AUDIT' USING ERRCODE='P0001';
    END IF;
    RETURN QUERY SELECT 'DEJA_UTILISE'::text, v_ticket.id, v_existing.valide_le;
    RETURN;
  END IF;
  IF FOUND OR v_ticket.status IS DISTINCT FROM 'PAYE' THEN
    RETURN QUERY SELECT 'BILLET_NON_ADMISSIBLE'::text, NULL::uuid, NULL::timestamptz;
    RETURN;
  END IF;
  IF v_date_depart <> v_today THEN
    RETURN QUERY SELECT 'AUTRE_JOUR_DEPART'::text, NULL::uuid, NULL::timestamptz;
    RETURN;
  END IF;

  -- Atomic audit + state transition; any failure rolls back both writes.
  INSERT INTO public.messay_interurbain_embarquements
    (ticket_id,company_id,gare_id,affectation_id,agent_auth_user_id)
    VALUES (v_ticket.id,p_company_id,p_gare_id,v_ticket.affectation_id,p_agent_auth_user_id)
    RETURNING valide_le INTO embarque_le;
  UPDATE public.tickets t SET status='UTILISE'
    WHERE t.id=v_ticket.id AND t.status='PAYE';
  IF NOT FOUND THEN RAISE EXCEPTION 'E32_CONFLIT_STATUT' USING ERRCODE='P0001'; END IF;
  resultat := 'EMBARQUEMENT_VALIDE'; billet_id := v_ticket.id;
  RETURN NEXT;
END;
$function$
;


-- Protection des 14 fonctions SECURITY DEFINER. Trigger n est pas invocable directement.
REVOKE ALL ON FUNCTION public.messay_interurbain_ack_reconciliation_job(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.messay_interurbain_ack_reconciliation_job(uuid, uuid, text) TO service_role;
REVOKE ALL ON FUNCTION public.messay_interurbain_ack_reference_recovery_job(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.messay_interurbain_ack_reference_recovery_job(uuid, uuid, text, text) TO service_role;
REVOKE ALL ON FUNCTION public.messay_interurbain_checkout_a_rapprocher(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.messay_interurbain_checkout_a_rapprocher(uuid, uuid) TO service_role;
REVOKE ALL ON FUNCTION public.messay_interurbain_claim_reconciliation_jobs(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.messay_interurbain_claim_reconciliation_jobs(integer) TO service_role;
REVOKE ALL ON FUNCTION public.messay_interurbain_claim_reference_recovery_jobs(integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.messay_interurbain_claim_reference_recovery_jobs(integer, integer) TO service_role;
REVOKE ALL ON FUNCTION public.messay_interurbain_creer_intention_tarif(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.messay_interurbain_creer_intention_tarif(uuid, uuid, text, text) TO service_role;
REVOKE ALL ON FUNCTION public.messay_interurbain_enregistrer_checkout(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.messay_interurbain_enregistrer_checkout(uuid, uuid, text, text) TO service_role;
REVOKE ALL ON FUNCTION public.messay_interurbain_finaliser_paiement(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.messay_interurbain_finaliser_paiement(uuid, jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.messay_interurbain_lier_evenements_webhook(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.messay_interurbain_lier_evenements_webhook(uuid, text) TO service_role;
REVOKE ALL ON FUNCTION public.messay_interurbain_rattraper_webhooks_tardifs(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.messay_interurbain_rattraper_webhooks_tardifs(integer) TO service_role;
REVOKE ALL ON FUNCTION public.messay_interurbain_reclamer_checkout(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.messay_interurbain_reclamer_checkout(uuid, uuid) TO service_role;
REVOKE ALL ON FUNCTION public.messay_interurbain_recuperer_reference_webhook(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.messay_interurbain_recuperer_reference_webhook(uuid, jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.messay_interurbain_reference_recovery_on_intent() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.messay_interurbain_valider_embarquement(text, uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.messay_interurbain_valider_embarquement(text, uuid, uuid, uuid) TO service_role;

-- Declencheur de recuperation reference : pas d activation des paiements.
DO $e52trigger$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_trigger tg
   WHERE tg.tgrelid='public.messay_interurbain_payment_intents'::regclass
   AND tg.tgname='messay_interurbain_reference_recovery_trigger'
   AND NOT tg.tgisinternal) THEN
   CREATE TRIGGER messay_interurbain_reference_recovery_trigger
     AFTER UPDATE OF checkout_state, provider_reference, financial_status, issuance_status
     ON public.messay_interurbain_payment_intents
     FOR EACH ROW EXECUTE FUNCTION public.messay_interurbain_reference_recovery_on_intent();
 END IF;
END
$e52trigger$;

-- Aucun role public ne doit ecrire dans les 4 nouvelles tables.
ALTER TABLE public.messay_interurbain_departs_places_verifies ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.messay_interurbain_departs_places_verifies FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.messay_interurbain_departs_places_verifies TO service_role;
ALTER TABLE public.messay_interurbain_embarquements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.messay_interurbain_embarquements FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.messay_interurbain_embarquements TO service_role;
ALTER TABLE public.messay_interurbain_reconciliation_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.messay_interurbain_reconciliation_jobs FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.messay_interurbain_reconciliation_jobs TO service_role;
ALTER TABLE public.messay_interurbain_reference_recovery_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.messay_interurbain_reference_recovery_jobs FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.messay_interurbain_reference_recovery_jobs TO service_role;

-- Validation atomique AVANT COMMIT ; si erreur, la transaction reste annulable.
DO $e55_postflight$
DECLARE
  v_tables int;
  v_cols int;
  v_funcs int;
  v_no_exec int;
BEGIN
  SELECT count(*) INTO v_tables FROM (VALUES
    ('messay_interurbain_departs_places_verifies'),
    ('messay_interurbain_embarquements'),
    ('messay_interurbain_reconciliation_jobs'),
    ('messay_interurbain_reference_recovery_jobs')
  ) AS x(name) WHERE to_regclass(format('public.%I',x.name)) IS NOT NULL;
  IF v_tables <> 4 THEN RAISE EXCEPTION 'E55_POST_TABLES=%',v_tables; END IF;
  SELECT count(*) INTO v_cols FROM information_schema.columns c WHERE c.table_schema='public'
    AND ((c.table_name='messay_interurbain_payment_intents'
       AND c.column_name IN ('checkout_url','passenger_name','passenger_phone','review_reason'))
      OR (c.table_name='tickets' AND c.column_name IN ('affectation_id','hold_id','intent_id')));
  IF v_cols <> 7 THEN RAISE EXCEPTION 'E55_POST_COLONNES=%',v_cols; END IF;
  SELECT count(*) INTO v_funcs FROM pg_proc p JOIN pg_namespace ns ON ns.oid=p.pronamespace
   WHERE ns.nspname='public' AND p.prosecdef AND p.proname IN (
      'messay_interurbain_ack_reconciliation_job',
      'messay_interurbain_ack_reference_recovery_job',
      'messay_interurbain_checkout_a_rapprocher',
      'messay_interurbain_claim_reconciliation_jobs',
      'messay_interurbain_claim_reference_recovery_jobs',
      'messay_interurbain_creer_intention_tarif',
      'messay_interurbain_enregistrer_checkout',
      'messay_interurbain_finaliser_paiement',
      'messay_interurbain_lier_evenements_webhook',
      'messay_interurbain_rattraper_webhooks_tardifs',
      'messay_interurbain_reclamer_checkout',
      'messay_interurbain_recuperer_reference_webhook',
      'messay_interurbain_reference_recovery_on_intent',
      'messay_interurbain_valider_embarquement');
  IF v_funcs <> 14 THEN RAISE EXCEPTION 'E55_POST_FONCTIONS=%',v_funcs; END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_constraint c
    WHERE c.conrelid='public.messay_bus_affectations'::regclass
      AND c.conname='messay_c_affectations_id_company_gare_uk')
    OR NOT EXISTS(SELECT 1 FROM pg_constraint c
    WHERE c.conrelid='public.messay_interurbain_departs_places_verifies'::regclass
      AND c.conname='messay_c_certif_affectation_company_gare_fk') THEN
    RAISE EXCEPTION 'E55_POST_CLE_COMPOSITE_OU_FK_ABSENTE';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='tickets'
    AND indexname='messay_tickets_intent_unique_idx')
    OR NOT EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='tickets'
    AND indexname='messay_tickets_hold_unique_idx')
    OR NOT EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='tickets'
    AND indexname='messay_interurbain_tickets_qr_unique') THEN
    RAISE EXCEPTION 'E55_POST_INDEX_UNIQUE_ABSENT';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_trigger t
    WHERE t.tgrelid='public.messay_interurbain_payment_intents'::regclass
    AND t.tgname='messay_interurbain_reference_recovery_trigger'
    AND NOT t.tgisinternal) THEN
    RAISE EXCEPTION 'E55_POST_TRIGGER_ABSENT';
  END IF;
  SELECT count(*) INTO v_no_exec FROM pg_proc p JOIN pg_namespace ns ON ns.oid=p.pronamespace
    WHERE ns.nspname='public' AND p.proname='messay_interurbain_finaliser_paiement'
      AND (has_function_privilege('anon',p.oid,'EXECUTE')
        OR has_function_privilege('authenticated',p.oid,'EXECUTE')
        OR NOT has_function_privilege('service_role',p.oid,'EXECUTE'));
  IF v_no_exec <> 0 THEN RAISE EXCEPTION 'E55_POST_PRIVILEGES_INCORRECTS'; END IF;
  RAISE NOTICE 'E55_MIGRATION_SQL_OBJECTS_OK';
END;
$e55_postflight$;
COMMIT;
