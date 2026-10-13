BEGIN;

CREATE TABLE commerce.inventory_stock (
  product_slug text PRIMARY KEY CHECK (product_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  on_hand integer NOT NULL DEFAULT 0 CHECK (on_hand >= 0),
  reserved integer NOT NULL DEFAULT 0 CHECK (reserved BETWEEN 0 AND on_hand)
);

ALTER TABLE commerce.order_items ADD CONSTRAINT order_items_reservation_identity
  UNIQUE (order_id, line_number, product_slug, quantity);

CREATE TABLE commerce.stock_reservations (
  order_id uuid NOT NULL,
  line_number integer NOT NULL,
  product_slug text NOT NULL REFERENCES commerce.inventory_stock(product_slug) ON DELETE RESTRICT,
  quantity integer NOT NULL CHECK (quantity BETWEEN 1 AND 99),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'released', 'consumed')),
  expires_at timestamptz NOT NULL CHECK (isfinite(expires_at)),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (order_id, line_number),
  FOREIGN KEY (order_id, line_number, product_slug, quantity)
    REFERENCES commerce.order_items(order_id, line_number, product_slug, quantity) ON DELETE RESTRICT
);
CREATE INDEX stock_reservations_expiry_idx ON commerce.stock_reservations(expires_at)
  WHERE status = 'active';

CREATE TABLE commerce.stock_reservation_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id uuid NOT NULL,
  line_number integer NOT NULL,
  status text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY (order_id, line_number) REFERENCES commerce.stock_reservations(order_id, line_number)
    ON DELETE RESTRICT
);

CREATE FUNCTION commerce.apply_stock_reservation() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, commerce AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Stock reservations cannot be deleted' USING ERRCODE = '23514';
  ELSIF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'active' OR NEW.expires_at <= clock_timestamp() THEN
      RAISE EXCEPTION 'New reservations must be active with a future expiry' USING ERRCODE = '23514';
    END IF;
    -- Conditional UPDATE locks the stock row; the availability predicate is rechecked
    -- by PostgreSQL after a competing writer commits. No read-then-write stock check.
    UPDATE commerce.inventory_stock SET reserved = reserved + NEW.quantity
      WHERE product_slug = NEW.product_slug AND on_hand - reserved >= NEW.quantity;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Insufficient or unconfigured stock' USING ERRCODE = '23514';
    END IF;
  ELSE
    IF (to_jsonb(NEW) - 'status') IS DISTINCT FROM (to_jsonb(OLD) - 'status') THEN
      RAISE EXCEPTION 'Reservation identity, quantity and expiry are immutable' USING ERRCODE = '23514';
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      IF OLD.status <> 'active' OR NEW.status NOT IN ('released', 'consumed') THEN
        RAISE EXCEPTION 'Invalid reservation transition' USING ERRCODE = '23514';
      END IF;
      IF NEW.status = 'consumed' AND OLD.expires_at <= clock_timestamp() THEN
        RAISE EXCEPTION 'Expired reservations cannot be consumed' USING ERRCODE = '23514';
      END IF;
      UPDATE commerce.inventory_stock SET
        reserved = reserved - OLD.quantity,
        on_hand = on_hand - CASE WHEN NEW.status = 'consumed' THEN OLD.quantity ELSE 0 END
        WHERE product_slug = OLD.product_slug;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Reservation stock row is missing' USING ERRCODE = '23514';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION commerce.record_stock_reservation_event() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, commerce AS $$
BEGIN
  IF TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO commerce.stock_reservation_events(order_id, line_number, status)
      VALUES (NEW.order_id, NEW.line_number, NEW.status);
  END IF;
  RETURN NULL;
END;
$$;
CREATE FUNCTION commerce.protect_stock_reservation_event() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, commerce AS $$
BEGIN
  RAISE EXCEPTION 'Reservation history is immutable' USING ERRCODE = '23514';
END;
$$;

-- AFTER ensures an INSERT ... ON CONFLICT DO NOTHING cannot change stock counters.
CREATE TRIGGER stock_reservation_guard AFTER INSERT OR UPDATE OR DELETE ON commerce.stock_reservations
FOR EACH ROW EXECUTE FUNCTION commerce.apply_stock_reservation();
CREATE TRIGGER stock_reservation_event AFTER INSERT OR UPDATE ON commerce.stock_reservations
FOR EACH ROW EXECUTE FUNCTION commerce.record_stock_reservation_event();
CREATE TRIGGER reservation_event_immutable BEFORE UPDATE OR DELETE ON commerce.stock_reservation_events
FOR EACH ROW EXECUTE FUNCTION commerce.protect_stock_reservation_event();

ALTER TABLE commerce.inventory_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE commerce.inventory_stock FORCE ROW LEVEL SECURITY;
ALTER TABLE commerce.stock_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE commerce.stock_reservations FORCE ROW LEVEL SECURITY;
ALTER TABLE commerce.stock_reservation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE commerce.stock_reservation_events FORCE ROW LEVEL SECURITY;
REVOKE ALL ON commerce.inventory_stock, commerce.stock_reservations, commerce.stock_reservation_events FROM PUBLIC;
REVOKE ALL ON SEQUENCE commerce.stock_reservation_events_id_seq FROM PUBLIC;
REVOKE ALL ON FUNCTION commerce.apply_stock_reservation(), commerce.record_stock_reservation_event(),
  commerce.protect_stock_reservation_event() FROM PUBLIC;
INSERT INTO commerce.schema_migrations(version) VALUES ('0003_stock_reservations');
COMMIT;
