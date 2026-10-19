import { randomUUID } from 'crypto';
import { MemoryStore } from '../store/memory.store';
import { Pedido } from '../domain/types';
import { expurgarDadosDeMobilidade, expurgarIdentificacaoDoEleitor } from './purge';

function pedido(status: Pedido['status']): Pedido {
  const agora = new Date('2026-10-26T12:00:00.000Z').toISOString();
  return {
    id: randomUUID(),
    eleitorId: randomUUID(),
    nomeEleitor: 'Ana Lima',
    contatoEleitor: '11999999999',
    aceiteLgpd: true,
    aceiteLgpdEm: agora,
    termoVersao: '2026-10-18',
    dificuldadesLocomocao: ['cadeira_de_rodas'],
    tipoAjuda: 'acompanhante_a_pe',
    status,
    veiculoAceito: null,
    faixaHorario: 'manha',
    pontoEncontro: { lat: -23.5, lng: -46.6, endereco: 'Rua A, 10', bairro: 'Centro' },
    voluntarioId: null,
    raioAtualKm: 2,
    wave: 1,
    expiraEm: null,
    motivoCancelamento: null,
    mobilidadeExpurgadaEm: null,
    dadosExpurgadosEm: null,
    acessoHash: 'hash',
    criadoEm: agora,
    atualizadoEm: agora,
  };
}

describe('expurgo LGPD', () => {
  it('apaga a necessidade de locomoção só de pedidos já encerrados', async () => {
    const store = new MemoryStore([]);
    const encerrado = pedido('Concluido');
    const aberto = pedido('Buscando');
    await store.savePedido(encerrado);
    await store.savePedido(aberto);
    const quantidade = await expurgarDadosDeMobilidade(store, new Date('2026-10-27T00:00:00.000Z'));
    expect(quantidade).toBe(1);
    expect((await store.getPedido(encerrado.id))?.dificuldadesLocomocao).toEqual([]);
    expect((await store.getPedido(aberto.id))?.dificuldadesLocomocao).toEqual(['cadeira_de_rodas']);
  });

  it('anonimiza nome, contato e endereço depois da retenção', async () => {
    const store = new MemoryStore([]);
    const encerrado = pedido('Cancelado');
    await store.savePedido(encerrado);
    await expurgarIdentificacaoDoEleitor(store, new Date('2026-10-27T00:00:00.000Z'));
    const atual = await store.getPedido(encerrado.id);
    expect(atual?.nomeEleitor).toBe('expurgado');
    expect(atual?.contatoEleitor).toBe('');
    expect(atual?.pontoEncontro?.endereco).toBe('expurgado');
  });
});
