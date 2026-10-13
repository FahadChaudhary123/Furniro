BEGIN;
LOCK TABLE commerce.payment_attempts, commerce.payment_attempt_events IN ACCESS EXCLUSIVE MODE;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM commerce.payment_attempts) OR
     EXISTS (SELECT 1 FROM commerce.payment_attempt_events) THEN
    RAISE EXCEPTION 'Cannot roll back payment schema while attempts or events exist';
  END IF;
END $$;
DROP TABLE commerce.payment_attempt_events;
DROP TABLE commerce.payment_attempts;
DROP FUNCTION commerce.guard_payment_attempt();
DROP FUNCTION commerce.record_payment_attempt_event();
DROP FUNCTION commerce.protect_payment_attempt_event();
ALTER TABLE commerce.orders DROP CONSTRAINT orders_payment_identity;
DELETE FROM commerce.schema_migrations WHERE version = '0002_payment_attempts';
COMMIT;
