BEGIN;
LOCK TABLE commerce.order_events IN ACCESS EXCLUSIVE MODE;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM commerce.order_events) THEN
    RAISE EXCEPTION 'Cannot roll back order events while records exist';
  END IF;
END $$;
DROP TABLE commerce.order_events;
DROP FUNCTION commerce.protect_order_event();
DELETE FROM commerce.schema_migrations WHERE version = '0005_order_events';
COMMIT;
