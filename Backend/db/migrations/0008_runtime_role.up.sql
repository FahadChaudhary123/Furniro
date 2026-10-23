BEGIN;
-- Cluster-wide group role only. A deployment must separately provision a login.
-- Fail on an existing role rather than trusting unknown attributes or memberships.
CREATE ROLE furniro_commerce_runtime NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
GRANT USAGE ON SCHEMA commerce TO furniro_commerce_runtime;
GRANT SELECT, INSERT ON commerce.orders, commerce.order_items, commerce.order_delivery,
  commerce.order_events, commerce.stock_reservations, commerce.stock_reservation_events,
  commerce.cod_collections TO furniro_commerce_runtime;
GRANT SELECT ON commerce.inventory_stock TO furniro_commerce_runtime;
GRANT UPDATE(status) ON commerce.orders, commerce.stock_reservations TO furniro_commerce_runtime;
-- Existing invoker triggers maintain these counters and append reservation events.
GRANT UPDATE(on_hand, reserved) ON commerce.inventory_stock TO furniro_commerce_runtime;
GRANT USAGE ON SEQUENCE commerce.order_events_id_seq, commerce.stock_reservation_events_id_seq
  TO furniro_commerce_runtime;
CREATE POLICY runtime_access ON commerce.orders TO furniro_commerce_runtime USING (true) WITH CHECK (true);
CREATE POLICY runtime_access ON commerce.order_items TO furniro_commerce_runtime USING (true) WITH CHECK (true);
CREATE POLICY runtime_access ON commerce.order_delivery TO furniro_commerce_runtime USING (true) WITH CHECK (true);
CREATE POLICY runtime_access ON commerce.order_events TO furniro_commerce_runtime USING (true) WITH CHECK (true);
CREATE POLICY runtime_access ON commerce.inventory_stock TO furniro_commerce_runtime USING (true) WITH CHECK (true);
CREATE POLICY runtime_access ON commerce.stock_reservations TO furniro_commerce_runtime USING (true) WITH CHECK (true);
CREATE POLICY runtime_access ON commerce.stock_reservation_events TO furniro_commerce_runtime USING (true) WITH CHECK (true);
CREATE POLICY runtime_access ON commerce.cod_collections TO furniro_commerce_runtime USING (true) WITH CHECK (true);
INSERT INTO commerce.schema_migrations(version) VALUES ('0008_runtime_role');
COMMIT;
