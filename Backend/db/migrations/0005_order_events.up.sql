BEGIN;
CREATE TABLE commerce.order_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES commerce.orders(id),
  event_type text NOT NULL CHECK (event_type = 'cod_cancelled'),
  actor_id uuid NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (order_id, event_type)
);
CREATE FUNCTION commerce.protect_order_event() RETURNS trigger
LANGUAGE plpgsql AS $$ BEGIN
  RAISE EXCEPTION 'Order history is immutable' USING ERRCODE = '23514';
END; $$;
CREATE TRIGGER order_event_immutable BEFORE UPDATE OR DELETE ON commerce.order_events
FOR EACH ROW EXECUTE FUNCTION commerce.protect_order_event();
ALTER TABLE commerce.order_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE commerce.order_events FORCE ROW LEVEL SECURITY;
REVOKE ALL ON commerce.order_events FROM PUBLIC;
REVOKE ALL ON SEQUENCE commerce.order_events_id_seq FROM PUBLIC;
REVOKE ALL ON FUNCTION commerce.protect_order_event() FROM PUBLIC;
INSERT INTO commerce.schema_migrations(version) VALUES ('0005_order_events');
COMMIT;
