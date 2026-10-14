BEGIN;
ALTER TABLE commerce.order_events DROP CONSTRAINT order_events_event_type_check;
ALTER TABLE commerce.order_events ADD CONSTRAINT order_events_event_type_check
  CHECK (event_type IN ('cod_cancelled', 'cod_allocated', 'cod_despatched', 'cod_delivered'));
INSERT INTO commerce.schema_migrations(version) VALUES ('0006_cod_fulfilment_events');
COMMIT;
