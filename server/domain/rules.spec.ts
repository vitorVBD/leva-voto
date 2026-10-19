import { loadConfig } from '../config';
import { Pedido, Voluntario } from './types';
import {
  motoPermitida,
  tiposAjudaDisponiveis,
  validarNovoPedido,
  voluntarioCompativel,
} from './rules';

function pedido(extra: Partial<Pedido> = {}): Pedido {
  return {
    id: 'p',
    eleitorId: 'e',
    nomeEleitor: 'Ana',
    contatoEleitor: '11999999999',
    aceiteLgpd: true,
    aceiteLgpdEm: new Date().toISOString(),
    termoVersao: '2026-10-18',
    dificuldadesLocomocao: [],
    tipoAjuda: 'acompanhante_a_pe',
    status: 'Buscando',
    veiculoAceito: null,
    faixaHorario: 'manha',
    pontoEncontro: { lat: 0, lng: 0, endereco: 'Rua A', bairro: 'Centro' },
    voluntarioId: null,
    raioAtualKm: 2,
    wave: 1,
    expiraEm: null,
    motivoCancelamento: null,
    mobilidadeExpurgadaEm: null,
    dadosExpurgadosEm: null,
    acessoHash: 'hash',
    criadoEm: new Date().toISOString(),
    atualizadoEm: new Date().toISOString(),
    ...extra,
  };
}

function voluntario(extra: Partial<Voluntario> & { distanciaKm?: number } = {}) {
  const { distanciaKm = 1, ...rest } = extra;
  return {
    id: 'v',
    nome: 'Bruno',
    cpf: '52998224725',
    telefone: '11988887777',
    email: 'bruno@example.com',
    telefoneConfirmado: true,
    termoCondutaAceito: true,
    termoCondutaEm: new Date().toISOString(),
    latitude: 0,
    longitude: 0,
    bairro: 'Centro',
    raioMaximoKm: 5,
    tiposAjudaOferecidos: ['acompanhante_a_pe' as const, 'carona' as const],
    ofereceCarona: true,
    tipoVeiculo: 'carro' as const,
    veiculoAdaptado: true,
    disponibilidadeHorarios: ['manha' as const],
    statusAprovacao: 'aprovado' as const,
    ativo: true,
    notaMedia: 5,
    totalAvaliacoes: 1,
    acessoHash: 'hash',
    criadoEm: new Date().toISOString(),
    ...rest,
    distanciaKm,
  };
}

describe('regras de ajuda', () => {
  const config = loadConfig({ ENABLE_RIDE_FEATURE: 'false', NODE_ENV: 'test' });

  it('desliga moto quando há qualquer dificuldade de locomoção', () => {
    expect(motoPermitida([])).toBe(true);
    expect(motoPermitida(['andador'])).toBe(false);
    expect(motoPermitida(['baixa_visao'])).toBe(false);
  });

  it('esconde carona quando a feature flag está desligada', () => {
    expect(tiposAjudaDisponiveis(false)).toEqual([
      'orientacao_detalhada',
      'acompanhante_a_pe',
    ]);
    expect(
      validarNovoPedido(
        {
          aceiteLgpd: true,
          termoVersao: config.termoVersao,
          dificuldadesLocomocao: [],
          tipoAjuda: 'carona',
          veiculoAceito: 'carro',
          faixaHorario: 'manha',
          nomeEleitor: 'Ana Lima',
          contatoEleitor: '11999999999',
        },
        config,
      ),
    ).toMatch(/Lei 6.091/);
  });

  it('não pareia moto nem carro sem adaptação para cadeira de rodas', () => {
    const comCadeira = pedido({
      tipoAjuda: 'carona',
      dificuldadesLocomocao: ['cadeira_de_rodas'],
      veiculoAceito: 'carro',
    });
    expect(voluntarioCompativel(comCadeira, voluntario({ tipoVeiculo: 'moto' }))).toBe(false);
    expect(voluntarioCompativel(comCadeira, voluntario({ veiculoAdaptado: false }))).toBe(false);
    expect(voluntarioCompativel(comCadeira, voluntario())).toBe(true);
  });

  it('exige o tipo de ajuda e a faixa de horário', () => {
    const aPe = pedido();
    expect(
      voluntarioCompativel(aPe, voluntario({ tiposAjudaOferecidos: ['carona'], distanciaKm: 1 })),
    ).toBe(false);
    expect(
      voluntarioCompativel(aPe, voluntario({ disponibilidadeHorarios: ['tarde'] })),
    ).toBe(false);
    expect(voluntarioCompativel(aPe, voluntario({ distanciaKm: 3 }))).toBe(false);
  });
});
