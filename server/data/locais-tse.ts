import { createReadStream, createWriteStream } from 'node:fs';
import { stat, mkdir, rename } from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline';
import { once } from 'node:events';
import yauzl from 'yauzl';
import { chaveSecao, chaveTexto } from '../domain/geo';
import { Secao } from '../domain/types';

export const ZIP_URL =
  'https://cdn.tse.jus.br/estatistica/sead/odsele/eleitorado_locais_votacao/eleitorado_local_votacao_2026.zip';
export const ZIP_BYTES = 178_122_072;
function cacheDir(): string {
  return process.env.TSE_CACHE_DIR
    ? path.resolve(process.env.TSE_CACHE_DIR)
    : path.join(process.cwd(), 'data', 'cache');
}

function zipPath(): string {
  return path.join(cacheDir(), 'eleitorado_local_votacao_2026.zip');
}

function indicePath(): string {
  return path.join(cacheDir(), 'locais-2026.tsv');
}

export type FiltroSecao = { uf: string; municipio: string; zona: string; secao: string };

type Indice = {
  secoes: Map<string, Secao>;
  centroides: Map<string, { lat: number; lng: number }>;
};

let atual: Indice | null = null;
let pendente: Promise<Indice> | null = null;

export function garantirIndice(): Promise<Indice> {
  if (atual) return Promise.resolve(atual);
  if (!pendente) {
    pendente = montarIndice().then(
      (indice) => {
        atual = indice;
        return indice;
      },
      (error: unknown) => {
        pendente = null;
        throw error;
      },
    );
  }
  return pendente;
}

export async function buscarSecaoOficial(filtro: FiltroSecao): Promise<Secao | null> {
  if (process.env.DATABASE_URL) {
    const { buscarLocal } = await import('./locais-db');
    return buscarLocal(filtro);
  }
  const indice = await garantirIndice();
  return indice.secoes.get(chaveSecao(filtro.uf, filtro.municipio, filtro.zona, filtro.secao)) ?? null;
}

export async function centroideOficial(uf: string, municipio: string): Promise<{ lat: number; lng: number } | null> {
  if (process.env.DATABASE_URL) {
    const { centroideNoBanco } = await import('./locais-db');
    return centroideNoBanco(uf, municipio);
  }
  if (!atual) return null;
  return atual.centroides.get(`${uf.toUpperCase()}|${chaveTexto(municipio)}`) ?? null;
}

export function centroideCarregado(uf: string, municipio: string): { lat: number; lng: number } | null {
  if (!atual) return null;
  return atual.centroides.get(`${uf.toUpperCase()}|${chaveTexto(municipio)}`) ?? null;
}

export function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (quoted) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else quoted = false;
      } else cur += char;
    } else if (char === '"') quoted = true;
    else if (char === ';') {
      out.push(cur);
      cur = '';
    } else cur += char;
  }
  out.push(cur);
  return out;
}

type Registro = {
  uf: string;
  municipio: string;
  zona: string;
  secao: string;
  local: string;
  endereco: string;
  bairro: string;
  lat: number | null;
  lng: number | null;
  acessibilidade: string;
  turno: number;
};

export function registroDeLinha(header: string[], line: string): Registro | null {
  const cols = parseCsvLine(line);
  const pick = (name: string) => {
    const index = header.indexOf(name);
    return index >= 0 ? (cols[index] ?? '').trim() : '';
  };
  const uf = pick('SG_UF').toUpperCase();
  const municipio = titulo(pick('NM_MUNICIPIO'));
  const zona = pick('NR_ZONA');
  const secao = pick('NR_SECAO');
  const local = titulo(pick('NM_LOCAL_VOTACAO'));
  if (!uf || !municipio || !zona || !secao || !local) return null;
  const enderecoBase = pick('DS_ENDERECO');
  const bairro = titulo(pick('NM_BAIRRO'));
  const cep = pick('NR_CEP').replace(/\D/g, '');
  const endereco = [enderecoBase, bairro, `${municipio} - ${uf}`, cep.length === 8 ? cep.replace(/(\d{5})(\d{3})/, '$1-$2') : '']
    .filter(Boolean)
    .join(', ');
  const acessibilidade = textoAcessibilidade(pick('DS_SITU_SECAO_ACESSIBILIDADE'));
  return {
    uf,
    municipio,
    zona,
    secao,
    local,
    endereco,
    bairro,
  lat: coordenada(pick('NR_LATITUDE'), 90),
  lng: coordenada(pick('NR_LONGITUDE'), 180),
  acessibilidade,
  turno: Number(pick('NR_TURNO')) || 1,
};
}

function titulo(value: string): string {
  const limpo = value.replace(/\s+/g, ' ').trim();
  if (!limpo || limpo !== limpo.toLocaleUpperCase('pt-BR')) return limpo;
  return limpo
    .toLocaleLowerCase('pt-BR')
    .replace(/(^|[\s'-])(\p{L})/gu, (_match, prefix: string, letter: string) => prefix + letter.toLocaleUpperCase('pt-BR'));
}

function textoAcessibilidade(value: string): string {
  const limpo = value.replace(/\s+/g, ' ').trim();
  if (!limpo || limpo === '#NULO' || limpo === '#NE') {
    return 'Acessibilidade não detalhada na base aberta do TSE. Confirme no local.';
  }
  return limpo;
}

function coordenada(value: string, limite: number): number | null {
  const limpo = value.trim().replace(',', '.');
  if (!limpo || limpo === '-1' || limpo === '#NULO') return null;
  const numero = Number(limpo);
  if (!Number.isFinite(numero)) return null;
  const ajustado = Math.abs(numero) > limite ? numero / 1e6 : numero;
  if (Math.abs(ajustado) > limite || ajustado === 0) return null;
  return ajustado;
}

const SIGLAS = new Set(['sesc', 'sesi', 'senai', 'senac', 'sebrae']);

function exibirLocal(nome: string): string {
  return nome
    .split(' ')
    .map((parte) => (SIGLAS.has(parte.toLocaleLowerCase('pt-BR')) ? parte.toLocaleUpperCase('pt-BR') : parte))
    .join(' ');
}

function paraSecao(item: Registro): Secao {
  return {
    id: `${item.uf.toLowerCase()}-${chaveTexto(item.municipio).replace(/ /g, '-')}-${item.zona}-${item.secao}`,
    uf: item.uf,
    municipio: item.municipio,
    zona: item.zona.replace(/^0+/, '') || '0',
    secao: item.secao.replace(/^0+/, '') || '0',
    local: exibirLocal(item.local),
    endereco: item.endereco,
    bairro: item.bairro,
    latitude: item.lat ?? 0,
    longitude: item.lng ?? 0,
    acessibilidade: item.acessibilidade,
  };
}

async function montarIndice(): Promise<Indice> {
  await mkdir(cacheDir(), { recursive: true });
  if (!(await indiceValido())) {
    const zip = await garantirZip();
    await construirTsv(zip);
  }
  return carregarTsv();
}

async function indiceValido(): Promise<boolean> {
  try {
    const info = await stat(indicePath());
    return info.size > 1_000_000;
  } catch {
    return false;
  }
}

async function tamanho(arquivo: string): Promise<number> {
  try {
    return (await stat(arquivo)).size;
  } catch {
    return 0;
  }
}

async function garantirZip(): Promise<string> {
  const prazo = Date.now() + 300_000;
  let ultimo = -1;
  let estavel = 0;
  while (Date.now() < prazo) {
    const bytes = await tamanho(zipPath());
    if (bytes >= ZIP_BYTES) return zipPath();
    if (bytes === 0) break;
    if (bytes === ultimo) estavel += 1;
    else estavel = 0;
    ultimo = bytes;
    if (estavel >= 3) break;
    await esperar(2000);
  }
  if ((await tamanho(zipPath())) >= ZIP_BYTES) return zipPath();
  const parcial = `${zipPath()}.part`;
  const response = await fetch(ZIP_URL, { signal: AbortSignal.timeout(300_000) });
  if (!response.ok || !response.body) throw new Error('Não foi possível baixar a base de locais do TSE.');
  const destino = createWriteStream(parcial);
  const reader = response.body.getReader();
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    if (!destino.write(Buffer.from(chunk.value))) await once(destino, 'drain');
  }
  destino.end();
  await once(destino, 'finish');
  if ((await tamanho(zipPath())) < ZIP_BYTES) await rename(parcial, zipPath());
  if ((await tamanho(zipPath())) < ZIP_BYTES) throw new Error('O download da base do TSE ficou incompleto.');
  return zipPath();
}

function esperar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function construirTsv(zip: string): Promise<void> {
  const membros = await listarZip(zip);
  const csv = membros.find((nome) => /brasil\.csv$/i.test(nome));
  if (!csv) throw new Error('O arquivo do TSE não trouxe o CSV nacional de locais de votação.');
  const saida = createWriteStream(`${indicePath()}.part`);
  const progresso = { header: null as string[] | null, linhas: 0 };
  await lerCsv(zip, csv, 'latin1', (line) => {
    const limpa = line.replace(/^\uFEFF/, '').trim();
    if (!limpa) return;
    if (!progresso.header) {
      progresso.header = parseCsvLine(limpa).map((coluna) => coluna.replace(/^\uFEFF/, '').trim());
      return;
    }
    const registro = registroDeLinha(progresso.header, limpa);
    if (!registro) return;
    progresso.linhas += 1;
    saida.write(
      [registro.uf, registro.municipio, registro.zona, registro.secao, registro.local, registro.endereco, registro.bairro, registro.lat ?? '', registro.lng ?? '', registro.acessibilidade, registro.turno]
        .map(campoTsv)
        .join('\t') + '\n',
    );
  });
  saida.end();
  await once(saida, 'finish');
  if (!progresso.header?.includes('NM_LOCAL_VOTACAO') || progresso.linhas < 1000) {
    throw new Error('A base de locais do TSE veio incompleta.');
  }
  await rename(`${indicePath()}.part`, indicePath());
}

function campoTsv(value: string | number): string {
  return String(value).replace(/[\t\r\n]/g, ' ');
}

function listarZip(zip: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    yauzl.open(zip, { lazyEntries: true }, (error, file) => {
      if (error || !file) {
        reject(error ?? new Error('Não foi possível ler o arquivo do TSE.'));
        return;
      }
      const nomes: string[] = [];
      file.on('entry', (entry) => {
        nomes.push(entry.fileName);
        file.readEntry();
      });
      file.on('end', () => resolve(nomes));
      file.on('error', reject);
      file.readEntry();
    });
  });
}

function lerCsv(
  zip: string,
  csv: string,
  encoding: BufferEncoding,
  onLine: (line: string) => 'stop' | void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    yauzl.open(zip, { lazyEntries: true, autoClose: false }, (error, file) => {
      if (error || !file) {
        reject(error ?? new Error('Não foi possível ler o arquivo do TSE.'));
        return;
      }
      let achou = false;
      const finalizar = (falha?: Error) => {
        file.close();
        if (falha) reject(falha);
        else resolve();
      };
      file.on('entry', (entry) => {
        if (entry.fileName.replace(/\\/g, '/') !== csv.replace(/\\/g, '/')) {
          file.readEntry();
          return;
        }
        achou = true;
        file.openReadStream(entry, (falha, stream) => {
          if (falha || !stream) {
            finalizar(falha ?? new Error('Não foi possível extrair os locais de votação.'));
            return;
          }
          stream.setEncoding(encoding);
          const linhas = readline.createInterface({ input: stream, crlfDelay: Infinity });
          let parar = false;
          linhas.on('line', (line) => {
            if (parar) return;
            if (onLine(line) === 'stop') {
              parar = true;
              stream.destroy();
              linhas.close();
            }
          });
          linhas.on('close', () => finalizar());
          stream.on('error', (err) => finalizar(err));
        });
      });
      file.on('end', () => {
        if (!achou) finalizar(new Error('O arquivo do TSE não trouxe o CSV nacional de locais de votação.'));
      });
      file.on('error', (err) => finalizar(err));
      file.readEntry();
    });
  });
}

type Acumulado = {
  secoes: Map<string, Secao>;
  turnos: Map<string, number>;
  somas: Map<string, { lat: number; lng: number; n: number }>;
};

function acumular(): Acumulado {
  return { secoes: new Map(), turnos: new Map(), somas: new Map() };
}

function incluir(acc: Acumulado, registro: Registro): void {
  const chave = chaveSecao(registro.uf, registro.municipio, registro.zona, registro.secao);
  const turnoAnterior = acc.turnos.get(chave) ?? 0;
  const anterior = acc.secoes.get(chave);
  if (turnoAnterior > registro.turno) return;
  if (turnoAnterior === registro.turno && anterior && anterior.latitude !== 0 && registro.lat == null) return;
  acc.turnos.set(chave, registro.turno);
  acc.secoes.set(chave, paraSecao(registro));
  if (registro.lat != null && registro.lng != null) {
    const centro = `${registro.uf}|${chaveTexto(registro.municipio)}`;
    const soma = acc.somas.get(centro) ?? { lat: 0, lng: 0, n: 0 };
    soma.lat += registro.lat;
    soma.lng += registro.lng;
    soma.n += 1;
    acc.somas.set(centro, soma);
  }
}

function finalizar(acc: Acumulado): Indice {
  for (const secao of acc.secoes.values()) {
    if (secao.latitude !== 0 || secao.longitude !== 0) continue;
    const soma = acc.somas.get(`${secao.uf}|${chaveTexto(secao.municipio)}`);
    if (!soma || soma.n === 0) continue;
    secao.latitude = soma.lat / soma.n;
    secao.longitude = soma.lng / soma.n;
  }
  const centroides = new Map<string, { lat: number; lng: number }>();
  for (const [chave, soma] of acc.somas) {
    centroides.set(chave, { lat: soma.lat / soma.n, lng: soma.lng / soma.n });
  }
  return { secoes: acc.secoes, centroides };
}

export async function indiceAPartirDoZip(zip: string): Promise<Indice> {
  const membros = await listarZip(zip);
  const csv = membros.find((nome) => /brasil\.csv$/i.test(nome));
  if (!csv) throw new Error('O arquivo do TSE não trouxe o CSV nacional de locais de votação.');
  const acc = acumular();
  const progresso = { header: null as string[] | null, linhas: 0 };
  await lerCsv(zip, csv, 'latin1', (line) => {
    const limpa = line.replace(/^\uFEFF/, '').trim();
    if (!limpa) return;
    if (!progresso.header) {
      progresso.header = parseCsvLine(limpa).map((coluna) => coluna.replace(/^\uFEFF/, '').trim());
      return;
    }
    const registro = registroDeLinha(progresso.header, limpa);
    if (!registro) return;
    progresso.linhas += 1;
    incluir(acc, registro);
  });
  if (!progresso.header?.includes('NM_LOCAL_VOTACAO') || progresso.linhas < 1000) {
    throw new Error('A base de locais do TSE veio incompleta.');
  }
  return finalizar(acc);
}

async function carregarTsv(): Promise<Indice> {
  const acc = acumular();
  const linhas = readline.createInterface({
    input: createReadStream(indicePath(), { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });
  for await (const line of linhas) {
    if (!line) continue;
    const [uf, municipio, zona, secao, local, endereco, bairro, lat, lng, acessibilidade, turno] = line.split('\t');
    if (!uf || !municipio || !zona || !secao) continue;
    incluir(acc, {
      uf,
      municipio,
      zona,
      secao,
      local: local ?? '',
      endereco: endereco ?? '',
      bairro: bairro ?? '',
      lat: lat ? Number(lat) : null,
      lng: lng ? Number(lng) : null,
      acessibilidade: acessibilidade || 'Acessibilidade não detalhada na base aberta do TSE. Confirme no local.',
      turno: Number(turno) || 1,
    });
  }
  return finalizar(acc);
}
