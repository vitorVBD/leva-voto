import { SECOES } from '../data/secoes';
import { DomainError } from '../domain/errors';
import { haversineKm, normalizeNumero, normalizeText, onlyDigits } from '../domain/geo';
import { canTransition, isTerminal } from '../domain/state-machine';
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
import { DataStore, TransitionExtra } from './types';

const clone = <T>(value: T): T => structuredClone(value);

export class MemoryStore implements DataStore {
  private secoes = new Map<string, Secao>();
  private sessoes = new Map<string, EleitorSession>();
  private pedidos = new Map<string, Pedido>();
  private voluntarios = new Map<string, Voluntario>();
  private ofertas = new Map<string, Oferta>();
  private avaliacoes = new Map<string, Avaliacao>();
  private codigos = new Map<string, { hash: string; expiraEm: string }>();
  private telefonesOk = new Map<string, string>();

  constructor(secoes: Secao[] = SECOES) {
    for (const secao of secoes) this.secoes.set(secao.id, secao);
  }

  async ensureSecoes(secoes: Secao[]): Promise<void> {
    if (this.secoes.size > 0) return;
    for (const secao of secoes) this.secoes.set(secao.id, secao);
  }

  async buscarSecao(filtro: {
    uf: string;
    municipio: string;
    zona: string;
    secao: string;
  }): Promise<Secao | null> {
    const uf = filtro.uf.toUpperCase();
    const municipio = normalizeText(filtro.municipio);
    const zona = normalizeNumero(filtro.zona);
    const secao = normalizeNumero(filtro.secao);
    for (const item of this.secoes.values()) {
      if (
        item.uf === uf &&
        normalizeText(item.municipio) === municipio &&
        normalizeNumero(item.zona) === zona &&
        normalizeNumero(item.secao) === secao
      ) {
        return clone(item);
      }
    }
    return null;
  }

  async municipios(uf: string): Promise<string[]> {
    const alvo = uf.toUpperCase();
    return [...new Set([...this.secoes.values()].filter((s) => s.uf === alvo).map((s) => s.municipio))].sort(
      (a, b) => a.localeCompare(b, 'pt-BR'),
    );
  }

  async saveSessao(sessao: EleitorSession): Promise<void> {
    this.sessoes.set(sessao.id, clone(sessao));
  }

  async getSessao(id: string): Promise<EleitorSession | null> {
    const sessao = this.sessoes.get(id);
    return sessao ? clone(sessao) : null;
  }

  async savePedido(pedido: Pedido): Promise<void> {
    this.pedidos.set(pedido.id, clone(pedido));
  }

  async getPedido(id: string): Promise<Pedido | null> {
    const pedido = this.pedidos.get(id);
    return pedido ? clone(pedido) : null;
  }

  async listPedidosEmAberto(): Promise<Pedido[]> {
    return [...this.pedidos.values()]
      .filter((pedido) => pedido.status === 'Buscando' || pedido.status === 'SemVoluntario')
      .map((pedido) => clone(pedido));
  }

  async setExpiraEm(pedidoId: string, expiraEm: string): Promise<void> {
    const pedido = this.pedidos.get(pedidoId);
    if (!pedido || pedido.status !== 'Buscando') return;
    pedido.expiraEm = expiraEm;
  }

  async setRaio(pedidoId: string, raioKm: number): Promise<void> {
    const pedido = this.pedidos.get(pedidoId);
    if (!pedido || pedido.status !== 'Buscando') return;
    pedido.raioAtualKm = raioKm;
    pedido.atualizadoEm = new Date().toISOString();
  }

  async marcarAceito(pedidoId: string, voluntarioId: string): Promise<Pedido | null> {
    const pedido = this.pedidos.get(pedidoId);
    if (!pedido || pedido.status !== 'Buscando' || !canTransition('Buscando', 'Aceito')) return null;
    pedido.status = 'Aceito';
    pedido.voluntarioId = voluntarioId;
    pedido.expiraEm = null;
    pedido.atualizadoEm = new Date().toISOString();
    return clone(pedido);
  }

  async transition(pedidoId: string, to: OrderStatus, extra?: TransitionExtra): Promise<Pedido> {
    const pedido = this.pedidos.get(pedidoId);
    if (!pedido) throw new DomainError('Pedido não encontrado.', 'nao_encontrado', 404);
    if (!canTransition(pedido.status, to)) {
      throw new DomainError(
        `Não dá para mudar de ${pedido.status} para ${to}.`,
        'transicao_invalida',
        409,
      );
    }
    const de = pedido.status;
    pedido.status = to;
    if (extra?.motivo !== undefined) pedido.motivoCancelamento = extra.motivo;
    if (extra?.voluntarioId !== undefined) pedido.voluntarioId = extra.voluntarioId;
    if (extra?.raioAtualKm !== undefined) pedido.raioAtualKm = extra.raioAtualKm;
    if (extra?.wave !== undefined) pedido.wave = extra.wave;
    if (extra?.expiraEm !== undefined) pedido.expiraEm = extra.expiraEm;
    if (to === 'Buscando' && de === 'Aberto') pedido.wave = 1;
    pedido.atualizadoEm = new Date().toISOString();
    return clone(pedido);
  }

  async findCandidatos(lat: number, lng: number, raioKm: number): Promise<Candidato[]> {
    return [...this.voluntarios.values()]
      .filter(
        (voluntario) =>
          voluntario.ativo &&
          voluntario.statusAprovacao === 'aprovado' &&
          voluntario.telefoneConfirmado &&
          voluntario.termoCondutaAceito,
      )
      .map((voluntario) => ({
        ...clone(voluntario),
        distanciaKm: haversineKm(lat, lng, voluntario.latitude, voluntario.longitude),
      }))
      .filter((voluntario) => voluntario.distanciaKm <= raioKm)
      .sort((a, b) => a.distanciaKm - b.distanciaKm || b.notaMedia - a.notaMedia);
  }

  async saveOferta(oferta: Oferta): Promise<void> {
    this.ofertas.set(oferta.id, clone(oferta));
  }

  async listOfertas(pedidoId: string): Promise<Oferta[]> {
    return [...this.ofertas.values()].filter((oferta) => oferta.pedidoId === pedidoId).map(clone);
  }

  async listOfertasDoVoluntario(voluntarioId: string): Promise<Oferta[]> {
    return [...this.ofertas.values()]
      .filter((oferta) => oferta.voluntarioId === voluntarioId)
      .map(clone);
  }

  async getOfertaPendente(pedidoId: string, voluntarioId: string): Promise<Oferta | null> {
    const oferta = [...this.ofertas.values()].find(
      (item) =>
        item.pedidoId === pedidoId && item.voluntarioId === voluntarioId && item.status === 'pendente',
    );
    return oferta ? clone(oferta) : null;
  }

  async marcarOferta(id: string, status: OfertaStatus): Promise<void> {
    const oferta = this.ofertas.get(id);
    if (!oferta) return;
    oferta.status = status;
  }

  async expirarOfertasDaOnda(pedidoId: string, wave: number): Promise<void> {
    for (const oferta of this.ofertas.values()) {
      if (oferta.pedidoId === pedidoId && oferta.wave === wave && oferta.status === 'pendente') {
        oferta.status = 'expirada';
      }
    }
  }

  async saveVoluntario(voluntario: Voluntario): Promise<void> {
    const cpf = onlyDigits(voluntario.cpf);
    const telefone = onlyDigits(voluntario.telefone);
    for (const atual of this.voluntarios.values()) {
      if (atual.id !== voluntario.id && onlyDigits(atual.cpf) === cpf) {
        throw new DomainError('Já existe cadastro com este CPF.', 'cpf_duplicado', 409);
      }
      if (atual.id !== voluntario.id && onlyDigits(atual.telefone) === telefone) {
        throw new DomainError('Já existe cadastro com este telefone.', 'telefone_duplicado', 409);
      }
    }
    this.voluntarios.set(voluntario.id, clone({ ...voluntario, cpf, telefone }));
  }

  async getVoluntario(id: string): Promise<Voluntario | null> {
    const voluntario = this.voluntarios.get(id);
    return voluntario ? clone(voluntario) : null;
  }

  async getVoluntarioPorCpf(cpf: string): Promise<Voluntario | null> {
    const digits = onlyDigits(cpf);
    const voluntario = [...this.voluntarios.values()].find((item) => onlyDigits(item.cpf) === digits);
    return voluntario ? clone(voluntario) : null;
  }

  async getVoluntarioPorTelefone(telefone: string): Promise<Voluntario | null> {
    const digits = onlyDigits(telefone);
    const voluntario = [...this.voluntarios.values()].find(
      (item) => onlyDigits(item.telefone) === digits,
    );
    return voluntario ? clone(voluntario) : null;
  }

  async listVoluntarios(): Promise<Voluntario[]> {
    return [...this.voluntarios.values()]
      .map(clone)
      .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
  }

  async saveCodigo(telefone: string, hash: string, expiraEm: string): Promise<void> {
    this.codigos.set(onlyDigits(telefone), { hash, expiraEm });
  }

  async getCodigo(telefone: string): Promise<{ hash: string; expiraEm: string } | null> {
    return this.codigos.get(onlyDigits(telefone)) ?? null;
  }

  async consumirCodigo(telefone: string): Promise<void> {
    this.codigos.delete(onlyDigits(telefone));
  }

  async marcarTelefoneConfirmado(telefone: string, ate: string): Promise<void> {
    this.telefonesOk.set(onlyDigits(telefone), ate);
  }

  async telefoneConfirmadoRecentemente(telefone: string, agora = new Date()): Promise<boolean> {
    const ate = this.telefonesOk.get(onlyDigits(telefone));
    return !!ate && new Date(ate) > agora;
  }

  async saveAvaliacao(avaliacao: Avaliacao): Promise<void> {
    this.avaliacoes.set(avaliacao.pedidoId, clone(avaliacao));
    const voluntario = this.voluntarios.get(avaliacao.voluntarioId);
    if (!voluntario) return;
    const total = voluntario.totalAvaliacoes + 1;
    voluntario.notaMedia =
      (voluntario.notaMedia * voluntario.totalAvaliacoes + avaliacao.nota) / total;
    voluntario.totalAvaliacoes = total;
  }

  async getAvaliacaoPorPedido(pedidoId: string): Promise<Avaliacao | null> {
    const avaliacao = this.avaliacoes.get(pedidoId);
    return avaliacao ? clone(avaliacao) : null;
  }

  async expurgarMobilidade(corte: Date): Promise<number> {
    let quantidade = 0;
    for (const pedido of this.pedidos.values()) {
      if (pedido.mobilidadeExpurgadaEm) continue;
      if (!isTerminal(pedido.status)) continue;
      if (new Date(pedido.atualizadoEm) > corte) continue;
      pedido.dificuldadesLocomocao = [];
      pedido.mobilidadeExpurgadaEm = new Date().toISOString();
      quantidade += 1;
    }
    return quantidade;
  }

  async expurgarDadosPessoais(corte: Date): Promise<number> {
    let quantidade = 0;
    for (const pedido of this.pedidos.values()) {
      if (pedido.dadosExpurgadosEm) continue;
      if (!isTerminal(pedido.status)) continue;
      if (new Date(pedido.atualizadoEm) > corte) continue;
      pedido.nomeEleitor = 'expurgado';
      pedido.contatoEleitor = '';
      pedido.pontoEncontro = pedido.pontoEncontro
        ? { ...pedido.pontoEncontro, endereco: 'expurgado', lat: 0, lng: 0 }
        : null;
      pedido.dadosExpurgadosEm = new Date().toISOString();
      quantidade += 1;
    }
    return quantidade;
  }
}
