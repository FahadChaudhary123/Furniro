BEGIN;
LOCK TABLE commerce.order_delivery IN ACCESS EXCLUSIVE MODE;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM commerce.order_delivery) THEN
    RAISE EXCEPTION 'Cannot roll back delivery schema while delivery records exist';
  END IF;
END $$;
DROP TABLE commerce.order_delivery;
DELETE FROM commerce.schema_migrations WHERE version = '0004_order_delivery';
COMMIT;
