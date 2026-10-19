-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('Aberto', 'Buscando', 'SemVoluntario', 'Aceito', 'EmAndamento', 'Concluido', 'Cancelado');

-- CreateEnum
CREATE TYPE "DificuldadeLocomocao" AS ENUM ('cadeira_de_rodas', 'andador', 'baixa_visao', 'acompanhante');

-- CreateEnum
CREATE TYPE "TipoAjuda" AS ENUM ('orientacao_detalhada', 'acompanhante_a_pe', 'carona');

-- CreateEnum
CREATE TYPE "TipoVeiculo" AS ENUM ('carro', 'moto');

-- CreateEnum
CREATE TYPE "StatusAprovacao" AS ENUM ('pendente', 'aprovado', 'recusado');

-- CreateEnum
CREATE TYPE "FaixaHorario" AS ENUM ('manha', 'tarde', 'fim_de_tarde');

-- CreateEnum
CREATE TYPE "OfertaStatus" AS ENUM ('pendente', 'aceita', 'recusada', 'expirada', 'perdida');

-- CreateTable
CREATE TABLE "eleitor_sessoes" (
    "id" UUID NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "cep" TEXT,
    "endereco_origem" TEXT,
    "uf" TEXT NOT NULL,
    "municipio" TEXT NOT NULL,
    "zona" TEXT NOT NULL,
    "secao" TEXT NOT NULL,
    "local_votacao" TEXT NOT NULL,
    "endereco_votacao" TEXT NOT NULL,
    "bairro_votacao" TEXT NOT NULL,
    "latitude_votacao" DOUBLE PRECISION NOT NULL,
    "longitude_votacao" DOUBLE PRECISION NOT NULL,
    "acessibilidade" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eleitor_sessoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pedidos" (
    "id" UUID NOT NULL,
    "eleitor_id" UUID NOT NULL,
    "nome_eleitor" TEXT NOT NULL,
    "contato_eleitor" TEXT NOT NULL,
    "aceite_lgpd" BOOLEAN NOT NULL,
    "aceite_lgpd_em" TIMESTAMP(3) NOT NULL,
    "termo_versao" TEXT NOT NULL,
    "dificuldades_locomocao" "DificuldadeLocomocao"[],
    "tipo_ajuda" "TipoAjuda" NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'Aberto',
    "veiculo_aceito" "TipoVeiculo",
    "faixa_horario" "FaixaHorario",
    "ponto_lat" DOUBLE PRECISION,
    "ponto_lng" DOUBLE PRECISION,
    "ponto_endereco" TEXT,
    "ponto_bairro" TEXT,
    "voluntario_id" UUID,
    "raio_atual_km" DOUBLE PRECISION NOT NULL DEFAULT 2,
    "wave" INTEGER NOT NULL DEFAULT 0,
    "expira_em" TIMESTAMP(3),
    "motivo_cancelamento" TEXT,
    "mobilidade_expurgada_em" TIMESTAMP(3),
    "dados_expurgados_em" TIMESTAMP(3),
    "acesso_hash" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pedidos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voluntarios" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "cpf" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telefone_confirmado" BOOLEAN NOT NULL DEFAULT false,
    "termo_conduta_aceito" BOOLEAN NOT NULL DEFAULT false,
    "termo_conduta_em" TIMESTAMP(3),
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "bairro" TEXT,
    "raio_maximo_km" DOUBLE PRECISION NOT NULL,
    "tipos_ajuda_oferecidos" "TipoAjuda"[],
    "oferece_carona" BOOLEAN NOT NULL DEFAULT false,
    "tipo_veiculo" "TipoVeiculo",
    "veiculo_adaptado" BOOLEAN NOT NULL DEFAULT false,
    "disponibilidade_horarios" "FaixaHorario"[],
    "status_aprovacao" "StatusAprovacao" NOT NULL DEFAULT 'pendente',
    "ativo" BOOLEAN NOT NULL DEFAULT false,
    "nota_media" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_avaliacoes" INTEGER NOT NULL DEFAULT 0,
    "acesso_hash" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "voluntarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ofertas" (
    "id" UUID NOT NULL,
    "pedido_id" UUID NOT NULL,
    "voluntario_id" UUID NOT NULL,
    "wave" INTEGER NOT NULL,
    "status" "OfertaStatus" NOT NULL,
    "expira_em" TIMESTAMP(3) NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ofertas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "avaliacoes" (
    "id" UUID NOT NULL,
    "pedido_id" UUID NOT NULL,
    "voluntario_id" UUID NOT NULL,
    "nota" INTEGER NOT NULL,
    "comentario" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "avaliacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "secoes_eleitorais" (
    "id" TEXT NOT NULL,
    "uf" TEXT NOT NULL,
    "municipio" TEXT NOT NULL,
    "zona" TEXT NOT NULL,
    "secao" TEXT NOT NULL,
    "local" TEXT NOT NULL,
    "endereco" TEXT NOT NULL,
    "bairro" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "acessibilidade" TEXT NOT NULL,

    CONSTRAINT "secoes_eleitorais_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "codigos_telefone" (
    "telefone" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "expira_em" TIMESTAMP(3) NOT NULL,
    "confirmado_ate" TIMESTAMP(3),

    CONSTRAINT "codigos_telefone_pkey" PRIMARY KEY ("telefone")
);

-- CreateIndex
CREATE INDEX "pedidos_status_idx" ON "pedidos"("status");

-- CreateIndex
CREATE INDEX "pedidos_voluntario_id_idx" ON "pedidos"("voluntario_id");

-- CreateIndex
CREATE UNIQUE INDEX "voluntarios_cpf_key" ON "voluntarios"("cpf");

-- CreateIndex
CREATE UNIQUE INDEX "voluntarios_telefone_key" ON "voluntarios"("telefone");

-- CreateIndex
CREATE INDEX "ofertas_pedido_id_idx" ON "ofertas"("pedido_id");

-- CreateIndex
CREATE INDEX "ofertas_voluntario_id_idx" ON "ofertas"("voluntario_id");

-- CreateIndex
CREATE UNIQUE INDEX "avaliacoes_pedido_id_key" ON "avaliacoes"("pedido_id");

-- CreateIndex
CREATE INDEX "secoes_eleitorais_uf_idx" ON "secoes_eleitorais"("uf");

-- CreateIndex
CREATE UNIQUE INDEX "secoes_eleitorais_uf_municipio_zona_secao_key" ON "secoes_eleitorais"("uf", "municipio", "zona", "secao");

-- AddForeignKey
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_eleitor_id_fkey" FOREIGN KEY ("eleitor_id") REFERENCES "eleitor_sessoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_voluntario_id_fkey" FOREIGN KEY ("voluntario_id") REFERENCES "voluntarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ofertas" ADD CONSTRAINT "ofertas_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedidos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ofertas" ADD CONSTRAINT "ofertas_voluntario_id_fkey" FOREIGN KEY ("voluntario_id") REFERENCES "voluntarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avaliacoes" ADD CONSTRAINT "avaliacoes_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedidos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avaliacoes" ADD CONSTRAINT "avaliacoes_voluntario_id_fkey" FOREIGN KEY ("voluntario_id") REFERENCES "voluntarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- PostGIS: ponto do voluntário para ST_DWithin / ST_Distance.
CREATE EXTENSION IF NOT EXISTS postgis;

ALTER TABLE voluntarios
  ADD COLUMN IF NOT EXISTS localizacao geography(Point, 4326);

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


