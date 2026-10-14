BEGIN;
LOCK TABLE commerce.order_events, commerce.orders IN ACCESS EXCLUSIVE MODE;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM commerce.order_events WHERE event_type <> 'cod_cancelled') OR
     EXISTS (SELECT 1 FROM commerce.orders WHERE payment_method = 'cod'
       AND status IN ('allocated', 'despatched', 'delivered')) THEN
    RAISE EXCEPTION 'Cannot roll back fulfilment while progressed orders or events exist';
  END IF;
END $$;
ALTER TABLE commerce.order_events DROP CONSTRAINT order_events_event_type_check;
ALTER TABLE commerce.order_events ADD CONSTRAINT order_events_event_type_check
  CHECK (event_type = 'cod_cancelled');
DELETE FROM commerce.schema_migrations WHERE version = '0006_cod_fulfilment_events';
COMMIT;
