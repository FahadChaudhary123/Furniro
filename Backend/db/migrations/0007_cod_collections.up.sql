BEGIN;
CREATE TABLE commerce.cod_collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE,
  amount_minor bigint NOT NULL CHECK (amount_minor BETWEEN 1 AND 9007199254740991),
  currency text NOT NULL DEFAULT 'PKR' CHECK (currency = 'PKR'),
  payment_method text NOT NULL DEFAULT 'cod' CHECK (payment_method = 'cod'),
  idempotency_key uuid NOT NULL UNIQUE,
  receipt_reference text NOT NULL UNIQUE CHECK (receipt_reference ~ '^[A-Z0-9][A-Z0-9._/-]{0,99}$'),
  actor_id uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY (order_id, amount_minor, currency, payment_method)
    REFERENCES commerce.orders(id, total_minor, currency, payment_method) ON DELETE RESTRICT
);
CREATE FUNCTION commerce.protect_cod_collection() RETURNS trigger
LANGUAGE plpgsql AS $$ BEGIN
  RAISE EXCEPTION 'COD collection history is immutable' USING ERRCODE = '23514';
END; $$;
CREATE TRIGGER cod_collection_immutable BEFORE UPDATE OR DELETE ON commerce.cod_collections
FOR EACH ROW EXECUTE FUNCTION commerce.protect_cod_collection();
ALTER TABLE commerce.cod_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE commerce.cod_collections FORCE ROW LEVEL SECURITY;
REVOKE ALL ON commerce.cod_collections FROM PUBLIC;
REVOKE ALL ON FUNCTION commerce.protect_cod_collection() FROM PUBLIC;
INSERT INTO commerce.schema_migrations(version) VALUES ('0007_cod_collections');
COMMIT;
