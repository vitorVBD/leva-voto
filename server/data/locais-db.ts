import { PrismaClient } from "@prisma/client";
import { chaveSecao, chaveTexto } from "../domain/geo";
import { Secao } from "../domain/types";
import type { FiltroSecao } from "./locais-tse";

const globalForPrisma = globalThis as unknown as { locaisPrisma?: PrismaClient };

function prisma(): PrismaClient {
  if (!globalForPrisma.locaisPrisma) globalForPrisma.locaisPrisma = new PrismaClient();
  return globalForPrisma.locaisPrisma;
}

function secaoDe(row: {
  uf: string;
  municipio: string;
  zona: string;
  secao: string;
  local: string;
  endereco: string;
  bairro: string;
  latitude: number;
  longitude: number;
  acessibilidade: string;
}): Secao {
  return {
    id: `${row.uf.toLowerCase()}-${chaveTexto(row.municipio).replace(/ /g, "-")}-${row.zona}-${row.secao}`,
    uf: row.uf,
    municipio: row.municipio,
    zona: row.zona,
    secao: row.secao,
    local: row.local,
    endereco: row.endereco,
    bairro: row.bairro,
    latitude: row.latitude,
    longitude: row.longitude,
    acessibilidade: row.acessibilidade,
  };
}

export async function buscarLocal(filtro: FiltroSecao): Promise<Secao | null> {
  const row = await prisma().localVotacao.findUnique({
    where: { chave: chaveSecao(filtro.uf, filtro.municipio, filtro.zona, filtro.secao) },
  });
  return row ? secaoDe(row) : null;
}

export async function centroideNoBanco(uf: string, municipio: string): Promise<{ lat: number; lng: number } | null> {
  const row = await prisma().municipioCentroide.findUnique({
    where: { chave: `${uf.toUpperCase()}|${chaveTexto(municipio)}` },
  });
  return row ? { lat: row.latitude, lng: row.longitude } : null;
}
