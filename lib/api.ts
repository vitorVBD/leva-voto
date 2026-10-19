export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await fetch(`${API_URL}${path}`, { ...init, headers });
  const text = await response.text();
  const body = text ? (JSON.parse(text) as { message?: string | string[] }) : null;
  if (!response.ok) {
    const message = Array.isArray(body?.message) ? body.message[0] : body?.message;
    throw new ApiError(message || "Não foi possível concluir agora.", response.status);
  }
  return body as T;
}

export type AppConfig = {
  enableRideFeature: boolean;
  electionAt: string;
  electionEnd: string;
  tseUrl: string;
  acceptTimeoutMs: number;
  initialRadiusKm: number;
  maxRadiusKm: number;
  termoVersao: string;
  termoCondutaVersao: string;
};

export type Termos = {
  uso: { versao: string; titulo: string; paragrafos: string[] };
  conduta: { versao: string; titulo: string; paragrafos: string[] };
};

export type Secao = {
  id: string;
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
  tre: { nome: string; site: string };
  aviso: string;
};

export type PedidoView = {
  id: string;
  eleitorId: string;
  status: string;
  tipoAjuda: string;
  faixaHorario: string | null;
  bairro: string | null;
  raioAtualKm: number;
  local: {
    nome: string;
    endereco: string;
    bairro: string;
    latitude: number;
    longitude: number;
    acessibilidade: string;
    uf: string;
    municipio: string;
    zona: string;
    secao: string;
  };
  tre: { nome: string; site: string };
  voluntario: { nome: string; telefone: string; whatsappUrl: string } | null;
  avaliado: boolean;
};

export type Preview = {
  id: string;
  tipoAjuda: string;
  bairro: string;
  faixaHorario: string | null;
};

export type Atendimento = Preview & {
  status: string;
  nomeEleitor: string;
  contatoEleitor: string;
  whatsappUrl: string;
  pontoEncontro: { lat: number; lng: number; endereco: string; bairro: string };
  dificuldadesLocomocao: string[];
  veiculoAceito: string | null;
};

export type VoluntarioResumo = {
  id: string;
  nome: string;
  statusAprovacao: string;
  ativo: boolean;
  bairro: string | null;
  raioMaximoKm: number;
  tiposAjudaOferecidos: string[];
  ofereceCarona: boolean;
  tipoVeiculo: string | null;
  veiculoAdaptado: boolean;
  disponibilidadeHorarios: string[];
  cpf?: string;
  telefone?: string;
  email?: string;
  notaMedia?: number;
  totalAvaliacoes?: number;
};
