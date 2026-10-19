import { assertTransition, canTransition } from './state-machine';

describe('máquina de estados do pedido', () => {
  it('abre a busca e aceita o primeiro voluntário', () => {
    expect(canTransition('Aberto', 'Buscando')).toBe(true);
    expect(canTransition('Buscando', 'Aceito')).toBe(true);
    expect(canTransition('Aceito', 'EmAndamento')).toBe(true);
    expect(canTransition('EmAndamento', 'Concluido')).toBe(true);
  });

  it('volta a procurar quando um voluntário novo é aprovado', () => {
    expect(canTransition('SemVoluntario', 'Buscando')).toBe(true);
  });

  it('reabre a fila quando o atendimento é cancelado', () => {
    expect(canTransition('Aceito', 'Buscando')).toBe(true);
    expect(canTransition('EmAndamento', 'Buscando')).toBe(true);
  });

  it('não pula etapas', () => {
    expect(canTransition('Aberto', 'Aceito')).toBe(false);
    expect(canTransition('Buscando', 'EmAndamento')).toBe(false);
    expect(canTransition('Concluido', 'Buscando')).toBe(false);
    expect(() => assertTransition('Cancelado', 'Aberto')).toThrow(/Transição inválida/);
  });
});
