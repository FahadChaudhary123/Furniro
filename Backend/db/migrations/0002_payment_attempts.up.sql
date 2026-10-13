BEGIN;

ALTER TABLE commerce.orders ADD CONSTRAINT orders_payment_identity
  UNIQUE (id, total_minor, currency, payment_method);

CREATE TABLE commerce.payment_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  amount_minor bigint NOT NULL,
  currency text NOT NULL DEFAULT 'PKR',
  payment_method text NOT NULL DEFAULT 'online' CHECK (payment_method = 'online'),
  provider text NOT NULL CHECK (provider ~ '^[a-z][a-z0-9_-]{0,49}$'),
  provider_reference text CHECK (length(btrim(provider_reference)) BETWEEN 1 AND 200),
  idempotency_key uuid NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'created' CHECK
    (status IN ('created', 'pending', 'unknown', 'succeeded', 'failed', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (order_id, amount_minor, currency, payment_method)
    REFERENCES commerce.orders(id, total_minor, currency, payment_method) ON DELETE RESTRICT,
  UNIQUE (provider, provider_reference)
);

-- An uncertain result must be reconciled before another attempt can charge this order.
CREATE UNIQUE INDEX payment_attempts_one_chargeable_per_order
  ON commerce.payment_attempts(order_id)
  WHERE status IN ('created', 'pending', 'unknown', 'succeeded');
CREATE INDEX payment_attempts_order_idx ON commerce.payment_attempts(order_id);

CREATE TABLE commerce.payment_attempt_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  attempt_id uuid NOT NULL REFERENCES commerce.payment_attempts(id) ON DELETE RESTRICT,
  previous_status text,
  status text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX payment_attempt_events_attempt_idx ON commerce.payment_attempt_events(attempt_id, id);

CREATE FUNCTION commerce.guard_payment_attempt() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, commerce AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Payment attempts cannot be deleted' USING ERRCODE = '23514';
  ELSIF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'created' THEN
      RAISE EXCEPTION 'Payment attempts must start as created' USING ERRCODE = '23514';
    END IF;
  ELSE
    IF (to_jsonb(NEW) - ARRAY['status', 'provider_reference', 'updated_at'])
       IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['status', 'provider_reference', 'updated_at']) THEN
      RAISE EXCEPTION 'Payment attempt identity and amount are immutable' USING ERRCODE = '23514';
    END IF;
    IF OLD.provider_reference IS NOT NULL AND NEW.provider_reference IS DISTINCT FROM OLD.provider_reference THEN
      RAISE EXCEPTION 'Payment provider reference is immutable' USING ERRCODE = '23514';
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status AND (
      OLD.status IN ('succeeded', 'failed', 'cancelled') OR NEW.status = 'created'
    ) THEN
      RAISE EXCEPTION 'Invalid payment attempt transition' USING ERRCODE = '23514';
    END IF;
  END IF;
  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END;
$$;

CREATE FUNCTION commerce.record_payment_attempt_event() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, commerce AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO commerce.payment_attempt_events(attempt_id, status) VALUES (NEW.id, NEW.status);
  ELSIF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO commerce.payment_attempt_events(attempt_id, previous_status, status)
      VALUES (NEW.id, OLD.status, NEW.status);
  END IF;
  RETURN NULL;
END;
$$;

CREATE FUNCTION commerce.protect_payment_attempt_event() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, commerce AS $$
BEGIN
  RAISE EXCEPTION 'Payment attempt events are immutable' USING ERRCODE = '23514';
END;
$$;

CREATE TRIGGER payment_attempt_guard BEFORE INSERT OR UPDATE OR DELETE ON commerce.payment_attempts
FOR EACH ROW EXECUTE FUNCTION commerce.guard_payment_attempt();
CREATE TRIGGER payment_attempt_event AFTER INSERT OR UPDATE ON commerce.payment_attempts
FOR EACH ROW EXECUTE FUNCTION commerce.record_payment_attempt_event();
CREATE TRIGGER payment_event_immutable BEFORE UPDATE OR DELETE ON commerce.payment_attempt_events
FOR EACH ROW EXECUTE FUNCTION commerce.protect_payment_attempt_event();

ALTER TABLE commerce.payment_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE commerce.payment_attempts FORCE ROW LEVEL SECURITY;
ALTER TABLE commerce.payment_attempt_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE commerce.payment_attempt_events FORCE ROW LEVEL SECURITY;
REVOKE ALL ON commerce.payment_attempts, commerce.payment_attempt_events FROM PUBLIC;
REVOKE ALL ON SEQUENCE commerce.payment_attempt_events_id_seq FROM PUBLIC;
REVOKE ALL ON FUNCTION commerce.guard_payment_attempt(), commerce.record_payment_attempt_event(),
  commerce.protect_payment_attempt_event() FROM PUBLIC;

INSERT INTO commerce.schema_migrations(version) VALUES ('0002_payment_attempts');
COMMIT;
