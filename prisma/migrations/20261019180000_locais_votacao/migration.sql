CREATE TABLE "locais_votacao" (
    "chave" TEXT NOT NULL,
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

    CONSTRAINT "locais_votacao_pkey" PRIMARY KEY ("chave")
);

CREATE TABLE "municipio_centroides" (
    "chave" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "municipio_centroides_pkey" PRIMARY KEY ("chave")
);
