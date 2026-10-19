import { OrderStatus } from './types';

const TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  Aberto: ['Buscando', 'Cancelado'],
  Buscando: ['Aceito', 'SemVoluntario', 'Cancelado'],
  SemVoluntario: ['Buscando', 'Cancelado'],
  Aceito: ['EmAndamento', 'Buscando', 'Cancelado'],
  EmAndamento: ['Concluido', 'Buscando', 'Cancelado'],
  Concluido: [],
  Cancelado: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function assertTransition(from: OrderStatus, to: OrderStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`Transição inválida: ${from} → ${to}`);
  }
}

export function isTerminal(status: OrderStatus): boolean {
  return status === 'Concluido' || status === 'Cancelado' || status === 'SemVoluntario';
}
