import {
  Avaliacao,
  Candidato,
  EleitorSession,
  Oferta,
  OfertaStatus,
  OrderStatus,
  Pedido,
  Secao,
  Voluntario,
} from '../domain/types';

export type TransitionExtra = {
  motivo?: string | null;
  voluntarioId?: string | null;
  raioAtualKm?: number;
  wave?: number;
  expiraEm?: string | null;
};

export interface DataStore {
  buscarSecao(filtro: {
    uf: string;
    municipio: string;
    zona: string;
    secao: string;
  }): Promise<Secao | null>;
  municipios(uf: string): Promise<string[]>;
  saveSessao(sessao: EleitorSession): Promise<void>;
  getSessao(id: string): Promise<EleitorSession | null>;
  savePedido(pedido: Pedido): Promise<void>;
  getPedido(id: string): Promise<Pedido | null>;
  listPedidosEmAberto(): Promise<Pedido[]>;
  setExpiraEm(pedidoId: string, expiraEm: string): Promise<void>;
  setRaio(pedidoId: string, raioKm: number): Promise<void>;
  marcarAceito(pedidoId: string, voluntarioId: string): Promise<Pedido | null>;
  transition(pedidoId: string, to: OrderStatus, extra?: TransitionExtra): Promise<Pedido>;
  findCandidatos(lat: number, lng: number, raioKm: number): Promise<Candidato[]>;
  saveOferta(oferta: Oferta): Promise<void>;
  listOfertas(pedidoId: string): Promise<Oferta[]>;
  listOfertasDoVoluntario(voluntarioId: string): Promise<Oferta[]>;
  getOfertaPendente(pedidoId: string, voluntarioId: string): Promise<Oferta | null>;
  marcarOferta(id: string, status: OfertaStatus): Promise<void>;
  expirarOfertasDaOnda(pedidoId: string, wave: number): Promise<void>;
  saveVoluntario(voluntario: Voluntario): Promise<void>;
  getVoluntario(id: string): Promise<Voluntario | null>;
  getVoluntarioPorCpf(cpf: string): Promise<Voluntario | null>;
  getVoluntarioPorTelefone(telefone: string): Promise<Voluntario | null>;
  listVoluntarios(): Promise<Voluntario[]>;
  saveCodigo(telefone: string, hash: string, expiraEm: string): Promise<void>;
  getCodigo(telefone: string): Promise<{ hash: string; expiraEm: string } | null>;
  consumirCodigo(telefone: string): Promise<void>;
  marcarTelefoneConfirmado(telefone: string, ate: string): Promise<void>;
  telefoneConfirmadoRecentemente(telefone: string, agora?: Date): Promise<boolean>;
  saveAvaliacao(avaliacao: Avaliacao): Promise<void>;
  getAvaliacaoPorPedido(pedidoId: string): Promise<Avaliacao | null>;
  expurgarMobilidade(corte: Date): Promise<number>;
  expurgarDadosPessoais(corte: Date): Promise<number>;
  ensureSecoes(secoes: Secao[]): Promise<void>;
}
