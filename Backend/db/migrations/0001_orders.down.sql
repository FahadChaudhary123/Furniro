BEGIN;

LOCK TABLE commerce.orders, commerce.order_items IN ACCESS EXCLUSIVE MODE;

-- Rollback is only safe before orders exist. Never discard trading records.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM commerce.orders) THEN
    RAISE EXCEPTION 'Cannot roll back order schema while orders exist';
  END IF;
END $$;

DROP TABLE commerce.order_items;
DROP TABLE commerce.orders;
DROP FUNCTION commerce.check_order_subtotal();
DROP FUNCTION commerce.protect_order_snapshot();
DELETE FROM commerce.schema_migrations WHERE version = '0001_orders';
DROP TABLE commerce.schema_migrations;
DROP SCHEMA commerce;

COMMIT;
