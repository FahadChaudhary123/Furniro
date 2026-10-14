BEGIN;
LOCK TABLE commerce.cod_collections IN ACCESS EXCLUSIVE MODE;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM commerce.cod_collections) THEN
    RAISE EXCEPTION 'Cannot roll back COD collections while records exist';
  END IF;
END $$;
DROP TABLE commerce.cod_collections;
DROP FUNCTION commerce.protect_cod_collection();
DELETE FROM commerce.schema_migrations WHERE version = '0007_cod_collections';
COMMIT;
