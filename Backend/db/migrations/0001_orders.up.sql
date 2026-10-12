BEGIN;

CREATE SCHEMA commerce;
REVOKE ALL ON SCHEMA commerce FROM PUBLIC;

CREATE TABLE commerce.schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE commerce.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key uuid NOT NULL UNIQUE,
  request_hash text NOT NULL CHECK (request_hash ~ '^[a-f0-9]{64}$'),
  currency text NOT NULL DEFAULT 'PKR' CHECK (currency = 'PKR'),
  payment_method text NOT NULL CHECK (payment_method IN ('cod', 'online')),
  status text NOT NULL DEFAULT 'pending_payment' CHECK (status IN
    ('pending_payment', 'on_hold', 'allocated', 'despatched', 'delivered', 'cancelled')),
  subtotal_minor bigint NOT NULL CHECK (subtotal_minor BETWEEN 1 AND 9007199254740991),
  discount_minor bigint NOT NULL DEFAULT 0 CHECK (discount_minor BETWEEN 0 AND subtotal_minor),
  shipping_minor bigint NOT NULL DEFAULT 0 CHECK (shipping_minor BETWEEN 0 AND 9007199254740991),
  tax_minor bigint NOT NULL DEFAULT 0 CHECK (tax_minor BETWEEN 0 AND 9007199254740991),
  total_minor bigint NOT NULL CHECK (total_minor BETWEEN 1 AND 9007199254740991),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (total_minor = subtotal_minor - discount_minor + shipping_minor + tax_minor)
);

CREATE TABLE commerce.order_items (
  order_id uuid NOT NULL REFERENCES commerce.orders(id) ON DELETE RESTRICT,
  line_number integer NOT NULL CHECK (line_number > 0),
  product_slug text NOT NULL CHECK (product_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  product_name text NOT NULL CHECK (length(btrim(product_name)) BETWEEN 1 AND 200),
  quantity integer NOT NULL CHECK (quantity BETWEEN 1 AND 99),
  unit_price_minor bigint NOT NULL CHECK (unit_price_minor BETWEEN 1 AND 9007199254740991),
  line_total_minor bigint GENERATED ALWAYS AS (quantity::bigint * unit_price_minor) STORED
    CHECK (line_total_minor BETWEEN 1 AND 9007199254740991),
  PRIMARY KEY (order_id, line_number),
  UNIQUE (order_id, product_slug)
);

CREATE INDEX orders_status_created_idx ON commerce.orders(status, created_at);

-- The order and its lines must be inserted in the same transaction. Validation is
-- deferred until commit so a partially written order can never become visible.
CREATE FUNCTION commerce.check_order_subtotal() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, commerce AS $$
DECLARE
  target_id uuid;
  expected bigint;
  actual numeric;
BEGIN
  IF TG_TABLE_NAME = 'orders' THEN target_id := NEW.id;
  ELSE target_id := NEW.order_id;
  END IF;
  SELECT subtotal_minor INTO expected FROM commerce.orders WHERE id = target_id;
  SELECT sum(line_total_minor) INTO actual FROM commerce.order_items WHERE order_id = target_id;
  IF actual IS NULL OR actual <> expected THEN
    RAISE EXCEPTION 'Order subtotal does not match item snapshots' USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER orders_subtotal_check AFTER INSERT ON commerce.orders
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION commerce.check_order_subtotal();
CREATE CONSTRAINT TRIGGER items_subtotal_check AFTER INSERT ON commerce.order_items
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION commerce.check_order_subtotal();

CREATE FUNCTION commerce.protect_order_snapshot() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, commerce AS $$
BEGIN
  IF TG_TABLE_NAME = 'order_items' THEN
    RAISE EXCEPTION 'Order item snapshots are immutable' USING ERRCODE = '23514';
  END IF;
  IF (to_jsonb(NEW) - 'status') IS DISTINCT FROM (to_jsonb(OLD) - 'status') THEN
    RAISE EXCEPTION 'Order financial snapshot is immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER items_immutable BEFORE UPDATE OR DELETE ON commerce.order_items
FOR EACH ROW EXECUTE FUNCTION commerce.protect_order_snapshot();
CREATE TRIGGER order_snapshot_immutable BEFORE UPDATE ON commerce.orders
FOR EACH ROW EXECUTE FUNCTION commerce.protect_order_snapshot();

ALTER TABLE commerce.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE commerce.orders FORCE ROW LEVEL SECURITY;
ALTER TABLE commerce.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE commerce.order_items FORCE ROW LEVEL SECURITY;
ALTER TABLE commerce.schema_migrations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA commerce FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA commerce FROM PUBLIC;

INSERT INTO commerce.schema_migrations(version) VALUES ('0001_orders');
COMMIT;
