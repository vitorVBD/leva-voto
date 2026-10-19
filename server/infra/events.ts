import { EventEmitter } from 'events';
import { EleitorPedidoView, PedidoPreview } from '../domain/types';

export type DomainEventMap = {
  'chamado.novo': { voluntarioId: string; preview: PedidoPreview };
  'chamado.perdido': { voluntarioId: string; pedidoId: string; mensagem: string };
  'pedido.atualizado': { eleitorId: string; view: EleitorPedidoView };
};

export class DomainEvents {
  private readonly emitter = new EventEmitter();

  emit<K extends keyof DomainEventMap>(event: K, payload: DomainEventMap[K]): void {
    this.emitter.emit(event, payload);
  }

  on<K extends keyof DomainEventMap>(
    event: K,
    listener: (payload: DomainEventMap[K]) => void,
  ): void {
    this.emitter.on(event, listener);
  }
}
