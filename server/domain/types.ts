export const ORDER_STATUSES = [
  'Aberto',
  'Buscando',
  'SemVoluntario',
  'Aceito',
  'EmAndamento',
  'Concluido',
  'Cancelado',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const DIFICULDADES = [
  'cadeira_de_rodas',
  'andador',
  'baixa_visao',
  'acompanhante',
] as const;
export type DificuldadeLocomocao = (typeof DIFICULDADES)[number];

export const TIPOS_AJUDA = [
  'orientacao_detalhada',
  'acompanhante_a_pe',
  'carona',
] as const;
export type TipoAjuda = (typeof TIPOS_AJUDA)[number];

export const TIPOS_VEICULO = ['carro', 'moto'] as const;
export type TipoVeiculo = (typeof TIPOS_VEICULO)[number];

export const STATUS_APROVACAO = ['pendente', 'aprovado', 'recusado'] as const;
export type StatusAprovacao = (typeof STATUS_APROVACAO)[number];

export const FAIXAS_HORARIO = ['manha', 'tarde', 'fim_de_tarde'] as const;
export type FaixaHorario = (typeof FAIXAS_HORARIO)[number];

export const OFERTA_STATUSES = [
  'pendente',
  'aceita',
  'recusada',
  'expirada',
  'perdida',
] as const;
export type OfertaStatus = (typeof OFERTA_STATUSES)[number];

export type PontoEncontro = {
  lat: number;
  lng: number;
  endereco: string;
  bairro: string;
};

export type EleitorSession = {
  id: string;
  latitude: number | null;
  longitude: number | null;
  cep: string | null;
  enderecoOrigem: string | null;
  uf: string;
  municipio: string;
  zona: string;
  secao: string;
  localVotacao: string;
  enderecoVotacao: string;
  bairroVotacao: string;
  latitudeVotacao: number;
  longitudeVotacao: number;
  acessibilidade: string;
  criadoEm: string;
};

export type Pedido = {
  id: string;
  eleitorId: string;
  nomeEleitor: string;
  contatoEleitor: string;
  aceiteLgpd: boolean;
  aceiteLgpdEm: string;
  termoVersao: string;
  dificuldadesLocomocao: DificuldadeLocomocao[];
  tipoAjuda: TipoAjuda;
  status: OrderStatus;
  veiculoAceito: TipoVeiculo | null;
  faixaHorario: FaixaHorario | null;
  pontoEncontro: PontoEncontro | null;
  voluntarioId: string | null;
  raioAtualKm: number;
  wave: number;
  expiraEm: string | null;
  motivoCancelamento: string | null;
  mobilidadeExpurgadaEm: string | null;
  dadosExpurgadosEm: string | null;
  acessoHash: string;
  criadoEm: string;
  atualizadoEm: string;
};

export type Voluntario = {
  id: string;
  nome: string;
  cpf: string;
  telefone: string;
  email: string;
  telefoneConfirmado: boolean;
  termoCondutaAceito: boolean;
  termoCondutaEm: string | null;
  latitude: number;
  longitude: number;
  bairro: string | null;
  raioMaximoKm: number;
  tiposAjudaOferecidos: TipoAjuda[];
  ofereceCarona: boolean;
  tipoVeiculo: TipoVeiculo | null;
  veiculoAdaptado: boolean;
  disponibilidadeHorarios: FaixaHorario[];
  statusAprovacao: StatusAprovacao;
  ativo: boolean;
  notaMedia: number;
  totalAvaliacoes: number;
  acessoHash: string;
  criadoEm: string;
};

export type Oferta = {
  id: string;
  pedidoId: string;
  voluntarioId: string;
  wave: number;
  status: OfertaStatus;
  expiraEm: string;
  criadoEm: string;
};

export type Avaliacao = {
  id: string;
  pedidoId: string;
  voluntarioId: string;
  nota: number;
  comentario: string | null;
  criadoEm: string;
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
};

export type Candidato = Voluntario & { distanciaKm: number };

export type PedidoPreview = {
  id: string;
  tipoAjuda: TipoAjuda;
  bairro: string;
  faixaHorario: FaixaHorario | null;
};

export type PontoRevelado = PontoEncontro;

export type Atendimento = PedidoPreview & {
  status: OrderStatus;
  nomeEleitor: string;
  contatoEleitor: string;
  whatsappUrl: string;
  pontoEncontro: PontoRevelado;
  dificuldadesLocomocao: DificuldadeLocomocao[];
  veiculoAceito: TipoVeiculo | null;
};

export type EleitorPedidoView = {
  id: string;
  status: OrderStatus;
  tipoAjuda: TipoAjuda;
  faixaHorario: FaixaHorario | null;
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
