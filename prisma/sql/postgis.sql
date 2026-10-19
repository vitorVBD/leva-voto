-- Ponto geográfico do voluntário e índice para ST_DWithin / ST_Distance.
-- Rode depois de `npx prisma db push`.

CREATE EXTENSION IF NOT EXISTS postgis;

ALTER TABLE voluntarios
  ADD COLUMN IF NOT EXISTS localizacao geography(Point, 4326);

UPDATE voluntarios
SET localizacao = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
WHERE localizacao IS NULL;

CREATE INDEX IF NOT EXISTS voluntarios_localizacao_gix
  ON voluntarios
  USING GIST (localizacao);

CREATE OR REPLACE FUNCTION voluntarios_sync_localizacao() RETURNS trigger AS $$
BEGIN
  NEW.localizacao := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS voluntarios_localizacao_trg ON voluntarios;

CREATE TRIGGER voluntarios_localizacao_trg
BEFORE INSERT OR UPDATE OF latitude, longitude ON voluntarios
FOR EACH ROW
EXECUTE FUNCTION voluntarios_sync_localizacao();
