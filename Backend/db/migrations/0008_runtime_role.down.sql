BEGIN;
DROP POLICY runtime_access ON commerce.orders;
DROP POLICY runtime_access ON commerce.order_items;
DROP POLICY runtime_access ON commerce.order_delivery;
DROP POLICY runtime_access ON commerce.order_events;
DROP POLICY runtime_access ON commerce.inventory_stock;
DROP POLICY runtime_access ON commerce.stock_reservations;
DROP POLICY runtime_access ON commerce.stock_reservation_events;
DROP POLICY runtime_access ON commerce.cod_collections;
REVOKE ALL ON ALL TABLES IN SCHEMA commerce FROM furniro_commerce_runtime;
REVOKE UPDATE(status) ON commerce.orders, commerce.stock_reservations FROM furniro_commerce_runtime;
REVOKE UPDATE(on_hand, reserved) ON commerce.inventory_stock FROM furniro_commerce_runtime;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA commerce FROM furniro_commerce_runtime;
REVOKE ALL ON SCHEMA commerce FROM furniro_commerce_runtime;
-- Keep the cluster role: other databases/login memberships require separate review.
DELETE FROM commerce.schema_migrations WHERE version = '0008_runtime_role';
COMMIT;
