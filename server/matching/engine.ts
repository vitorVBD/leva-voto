import { randomUUID } from 'crypto';
import { DomainError } from '../domain/errors';
import { toAtendimento, toEleitorView, toPreview } from '../domain/redact';
import { proximoRaio, voluntarioCompativel } from '../domain/rules';
import { Atendimento, Pedido } from '../domain/types';
import { DomainEvents } from '../infra/events';
import { DistributedLock } from '../infra/lock';
import { DataStore } from '../store/types';

export type AcceptResult =
  | { ok: true; atendimento: Atendimento }
  | { ok: false; motivo: 'ja_atendido' | 'oferta_indisponivel' };

const PERDIDO = 'Outra pessoa aceitou este pedido primeiro. Obrigado por se dispor.';

export class MatchingEngine {
  private schedule: (pedidoId: string, wave: number, delayMs: number) => void = () => undefined;
  private chains = new Map<string, Promise<void>>();

  constructor(
    private readonly store: DataStore,
    private readonly lock: DistributedLock,
    private readonly events: DomainEvents,
    private readonly config: {
      acceptTimeoutMs: number;
      radiusStepKm: number;
      maxRadiusKm: number;
      initialRadiusKm?: number;
    },
  ) {}

  setScheduler(schedule: (pedidoId: string, wave: number, delayMs: number) => void): void {
    this.schedule = schedule;
  }

  async abrir(pedidoId: string): Promise<void> {
    await this.enqueue(pedidoId, async () => {
      await this.store.transition(pedidoId, 'Buscando');
      await this.avancar(pedidoId);
    });
  }

  async onWaveTimeout(pedidoId: string, wave: number): Promise<void> {
    await this.enqueue(pedidoId, async () => {
      const pedido = await this.store.getPedido(pedidoId);
      if (!pedido || pedido.status !== 'Buscando' || pedido.wave !== wave) return;
      await this.store.expirarOfertasDaOnda(pedidoId, wave);
      await this.avancar(pedidoId);
    });
  }

  async aceitar(pedidoId: string, voluntarioId: string): Promise<AcceptResult> {
    return this.enqueueResult(pedidoId, () => this.aceitarDentro(pedidoId, voluntarioId));
  }

  private async aceitarDentro(pedidoId: string, voluntarioId: string): Promise<AcceptResult> {
    const token = await this.lock.acquire(this.lockKey(pedidoId), 5);
    if (!token) return { ok: false, motivo: 'ja_atendido' };
    try {
      const oferta = await this.store.getOfertaPendente(pedidoId, voluntarioId);
      if (!oferta) {
        const atual = await this.store.getPedido(pedidoId);
        if (atual && atual.status !== 'Buscando') return { ok: false, motivo: 'ja_atendido' };
        return { ok: false, motivo: 'oferta_indisponivel' };
      }
      const pedido = await this.store.marcarAceito(pedidoId, voluntarioId);
      if (!pedido) return { ok: false, motivo: 'ja_atendido' };
      await this.store.marcarOferta(oferta.id, 'aceita');
      const outras = await this.store.listOfertas(pedidoId);
      for (const outra of outras) {
        if (outra.id === oferta.id || outra.status !== 'pendente') continue;
        await this.store.marcarOferta(outra.id, 'perdida');
        this.events.emit('chamado.perdido', {
          voluntarioId: outra.voluntarioId,
          pedidoId,
          mensagem: PERDIDO,
        });
      }
      await this.emitirPedido(pedido);
      return { ok: true, atendimento: toAtendimento(pedido) };
    } finally {
      await this.lock.release(this.lockKey(pedidoId), token);
    }
  }

  async recusar(pedidoId: string, voluntarioId: string): Promise<void> {
    await this.enqueue(pedidoId, async () => {
      const oferta = await this.store.getOfertaPendente(pedidoId, voluntarioId);
      if (!oferta) return;
      await this.store.marcarOferta(oferta.id, 'recusada');
      const pedido = await this.store.getPedido(pedidoId);
      if (!pedido || pedido.status !== 'Buscando' || pedido.wave !== oferta.wave) return;
      const pendentes = (await this.store.listOfertas(pedidoId)).filter(
        (item) => item.wave === oferta.wave && item.status === 'pendente',
      );
      if (pendentes.length === 0) await this.avancar(pedidoId);
    });
  }

  async iniciar(pedidoId: string, voluntarioId: string): Promise<Pedido> {
    const pedido = await this.exigirTitular(pedidoId, voluntarioId, 'Aceito');
    const atualizado = await this.store.transition(pedido.id, 'EmAndamento');
    await this.emitirPedido(atualizado);
    return atualizado;
  }

  async concluir(pedidoId: string, voluntarioId: string): Promise<Pedido> {
    const pedido = await this.exigirTitular(pedidoId, voluntarioId, 'EmAndamento');
    const atualizado = await this.store.transition(pedido.id, 'Concluido');
    await this.emitirPedido(atualizado);
    return atualizado;
  }

  private async cancelarAtendimentoDentro(
    pedidoId: string,
    voluntarioId: string,
    motivo: string,
  ): Promise<Pedido> {
    if (motivo.trim().length < 3) {
      throw new DomainError('Conte o motivo do cancelamento.', 'motivo_obrigatorio', 400);
    }
    const pedido = await this.store.getPedido(pedidoId);
    if (!pedido || pedido.voluntarioId !== voluntarioId) {
      throw new DomainError('Este atendimento não está com você.', 'sem_permissao', 403);
    }
    if (pedido.status !== 'Aceito' && pedido.status !== 'EmAndamento') {
      throw new DomainError('Este atendimento não pode voltar para a fila.', 'transicao_invalida', 409);
    }
    const reaberto = await this.store.transition(pedido.id, 'Buscando', {
      motivo: motivo.trim(),
      voluntarioId: null,
      wave: pedido.wave + 1,
      expiraEm: null,
    });
    await this.emitirPedido(reaberto);
    await this.avancar(reaberto.id);
    return reaberto;
  }

  async cancelarAtendimento(pedidoId: string, voluntarioId: string, motivo: string): Promise<Pedido> {
    return this.enqueueResult(pedidoId, () =>
      this.cancelarAtendimentoDentro(pedidoId, voluntarioId, motivo),
    );
  }

  async incluirNovosVoluntarios(): Promise<void> {
    const abertos = await this.store.listPedidosEmAberto();
    for (const pedido of abertos) {
      await this.enqueue(pedido.id, async () => {
        const atual = await this.store.getPedido(pedido.id);
        if (!atual) return;
        if (atual.status === 'SemVoluntario') {
          await this.store.transition(atual.id, 'Buscando', {
            raioAtualKm: this.config.initialRadiusKm ?? 2,
            wave: atual.wave + 1,
            expiraEm: null,
          });
        }
        await this.avancar(atual.id);
      });
    }
  }

  async cancelarPedido(pedidoId: string): Promise<Pedido> {
    const pedido = await this.store.getPedido(pedidoId);
    if (!pedido) throw new DomainError('Pedido não encontrado.', 'nao_encontrado', 404);
    const atualizado = await this.store.transition(pedido.id, 'Cancelado');
    await this.emitirPedido(atualizado);
    return atualizado;
  }

  private async avancar(pedidoId: string): Promise<void> {
    const pedido = await this.store.getPedido(pedidoId);
    if (!pedido || pedido.status !== 'Buscando') return;
    if (!pedido.pontoEncontro) {
      throw new DomainError('Pedido sem ponto de encontro.', 'sem_ponto', 400);
    }
    const ofertas = await this.store.listOfertas(pedido.id);
    const jaChamados = new Set(ofertas.map((oferta) => oferta.voluntarioId));
    const candidatos = (
      await this.store.findCandidatos(
        pedido.pontoEncontro.lat,
        pedido.pontoEncontro.lng,
        pedido.raioAtualKm,
      )
    ).filter((candidato) => !jaChamados.has(candidato.id) && voluntarioCompativel(pedido, candidato));

    const proximos = candidatos.slice(0, 2);
    if (proximos.length === 0) {
      const salto = proximoRaio(pedido.raioAtualKm, this.config.radiusStepKm, this.config.maxRadiusKm);
      if (salto.esgotado) {
        const sem = await this.store.transition(pedido.id, 'SemVoluntario', { expiraEm: null });
        await this.emitirPedido(sem);
        return;
      }
      await this.store.setRaio(pedido.id, salto.raioKm);
      await this.avancar(pedido.id);
      return;
    }

    const expiraEm = new Date(Date.now() + this.config.acceptTimeoutMs).toISOString();
    for (const candidato of proximos) {
      await this.store.saveOferta({
        id: randomUUID(),
        pedidoId: pedido.id,
        voluntarioId: candidato.id,
        wave: pedido.wave,
        status: 'pendente',
        expiraEm,
        criadoEm: new Date().toISOString(),
      });
      this.events.emit('chamado.novo', {
        voluntarioId: candidato.id,
        preview: toPreview(pedido),
      });
    }
    await this.store.setExpiraEm(pedido.id, expiraEm);
    this.schedule(pedido.id, pedido.wave, this.config.acceptTimeoutMs);
  }

  private async exigirTitular(pedidoId: string, voluntarioId: string, status: Pedido['status']) {
    const pedido = await this.store.getPedido(pedidoId);
    if (!pedido) throw new DomainError('Pedido não encontrado.', 'nao_encontrado', 404);
    if (pedido.voluntarioId !== voluntarioId || pedido.status !== status) {
      throw new DomainError('Este atendimento não está nesta etapa com você.', 'sem_permissao', 403);
    }
    return pedido;
  }

  private async emitirPedido(pedido: Pedido): Promise<void> {
    const sessao = await this.store.getSessao(pedido.eleitorId);
    if (!sessao) return;
    const voluntario = pedido.voluntarioId
      ? await this.store.getVoluntario(pedido.voluntarioId)
      : null;
    const avaliacao = await this.store.getAvaliacaoPorPedido(pedido.id);
    this.events.emit('pedido.atualizado', {
      eleitorId: pedido.eleitorId,
      view: toEleitorView(pedido, sessao, voluntario, !!avaliacao),
    });
  }

  private lockKey(pedidoId: string): string {
    return `leva:aceite:${pedidoId}`;
  }

  private enqueue(pedidoId: string, job: () => Promise<void>): Promise<void> {
    const previous = this.chains.get(pedidoId) ?? Promise.resolve();
    const next = previous.catch(() => undefined).then(job);
    this.chains.set(pedidoId, next);
    return next;
  }

  private enqueueResult<T>(pedidoId: string, job: () => Promise<T>): Promise<T> {
    let result!: T;
    return this.enqueue(pedidoId, async () => {
      result = await job();
    }).then(() => result);
  }
}
