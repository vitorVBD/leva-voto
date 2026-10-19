import { createWriteStream } from "node:fs";
import { mkdir, stat } from "node:fs/promises";
import { once } from "node:events";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { ZIP_BYTES, ZIP_URL, indiceAPartirDoZip } from "../data/locais-tse";

const MINIMO = 300_000;
const LOTE = 500;

async function main(): Promise<void> {
  if (process.env.VERCEL !== "1" || !process.env.DATABASE_URL) return;
  const prisma = new PrismaClient();
  try {
    await prisma.$executeRawUnsafe("SET statement_timeout = '15min'");
    const atual = await prisma.localVotacao.count();
    if (atual >= MINIMO) {
      console.log(`Locais de votação já estão no banco: ${atual}.`);
      return;
    }
    if (atual > 0) {
      await prisma.$executeRawUnsafe("TRUNCATE TABLE locais_votacao, municipio_centroides");
    }
    const zip = await baixarZip();
    console.log("Lendo a base aberta do TSE.");
    const indice = await indiceAPartirDoZip(zip);
    const locais = [...indice.secoes.entries()].map(([chave, secao]) => ({
      chave,
      uf: secao.uf,
      municipio: secao.municipio,
      zona: secao.zona,
      secao: secao.secao,
      local: secao.local,
      endereco: secao.endereco,
      bairro: secao.bairro,
      latitude: secao.latitude,
      longitude: secao.longitude,
      acessibilidade: secao.acessibilidade,
    }));
    for (let i = 0; i < locais.length; i += LOTE) {
      await prisma.localVotacao.createMany({ data: locais.slice(i, i + LOTE) });
      if (i % 50_000 === 0) console.log(`Locais gravados: ${Math.min(i + LOTE, locais.length)} de ${locais.length}.`);
    }
    const centros = [...indice.centroides.entries()].map(([chave, ponto]) => ({
      chave,
      latitude: ponto.lat,
      longitude: ponto.lng,
    }));
    for (let i = 0; i < centros.length; i += LOTE) {
      await prisma.municipioCentroide.createMany({ data: centros.slice(i, i + LOTE) });
    }
    console.log(`Base do TSE gravada: ${locais.length} seções e ${centros.length} municípios.`);
  } finally {
    await prisma.$disconnect();
  }
}

async function baixarZip(): Promise<string> {
  const dir = path.join(process.cwd(), ".next", "tse");
  await mkdir(dir, { recursive: true });
  const arquivo = path.join(dir, "eleitorado_local_votacao_2026.zip");
  try {
    if ((await stat(arquivo)).size >= ZIP_BYTES) return arquivo;
  } catch {
    // ainda não existe
  }
  console.log("Baixando a base aberta do TSE.");
  const response = await fetch(ZIP_URL, { signal: AbortSignal.timeout(300_000) });
  if (!response.ok || !response.body) throw new Error("Não foi possível baixar a base de locais do TSE.");
  const destino = createWriteStream(arquivo);
  const reader = response.body.getReader();
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    if (!destino.write(Buffer.from(chunk.value))) await once(destino, "drain");
  }
  destino.end();
  await once(destino, "finish");
  if ((await stat(arquivo)).size < ZIP_BYTES) throw new Error("O download da base do TSE ficou incompleto.");
  return arquivo;
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
