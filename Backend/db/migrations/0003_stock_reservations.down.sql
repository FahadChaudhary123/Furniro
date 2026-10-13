BEGIN;
LOCK TABLE commerce.inventory_stock, commerce.stock_reservations, commerce.stock_reservation_events
  IN ACCESS EXCLUSIVE MODE;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM commerce.inventory_stock) OR
     EXISTS (SELECT 1 FROM commerce.stock_reservations) OR
     EXISTS (SELECT 1 FROM commerce.stock_reservation_events) THEN
    RAISE EXCEPTION 'Cannot roll back inventory schema while stock or reservation records exist';
  END IF;
END $$;
DROP TABLE commerce.stock_reservation_events;
DROP TABLE commerce.stock_reservations;
DROP TABLE commerce.inventory_stock;
DROP FUNCTION commerce.apply_stock_reservation();
DROP FUNCTION commerce.record_stock_reservation_event();
DROP FUNCTION commerce.protect_stock_reservation_event();
ALTER TABLE commerce.order_items DROP CONSTRAINT order_items_reservation_identity;
DELETE FROM commerce.schema_migrations WHERE version = '0003_stock_reservations';
COMMIT;
