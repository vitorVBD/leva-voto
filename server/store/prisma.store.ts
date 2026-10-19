import { Prisma, PrismaClient } from '@prisma/client';
import { SECOES } from '../data/secoes';
import { DomainError } from '../domain/errors';
import { normalizeNumero, normalizeText, onlyDigits } from '../domain/geo';
import { canTransition, isTerminal } from '../domain/state-machine';
import {
  Avaliacao,
  Candidato,
  DificuldadeLocomocao,
  EleitorSession,
  FaixaHorario,
  Oferta,
  OfertaStatus,
  OrderStatus,
  Pedido,
  Secao,
  TipoAjuda,
  TipoVeiculo,
  Voluntario,
} from '../domain/types';
import { DataStore, TransitionExtra } from './types';

type PedidoRow = Prisma.PedidoGetPayload<{ include: { eleitor: false } }>;
type VoluntarioRow = Prisma.VoluntarioGetPayload<Record<string, never>>;

const iso = (value: Date | null | undefined) => (value ? value.toISOString() : null);

function toPedido(row: PedidoRow): Pedido {
  const ponto =
    row.pontoLat != null && row.pontoLng != null && row.pontoEndereco && row.pontoBairro
      ? {
          lat: row.pontoLat,
          lng: row.pontoLng,
          endereco: row.pontoEndereco,
          bairro: row.pontoBairro,
        }
      : null;
  return {
    id: row.id,
    eleitorId: row.eleitorId,
    nomeEleitor: row.nomeEleitor,
    contatoEleitor: row.contatoEleitor,
    aceiteLgpd: row.aceiteLgpd,
    aceiteLgpdEm: row.aceiteLgpdEm.toISOString(),
    termoVersao: row.termoVersao,
    dificuldadesLocomocao: row.dificuldadesLocomocao as DificuldadeLocomocao[],
    tipoAjuda: row.tipoAjuda as TipoAjuda,
    status: row.status as OrderStatus,
    veiculoAceito: (row.veiculoAceito as TipoVeiculo | null) ?? null,
    faixaHorario: (row.faixaHorario as FaixaHorario | null) ?? null,
    pontoEncontro: ponto,
    voluntarioId: row.voluntarioId,
    raioAtualKm: row.raioAtualKm,
    wave: row.wave,
    expiraEm: iso(row.expiraEm),
    motivoCancelamento: row.motivoCancelamento,
    mobilidadeExpurgadaEm: iso(row.mobilidadeExpurgadaEm),
    dadosExpurgadosEm: iso(row.dadosExpurgadosEm),
    acessoHash: row.acessoHash,
    criadoEm: row.criadoEm.toISOString(),
    atualizadoEm: row.atualizadoEm.toISOString(),
  };
}

function toVoluntario(row: VoluntarioRow): Voluntario {
  return {
    id: row.id,
    nome: row.nome,
    cpf: row.cpf,
    telefone: row.telefone,
    email: row.email,
    telefoneConfirmado: row.telefoneConfirmado,
    termoCondutaAceito: row.termoCondutaAceito,
    termoCondutaEm: iso(row.termoCondutaEm),
    latitude: row.latitude,
    longitude: row.longitude,
    bairro: row.bairro,
    raioMaximoKm: row.raioMaximoKm,
    tiposAjudaOferecidos: row.tiposAjudaOferecidos as TipoAjuda[],
    ofereceCarona: row.ofereceCarona,
    tipoVeiculo: (row.tipoVeiculo as TipoVeiculo | null) ?? null,
    veiculoAdaptado: row.veiculoAdaptado,
    disponibilidadeHorarios: row.disponibilidadeHorarios as FaixaHorario[],
    statusAprovacao: row.statusAprovacao,
    ativo: row.ativo,
    notaMedia: row.notaMedia,
    totalAvaliacoes: row.totalAvaliacoes,
    acessoHash: row.acessoHash,
    criadoEm: row.criadoEm.toISOString(),
  };
}

function pedidoData(pedido: Pedido): Prisma.PedidoUncheckedCreateInput {
  return {
    id: pedido.id,
    eleitorId: pedido.eleitorId,
    nomeEleitor: pedido.nomeEleitor,
    contatoEleitor: pedido.contatoEleitor,
    aceiteLgpd: pedido.aceiteLgpd,
    aceiteLgpdEm: new Date(pedido.aceiteLgpdEm),
    termoVersao: pedido.termoVersao,
    dificuldadesLocomocao: pedido.dificuldadesLocomocao,
    tipoAjuda: pedido.tipoAjuda,
    status: pedido.status,
    veiculoAceito: pedido.veiculoAceito,
    faixaHorario: pedido.faixaHorario,
    pontoLat: pedido.pontoEncontro?.lat,
    pontoLng: pedido.pontoEncontro?.lng,
    pontoEndereco: pedido.pontoEncontro?.endereco,
    pontoBairro: pedido.pontoEncontro?.bairro,
    voluntarioId: pedido.voluntarioId,
    raioAtualKm: pedido.raioAtualKm,
    wave: pedido.wave,
    expiraEm: pedido.expiraEm ? new Date(pedido.expiraEm) : null,
    motivoCancelamento: pedido.motivoCancelamento,
    mobilidadeExpurgadaEm: pedido.mobilidadeExpurgadaEm
      ? new Date(pedido.mobilidadeExpurgadaEm)
      : null,
    dadosExpurgadosEm: pedido.dadosExpurgadosEm ? new Date(pedido.dadosExpurgadosEm) : null,
    acessoHash: pedido.acessoHash,
    criadoEm: new Date(pedido.criadoEm),
  };
}

export class PrismaStore implements DataStore {
  private readonly prisma = new PrismaClient();

  async ensureSecoes(secoes: Secao[] = SECOES): Promise<void> {
    const total = await this.prisma.secaoEleitoral.count();
    if (total > 0) return;
    await this.prisma.secaoEleitoral.createMany({
      data: secoes.map((secao) => ({
        id: secao.id,
        uf: secao.uf,
        municipio: secao.municipio,
        zona: secao.zona,
        secao: secao.secao,
        local: secao.local,
        endereco: secao.endereco,
        bairro: secao.bairro,
        latitude: secao.latitude,
        longitude: secao.longitude,
        acessibilidade: secao.acessibilidade,
      })),
    });
  }

  async buscarSecao(filtro: {
    uf: string;
    municipio: string;
    zona: string;
    secao: string;
  }): Promise<Secao | null> {
    const rows = await this.prisma.secaoEleitoral.findMany({
      where: { uf: filtro.uf.toUpperCase() },
    });
    const municipio = normalizeText(filtro.municipio);
    const zona = normalizeNumero(filtro.zona);
    const secao = normalizeNumero(filtro.secao);
    const found = rows.find(
      (item) =>
        normalizeText(item.municipio) === municipio &&
        normalizeNumero(item.zona) === zona &&
        normalizeNumero(item.secao) === secao,
    );
    return found ?? null;
  }

  async municipios(uf: string): Promise<string[]> {
    const rows = await this.prisma.secaoEleitoral.findMany({
      where: { uf: uf.toUpperCase() },
      select: { municipio: true },
      distinct: ['municipio'],
      orderBy: { municipio: 'asc' },
    });
    return rows.map((row) => row.municipio);
  }

  async saveSessao(sessao: EleitorSession): Promise<void> {
    await this.prisma.eleitorSession.create({
      data: {
        id: sessao.id,
        latitude: sessao.latitude,
        longitude: sessao.longitude,
        cep: sessao.cep,
        enderecoOrigem: sessao.enderecoOrigem,
        uf: sessao.uf,
        municipio: sessao.municipio,
        zona: sessao.zona,
        secao: sessao.secao,
        localVotacao: sessao.localVotacao,
        enderecoVotacao: sessao.enderecoVotacao,
        bairroVotacao: sessao.bairroVotacao,
        latitudeVotacao: sessao.latitudeVotacao,
        longitudeVotacao: sessao.longitudeVotacao,
        acessibilidade: sessao.acessibilidade,
        criadoEm: new Date(sessao.criadoEm),
      },
    });
  }

  async getSessao(id: string): Promise<EleitorSession | null> {
    const row = await this.prisma.eleitorSession.findUnique({ where: { id } });
    if (!row) return null;
    return {
      id: row.id,
      latitude: row.latitude,
      longitude: row.longitude,
      cep: row.cep,
      enderecoOrigem: row.enderecoOrigem,
      uf: row.uf,
      municipio: row.municipio,
      zona: row.zona,
      secao: row.secao,
      localVotacao: row.localVotacao,
      enderecoVotacao: row.enderecoVotacao,
      bairroVotacao: row.bairroVotacao,
      latitudeVotacao: row.latitudeVotacao,
      longitudeVotacao: row.longitudeVotacao,
      acessibilidade: row.acessibilidade,
      criadoEm: row.criadoEm.toISOString(),
    };
  }

  async savePedido(pedido: Pedido): Promise<void> {
    const data = pedidoData(pedido);
    await this.prisma.pedido.upsert({
      where: { id: pedido.id },
      create: data,
      update: data,
    });
  }

  async getPedido(id: string): Promise<Pedido | null> {
    const row = await this.prisma.pedido.findUnique({ where: { id } });
    return row ? toPedido(row) : null;
  }

  async listPedidosEmAberto(): Promise<Pedido[]> {
    const rows = await this.prisma.pedido.findMany({
      where: { status: { in: ['Buscando', 'SemVoluntario'] } },
    });
    return rows.map(toPedido);
  }

  async setExpiraEm(pedidoId: string, expiraEm: string): Promise<void> {
    await this.prisma.pedido.updateMany({
      where: { id: pedidoId, status: 'Buscando' },
      data: { expiraEm: new Date(expiraEm) },
    });
  }

  async setRaio(pedidoId: string, raioKm: number): Promise<void> {
    await this.prisma.pedido.updateMany({
      where: { id: pedidoId, status: 'Buscando' },
      data: { raioAtualKm: raioKm },
    });
  }

  async marcarAceito(pedidoId: string, voluntarioId: string): Promise<Pedido | null> {
    const updated = await this.prisma.pedido.updateMany({
      where: { id: pedidoId, status: 'Buscando' },
      data: { status: 'Aceito', voluntarioId, expiraEm: null },
    });
    if (updated.count !== 1) return null;
    return this.getPedido(pedidoId);
  }

  async transition(pedidoId: string, to: OrderStatus, extra?: TransitionExtra): Promise<Pedido> {
    const current = await this.getPedido(pedidoId);
    if (!current) throw new DomainError('Pedido não encontrado.', 'nao_encontrado', 404);
    if (!canTransition(current.status, to)) {
      throw new DomainError(
        `Não dá para mudar de ${current.status} para ${to}.`,
        'transicao_invalida',
        409,
      );
    }
    const wave = to === 'Buscando' && current.status === 'Aberto' ? 1 : (extra?.wave ?? current.wave);
    const updated = await this.prisma.pedido.updateMany({
      where: { id: pedidoId, status: current.status },
      data: {
        status: to,
        motivoCancelamento:
          extra?.motivo !== undefined ? extra.motivo : current.motivoCancelamento,
        voluntarioId: extra?.voluntarioId !== undefined ? extra.voluntarioId : current.voluntarioId,
        raioAtualKm: extra?.raioAtualKm ?? current.raioAtualKm,
        wave,
        expiraEm:
          extra?.expiraEm !== undefined
            ? extra.expiraEm
              ? new Date(extra.expiraEm)
              : null
            : current.expiraEm
              ? new Date(current.expiraEm)
              : null,
      },
    });
    if (updated.count !== 1) {
      throw new DomainError('O pedido mudou enquanto era atualizado.', 'conflito', 409);
    }
    return (await this.getPedido(pedidoId))!;
  }

  async findCandidatos(lat: number, lng: number, raioKm: number): Promise<Candidato[]> {
    const metros = raioKm * 1000;
    const rows = await this.prisma.$queryRaw<RawCandidato[]>`
      SELECT
        v.id,
        v.nome,
        v.cpf,
        v.telefone,
        v.email,
        v.telefone_confirmado,
        v.termo_conduta_aceito,
        v.termo_conduta_em,
        v.latitude,
        v.longitude,
        v.bairro,
        v.raio_maximo_km,
        v.tipos_ajuda_oferecidos,
        v.oferece_carona,
        v.tipo_veiculo,
        v.veiculo_adaptado,
        v.disponibilidade_horarios,
        v.status_aprovacao,
        v.ativo,
        v.nota_media,
        v.total_avaliacoes,
        v.acesso_hash,
        v.criado_em,
        ST_Distance(
          COALESCE(v.localizacao, ST_SetSRID(ST_MakePoint(v.longitude, v.latitude), 4326)::geography),
          ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
        ) / 1000 AS distancia_km
      FROM voluntarios v
      WHERE v.ativo = true
        AND v.status_aprovacao = 'aprovado'::"StatusAprovacao"
        AND v.telefone_confirmado = true
        AND v.termo_conduta_aceito = true
        AND ST_DWithin(
          COALESCE(v.localizacao, ST_SetSRID(ST_MakePoint(v.longitude, v.latitude), 4326)::geography),
          ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
          ${metros}
        )
      ORDER BY distancia_km ASC, v.nota_media DESC
    `;
    return rows.map((row) => ({
      id: row.id,
      nome: row.nome,
      cpf: row.cpf,
      telefone: row.telefone,
      email: row.email,
      telefoneConfirmado: row.telefone_confirmado,
      termoCondutaAceito: row.termo_conduta_aceito,
      termoCondutaEm: iso(row.termo_conduta_em),
      latitude: row.latitude,
      longitude: row.longitude,
      bairro: row.bairro,
      raioMaximoKm: row.raio_maximo_km,
      tiposAjudaOferecidos: row.tipos_ajuda_oferecidos,
      ofereceCarona: row.oferece_carona,
      tipoVeiculo: row.tipo_veiculo,
      veiculoAdaptado: row.veiculo_adaptado,
      disponibilidadeHorarios: row.disponibilidade_horarios,
      statusAprovacao: row.status_aprovacao,
      ativo: row.ativo,
      notaMedia: row.nota_media,
      totalAvaliacoes: row.total_avaliacoes,
      acessoHash: row.acesso_hash,
      criadoEm: row.criado_em.toISOString(),
      distanciaKm: Number(row.distancia_km),
    }));
  }

  async saveOferta(oferta: Oferta): Promise<void> {
    await this.prisma.oferta.create({
      data: {
        id: oferta.id,
        pedidoId: oferta.pedidoId,
        voluntarioId: oferta.voluntarioId,
        wave: oferta.wave,
        status: oferta.status,
        expiraEm: new Date(oferta.expiraEm),
        criadoEm: new Date(oferta.criadoEm),
      },
    });
  }

  async listOfertas(pedidoId: string): Promise<Oferta[]> {
    const rows = await this.prisma.oferta.findMany({ where: { pedidoId } });
    return rows.map(toOferta);
  }

  async listOfertasDoVoluntario(voluntarioId: string): Promise<Oferta[]> {
    const rows = await this.prisma.oferta.findMany({ where: { voluntarioId } });
    return rows.map(toOferta);
  }

  async getOfertaPendente(pedidoId: string, voluntarioId: string): Promise<Oferta | null> {
    const row = await this.prisma.oferta.findFirst({
      where: { pedidoId, voluntarioId, status: 'pendente' },
    });
    return row ? toOferta(row) : null;
  }

  async marcarOferta(id: string, status: OfertaStatus): Promise<void> {
    await this.prisma.oferta.update({ where: { id }, data: { status } });
  }

  async expirarOfertasDaOnda(pedidoId: string, wave: number): Promise<void> {
    await this.prisma.oferta.updateMany({
      where: { pedidoId, wave, status: 'pendente' },
      data: { status: 'expirada' },
    });
  }

  async saveVoluntario(voluntario: Voluntario): Promise<void> {
    const cpf = onlyDigits(voluntario.cpf);
    const telefone = onlyDigits(voluntario.telefone);
    const duplicado = await this.prisma.voluntario.findFirst({
      where: {
        id: { not: voluntario.id },
        OR: [{ cpf }, { telefone }],
      },
    });
    if (duplicado?.cpf === cpf) {
      throw new DomainError('Já existe cadastro com este CPF.', 'cpf_duplicado', 409);
    }
    if (duplicado) {
      throw new DomainError('Já existe cadastro com este telefone.', 'telefone_duplicado', 409);
    }
    const data = {
      nome: voluntario.nome,
      cpf,
      telefone,
      email: voluntario.email,
      telefoneConfirmado: voluntario.telefoneConfirmado,
      termoCondutaAceito: voluntario.termoCondutaAceito,
      termoCondutaEm: voluntario.termoCondutaEm ? new Date(voluntario.termoCondutaEm) : null,
      latitude: voluntario.latitude,
      longitude: voluntario.longitude,
      bairro: voluntario.bairro,
      raioMaximoKm: voluntario.raioMaximoKm,
      tiposAjudaOferecidos: voluntario.tiposAjudaOferecidos,
      ofereceCarona: voluntario.ofereceCarona,
      tipoVeiculo: voluntario.tipoVeiculo,
      veiculoAdaptado: voluntario.veiculoAdaptado,
      disponibilidadeHorarios: voluntario.disponibilidadeHorarios,
      statusAprovacao: voluntario.statusAprovacao,
      ativo: voluntario.ativo,
      notaMedia: voluntario.notaMedia,
      totalAvaliacoes: voluntario.totalAvaliacoes,
      acessoHash: voluntario.acessoHash,
    };
    await this.prisma.voluntario.upsert({
      where: { id: voluntario.id },
      create: { id: voluntario.id, ...data, criadoEm: new Date(voluntario.criadoEm) },
      update: data,
    });
    await this.prisma.$executeRaw`
      UPDATE voluntarios
      SET localizacao = ST_SetSRID(ST_MakePoint(${voluntario.longitude}, ${voluntario.latitude}), 4326)::geography
      WHERE id = ${voluntario.id}::uuid
    `;
  }

  async getVoluntario(id: string): Promise<Voluntario | null> {
    const row = await this.prisma.voluntario.findUnique({ where: { id } });
    return row ? toVoluntario(row) : null;
  }

  async getVoluntarioPorCpf(cpf: string): Promise<Voluntario | null> {
    const row = await this.prisma.voluntario.findUnique({ where: { cpf: onlyDigits(cpf) } });
    return row ? toVoluntario(row) : null;
  }

  async getVoluntarioPorTelefone(telefone: string): Promise<Voluntario | null> {
    const row = await this.prisma.voluntario.findUnique({
      where: { telefone: onlyDigits(telefone) },
    });
    return row ? toVoluntario(row) : null;
  }

  async listVoluntarios(): Promise<Voluntario[]> {
    const rows = await this.prisma.voluntario.findMany({ orderBy: { criadoEm: 'desc' } });
    return rows.map(toVoluntario);
  }

  async saveCodigo(telefone: string, hash: string, expiraEm: string): Promise<void> {
    const key = onlyDigits(telefone);
    await this.prisma.codigoTelefone.upsert({
      where: { telefone: key },
      create: { telefone: key, hash, expiraEm: new Date(expiraEm) },
      update: { hash, expiraEm: new Date(expiraEm) },
    });
  }

  async getCodigo(telefone: string): Promise<{ hash: string; expiraEm: string } | null> {
    const row = await this.prisma.codigoTelefone.findUnique({
      where: { telefone: onlyDigits(telefone) },
    });
    if (!row || !row.hash) return null;
    return { hash: row.hash, expiraEm: row.expiraEm.toISOString() };
  }

  async consumirCodigo(telefone: string): Promise<void> {
    await this.prisma.codigoTelefone.updateMany({
      where: { telefone: onlyDigits(telefone) },
      data: { hash: '', expiraEm: new Date(0) },
    });
  }

  async marcarTelefoneConfirmado(telefone: string, ate: string): Promise<void> {
    const key = onlyDigits(telefone);
    await this.prisma.codigoTelefone.upsert({
      where: { telefone: key },
      create: { telefone: key, hash: '', expiraEm: new Date(0), confirmadoAte: new Date(ate) },
      update: { hash: '', expiraEm: new Date(0), confirmadoAte: new Date(ate) },
    });
  }

  async telefoneConfirmadoRecentemente(telefone: string, agora = new Date()): Promise<boolean> {
    const row = await this.prisma.codigoTelefone.findUnique({
      where: { telefone: onlyDigits(telefone) },
    });
    return !!row?.confirmadoAte && row.confirmadoAte > agora;
  }

  async saveAvaliacao(avaliacao: Avaliacao): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.avaliacao.create({
        data: {
          id: avaliacao.id,
          pedidoId: avaliacao.pedidoId,
          voluntarioId: avaliacao.voluntarioId,
          nota: avaliacao.nota,
          comentario: avaliacao.comentario,
          criadoEm: new Date(avaliacao.criadoEm),
        },
      });
      const voluntario = await tx.voluntario.findUnique({ where: { id: avaliacao.voluntarioId } });
      if (!voluntario) return;
      const total = voluntario.totalAvaliacoes + 1;
      await tx.voluntario.update({
        where: { id: voluntario.id },
        data: {
          totalAvaliacoes: total,
          notaMedia: (voluntario.notaMedia * voluntario.totalAvaliacoes + avaliacao.nota) / total,
        },
      });
    });
  }

  async getAvaliacaoPorPedido(pedidoId: string): Promise<Avaliacao | null> {
    const row = await this.prisma.avaliacao.findUnique({ where: { pedidoId } });
    if (!row) return null;
    return {
      id: row.id,
      pedidoId: row.pedidoId,
      voluntarioId: row.voluntarioId,
      nota: row.nota,
      comentario: row.comentario,
      criadoEm: row.criadoEm.toISOString(),
    };
  }

  async expurgarMobilidade(corte: Date): Promise<number> {
    const rows = await this.prisma.pedido.findMany({
      where: {
        mobilidadeExpurgadaEm: null,
        status: { in: ['Concluido', 'Cancelado', 'SemVoluntario'] },
        atualizadoEm: { lte: corte },
      },
    });
    const alvos = rows.filter((row) => isTerminal(row.status as OrderStatus));
    if (alvos.length === 0) return 0;
    await this.prisma.pedido.updateMany({
      where: { id: { in: alvos.map((row) => row.id) } },
      data: { dificuldadesLocomocao: [], mobilidadeExpurgadaEm: new Date() },
    });
    return alvos.length;
  }

  async expurgarDadosPessoais(corte: Date): Promise<number> {
    const result = await this.prisma.pedido.updateMany({
      where: {
        dadosExpurgadosEm: null,
        status: { in: ['Concluido', 'Cancelado', 'SemVoluntario'] },
        atualizadoEm: { lte: corte },
      },
      data: {
        nomeEleitor: 'expurgado',
        contatoEleitor: '',
        pontoEndereco: 'expurgado',
        pontoLat: 0,
        pontoLng: 0,
        dadosExpurgadosEm: new Date(),
      },
    });
    return result.count;
  }
}

type RawCandidato = {
  id: string;
  nome: string;
  cpf: string;
  telefone: string;
  email: string;
  telefone_confirmado: boolean;
  termo_conduta_aceito: boolean;
  termo_conduta_em: Date | null;
  latitude: number;
  longitude: number;
  bairro: string | null;
  raio_maximo_km: number;
  tipos_ajuda_oferecidos: TipoAjuda[];
  oferece_carona: boolean;
  tipo_veiculo: TipoVeiculo | null;
  veiculo_adaptado: boolean;
  disponibilidade_horarios: FaixaHorario[];
  status_aprovacao: Voluntario['statusAprovacao'];
  ativo: boolean;
  nota_media: number;
  total_avaliacoes: number;
  acesso_hash: string;
  criado_em: Date;
  distancia_km: number;
};

function toOferta(row: {
  id: string;
  pedidoId: string;
  voluntarioId: string;
  wave: number;
  status: OfertaStatus;
  expiraEm: Date;
  criadoEm: Date;
}): Oferta {
  return {
    id: row.id,
    pedidoId: row.pedidoId,
    voluntarioId: row.voluntarioId,
    wave: row.wave,
    status: row.status,
    expiraEm: row.expiraEm.toISOString(),
    criadoEm: row.criadoEm.toISOString(),
  };
}
