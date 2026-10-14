BEGIN;
CREATE TABLE commerce.order_delivery (
  order_id uuid PRIMARY KEY REFERENCES commerce.orders(id),
  recipient_name text NOT NULL CHECK (length(btrim(recipient_name)) BETWEEN 1 AND 100),
  phone text NOT NULL CHECK (length(phone) BETWEEN 7 AND 30),
  address_line1 text NOT NULL CHECK (length(btrim(address_line1)) BETWEEN 1 AND 200),
  address_line2 text NOT NULL DEFAULT '' CHECK (length(address_line2) <= 200),
  city text NOT NULL CHECK (length(btrim(city)) BETWEEN 1 AND 100),
  postal_code text NOT NULL DEFAULT '' CHECK (length(postal_code) <= 20),
  country text NOT NULL CHECK (country = 'PK')
);
ALTER TABLE commerce.order_delivery ENABLE ROW LEVEL SECURITY;
ALTER TABLE commerce.order_delivery FORCE ROW LEVEL SECURITY;
REVOKE ALL ON commerce.order_delivery FROM PUBLIC;
-- No public policies or grants. Retention/deletion workflows must be defined before launch.
INSERT INTO commerce.schema_migrations(version) VALUES ('0004_order_delivery');
COMMIT;
