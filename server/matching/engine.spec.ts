import { randomUUID } from 'crypto';
import { previewNaoVazaContato } from '../domain/redact';
import { EleitorSession, Pedido, PedidoPreview, Voluntario } from '../domain/types';
import { DomainEvents } from '../infra/events';
import { MemoryLock } from '../infra/lock';
import { MemoryStore } from '../store/memory.store';
import { MatchingEngine } from './engine';

const PONTO = { lat: -23.5436, lng: -46.6427, endereco: 'Praça da República, 10', bairro: 'República' };

function sessao(id: string): EleitorSession {
  return {
    id,
    latitude: PONTO.lat,
    longitude: PONTO.lng,
    cep: null,
    enderecoOrigem: 'Praça da República, 10',
    uf: 'SP',
    municipio: 'São Paulo',
    zona: '1',
    secao: '1',
    localVotacao: 'Escola de Demonstração',
    enderecoVotacao: 'Praça da República, 100',
    bairroVotacao: 'República',
    latitudeVotacao: PONTO.lat,
    longitudeVotacao: PONTO.lng,
    acessibilidade: 'Rampa na entrada.',
    criadoEm: new Date().toISOString(),
  };
}

function pedido(eleitorId: string, extra: Partial<Pedido> = {}): Pedido {
  const agora = new Date().toISOString();
  return {
    id: randomUUID(),
    eleitorId,
    nomeEleitor: 'Ana Lima',
    contatoEleitor: '11999990000',
    aceiteLgpd: true,
    aceiteLgpdEm: agora,
    termoVersao: '2026-10-18',
    dificuldadesLocomocao: [],
    tipoAjuda: 'acompanhante_a_pe',
    status: 'Aberto',
    veiculoAceito: null,
    faixaHorario: 'manha',
    pontoEncontro: PONTO,
    voluntarioId: null,
    raioAtualKm: 2,
    wave: 0,
    expiraEm: null,
    motivoCancelamento: null,
    mobilidadeExpurgadaEm: null,
    dadosExpurgadosEm: null,
    acessoHash: 'hash',
    criadoEm: agora,
    atualizadoEm: agora,
    ...extra,
  };
}

function voluntario(lat: number, extra: Partial<Voluntario> = {}): Voluntario {
  return {
    id: randomUUID(),
    nome: extra.nome ?? 'Bruno Souza',
    cpf: extra.cpf ?? `${Math.floor(Math.random() * 1e11)}`.padStart(11, '1'),
    telefone: extra.telefone ?? `11${Math.floor(900000000 + Math.random() * 9999999)}`,
    email: 'bruno@example.com',
    telefoneConfirmado: true,
    termoCondutaAceito: true,
    termoCondutaEm: new Date().toISOString(),
    latitude: lat,
    longitude: PONTO.lng,
    bairro: 'República',
    raioMaximoKm: 8,
    tiposAjudaOferecidos: ['acompanhante_a_pe', 'carona'],
    ofereceCarona: true,
    tipoVeiculo: 'carro',
    veiculoAdaptado: false,
    disponibilidadeHorarios: ['manha', 'tarde', 'fim_de_tarde'],
    statusAprovacao: 'aprovado',
    ativo: true,
    notaMedia: extra.notaMedia ?? 4,
    totalAvaliacoes: 2,
    acessoHash: 'hash',
    criadoEm: new Date().toISOString(),
    ...extra,
  };
}

function setup() {
  const store = new MemoryStore([]);
  const events = new DomainEvents();
  const jobs: { pedidoId: string; wave: number }[] = [];
  const previews: PedidoPreview[] = [];
  events.on('chamado.novo', (payload) => previews.push(payload.preview));
  const engine = new MatchingEngine(store, new MemoryLock(), events, {
    acceptTimeoutMs: 120_000,
    radiusStepKm: 2,
    maxRadiusKm: 6,
  });
  engine.setScheduler((pedidoId, wave) => jobs.push({ pedidoId, wave }));
  return { store, engine, events, jobs, previews };
}

describe('motor de pareamento', () => {
  it('o primeiro aceite leva o pedido e o segundo recebe aviso amigável', async () => {
    const { store, engine, previews } = setup();
    const eleitorId = randomUUID();
    await store.saveSessao(sessao(eleitorId));
    const item = pedido(eleitorId);
    await store.savePedido(item);
    const pertoA = voluntario(PONTO.lat, { nome: 'Ana Voluntária', notaMedia: 5 });
    const pertoB = voluntario(PONTO.lat + 0.004, { nome: 'Bia Voluntária', notaMedia: 3 });
    await store.saveVoluntario(pertoA);
    await store.saveVoluntario(pertoB);

    await engine.abrir(item.id);
    expect(previews).toHaveLength(2);
    expect(previews.every(previewNaoVazaContato)).toBe(true);
    expect(JSON.stringify(previews)).not.toContain('11999990000');
    expect(JSON.stringify(previews)).not.toContain('Praça da República');

    const [primeiro, segundo] = await Promise.all([
      engine.aceitar(item.id, pertoA.id),
      engine.aceitar(item.id, pertoB.id),
    ]);
    const resultados = [primeiro, segundo];
    expect(resultados.filter((item) => item.ok)).toHaveLength(1);
    expect(resultados.filter((item) => !item.ok && item.motivo === 'ja_atendido')).toHaveLength(1);
    const vencedor = resultados.find((item) => item.ok);
    expect(vencedor && vencedor.ok && vencedor.atendimento.contatoEleitor).toBe('11999990000');
    expect((await store.getPedido(item.id))?.status).toBe('Aceito');
  });

  it('aumenta o raio e desiste quando ninguém cabe no máximo', async () => {
    const { store, engine, jobs } = setup();
    const eleitorId = randomUUID();
    await store.saveSessao(sessao(eleitorId));
    const item = pedido(eleitorId);
    await store.savePedido(item);
    await engine.abrir(item.id);
    expect(jobs).toHaveLength(0);
    expect((await store.getPedido(item.id))?.status).toBe('SemVoluntario');
  });

  it('chama quem está mais longe só depois de alargar a busca', async () => {
    const { store, engine, previews } = setup();
    const eleitorId = randomUUID();
    await store.saveSessao(sessao(eleitorId));
    const item = pedido(eleitorId);
    await store.savePedido(item);
    const longe = voluntario(PONTO.lat + 0.045, { nome: 'Caio Longe' });
    await store.saveVoluntario(longe);
    await engine.abrir(item.id);
    expect(previews.map((preview) => preview.bairro)).toEqual(['República']);
    expect((await store.getPedido(item.id))?.raioAtualKm).toBeGreaterThan(2);
    expect((await store.getPedido(item.id))?.status).toBe('Buscando');
  });

  it('não oferece moto para quem usa cadeira de rodas', async () => {
    const { store, engine, previews } = setup();
    const eleitorId = randomUUID();
    await store.saveSessao(sessao(eleitorId));
    const item = pedido(eleitorId, {
      tipoAjuda: 'carona',
      dificuldadesLocomocao: ['cadeira_de_rodas'],
      veiculoAceito: 'carro',
    });
    await store.savePedido(item);
    await store.saveVoluntario(
      voluntario(PONTO.lat, { tipoVeiculo: 'moto', veiculoAdaptado: false, nome: 'Moto' }),
    );
    await engine.abrir(item.id);
    expect(previews).toHaveLength(0);
    expect((await store.getPedido(item.id))?.status).toBe('SemVoluntario');
  });
});
