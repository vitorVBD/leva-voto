import { randomUUID } from "crypto";
import { z } from "zod";
import { AppConfig } from "../config";
import { listarMunicipiosIbge } from "../data/ibge";
import { buscarSecaoOficial, centroideCarregado } from "../data/locais-tse";
import { centroideDe } from "../data/secoes";
import { treDe } from "../data/tre";
import { DomainError } from "../domain/errors";
import { cpfValido, onlyDigits } from "../domain/geo";
import { toAtendimento, toEleitorView, toPreview } from "../domain/redact";
import { validarNovoPedido } from "../domain/rules";
import { hashAcesso, novoSegredo, segredoConfere, tokenConfere } from "../domain/segredo";
import { TERMO_CONDUTA, TERMO_USO } from "../domain/termos";
import {
  DIFICULDADES,
  EleitorSession,
  FAIXAS_HORARIO,
  Pedido,
  PedidoPreview,
  TIPOS_AJUDA,
  TIPOS_VEICULO,
} from "../domain/types";
import { DomainEvents } from "../infra/events";
import { expurgarDadosDeMobilidade, expurgarIdentificacaoDoEleitor } from "../lgpd/purge";
import { MatchingEngine } from "../matching/engine";
import { DataStore } from "../store/types";
import { HttpError } from "./errors";

const secaoSchema = z.object({
  uf: z.string().trim().length(2),
  municipio: z.string().trim().min(2),
  zona: z.string().trim().min(1),
  secao: z.string().trim().min(1),
});

const pontoSchema = z.object({
  lat: z.number().gte(-90).lte(90),
  lng: z.number().gte(-180).lte(180),
  endereco: z.string().trim().min(3),
  bairro: z.string().trim().min(2),
});

const criarPedidoSchema = z.object({
  uf: z.string().trim().length(2),
  municipio: z.string().trim().min(2),
  zona: z.string().trim().min(1),
  secao: z.string().trim().min(1),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  cep: z.string().nullable(),
  enderecoOrigem: z.string().nullable(),
  nomeEleitor: z.string().trim().min(3),
  contatoEleitor: z.string().trim().min(8),
  aceiteLgpd: z.literal(true),
  termoVersao: z.string(),
  dificuldadesLocomocao: z.array(z.enum(DIFICULDADES)),
  tipoAjuda: z.enum(TIPOS_AJUDA),
  veiculoAceito: z.enum(TIPOS_VEICULO).nullable(),
  faixaHorario: z.enum(FAIXAS_HORARIO),
  pontoEncontro: pontoSchema,
});

const voluntarioSchema = z.object({
  nome: z.string().trim().min(3),
  cpf: z.string().trim(),
  telefone: z.string().trim(),
  email: z.string().trim().regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/),
  termoCondutaAceito: z.literal(true),
  termoVersao: z.string(),
  latitude: z.number().gte(-90).lte(90),
  longitude: z.number().gte(-180).lte(180),
  bairro: z.string().trim().min(2).nullable(),
  raioMaximoKm: z.number().gt(0).lte(30),
  tiposAjudaOferecidos: z.array(z.enum(TIPOS_AJUDA)).min(1),
  ofereceCarona: z.boolean(),
  tipoVeiculo: z.enum(TIPOS_VEICULO).nullable(),
  veiculoAdaptado: z.boolean(),
  disponibilidadeHorarios: z.array(z.enum(FAIXAS_HORARIO)).min(1),
});

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new HttpError(result.error.issues[0]?.message ?? "Dados inválidos.", 400);
  }
  return result.data;
}

function raise(error: unknown): never {
  if (error instanceof DomainError) throw new HttpError(error.message, error.status);
  throw error;
}

export class Api {
  private readonly avisos = new Map<string, string>();

  constructor(
    private readonly store: DataStore,
    private readonly config: AppConfig,
    private readonly matching: MatchingEngine,
  ) {}

  observar(events: DomainEvents): void {
    events.on("chamado.perdido", (payload) => {
      this.avisos.set(payload.voluntarioId, payload.mensagem);
    });
  }

  async dispatch(
    method: string,
    parts: string[],
    headers: Headers,
    query: URLSearchParams,
    body: unknown,
  ): Promise<unknown> {
    const acesso = headers.get("x-acesso") ?? undefined;
    const admin = headers.get("x-admin-token") ?? undefined;
    const [a, b, c, d, e] = parts;

    if (method === "GET" && a === "health" && !b) return this.health();
    if (method === "GET" && a === "config" && !b) return this.getConfig();
    if (method === "GET" && a === "termos" && !b) return { uso: TERMO_USO, conduta: TERMO_CONDUTA };
    if (method === "GET" && a === "secoes" && b === "municipios" && !c) return this.municipios(query.get("uf") ?? "");
    if (method === "GET" && a === "secoes" && !b) return this.buscarSecao(Object.fromEntries(query.entries()));
    if (method === "GET" && a === "cep" && b && !c) return this.cep(b);
    if (method === "POST" && a === "pedidos" && !b) return this.criarPedido(body);
    if (method === "GET" && a === "pedidos" && b && !c) return this.getPedido(b, acesso);
    if (method === "POST" && a === "pedidos" && c === "cancelar" && !d) return this.cancelarPedido(b, acesso);
    if (method === "POST" && a === "pedidos" && c === "avaliacao" && !d) return this.avaliar(b, acesso, body);
    if (method === "POST" && a === "voluntarios" && !b) return this.criarVoluntario(body);
    if (method === "GET" && a === "voluntarios" && b && !c) return this.getVoluntario(b, acesso);
    if (method === "GET" && a === "voluntarios" && c === "chamados" && !d) return this.chamados(b, acesso);
    if (method === "POST" && a === "voluntarios" && c === "chamados" && e === "aceitar") return this.aceitar(b, d, acesso);
    if (method === "POST" && a === "voluntarios" && c === "chamados" && e === "recusar") return this.recusar(b, d, acesso);
    if (method === "POST" && a === "voluntarios" && c === "atendimentos" && e === "iniciar") return this.iniciar(b, d, acesso);
    if (method === "POST" && a === "voluntarios" && c === "atendimentos" && e === "concluir") return this.concluir(b, d, acesso);
    if (method === "POST" && a === "voluntarios" && c === "atendimentos" && e === "cancelar") {
      return this.cancelarAtendimento(b, d, acesso, body);
    }
    if (method === "GET" && a === "admin" && b === "voluntarios" && !c) return this.adminList(admin);
    if (method === "POST" && a === "admin" && b === "voluntarios" && d === "aprovacao") return this.aprovar(admin, c, body);
    if (method === "POST" && a === "admin" && b === "lgpd" && c === "expurgo" && !d) return this.expurgo(admin, body);
    throw new HttpError("Endereço não encontrado.", 404);
  }

  health() {
    const postgres = Boolean(this.config.databaseUrl);
    if (process.env.NODE_ENV === "production" && !postgres) {
      throw new HttpError("Persistência obrigatória não está configurada.", 503);
    }
    return {
      ok: true,
      storage: postgres ? "postgres" : "memory",
      enableRideFeature: this.config.enableRideFeature,
    };
  }

  getConfig() {
    return {
      enableRideFeature: this.config.enableRideFeature,
      electionAt: this.config.electionAt,
      electionEnd: this.config.electionEnd,
      tseUrl: this.config.tseUrl,
      acceptTimeoutMs: this.config.acceptTimeoutMs,
      initialRadiusKm: this.config.initialRadiusKm,
      maxRadiusKm: this.config.maxRadiusKm,
      termoVersao: this.config.termoVersao,
      termoCondutaVersao: this.config.termoCondutaVersao,
    };
  }

  private async resolverSecao(filtro: { uf: string; municipio: string; zona: string; secao: string }) {
    try {
      const secao = await buscarSecaoOficial(filtro);
      if (!secao) {
        throw new HttpError(
          `Não encontramos a seção ${filtro.secao} da zona ${filtro.zona} em ${filtro.municipio}/${filtro.uf.toUpperCase()} na base aberta do TSE. Confira os números ou consulte o TSE.`,
          404,
        );
      }
      return { secao, fonte: "tse" as const };
    } catch (error) {
      if (error instanceof HttpError && error.status === 404) throw error;
      const demonstracao = await this.store.buscarSecao(filtro);
      if (demonstracao) return { secao: demonstracao, fonte: "demonstracao" as const };
      throw new HttpError("Não foi possível consultar a base de locais do TSE agora. Tente de novo em instantes.", 503);
    }
  }

  async municipios(uf: string) {
    if (uf.trim().length !== 2) throw new HttpError("Informe a UF.", 400);
    try {
      return await listarMunicipiosIbge(uf);
    } catch {
      return this.store.municipios(uf);
    }
  }

  async buscarSecao(query: Record<string, string>) {
    const filtro = parse(secaoSchema, query);
    const { secao, fonte } = await this.resolverSecao(filtro);
    return {
      ...secao,
      tre: treDe(secao.uf),
      aviso:
        fonte === "tse"
          ? "Local publicado na base aberta do TSE (eleitorado 2026). Confira também no dia da votação."
          : "Base de demonstração. Confirme o local no TSE.",
    };
  }

  async cep(cep: string) {
    const digits = onlyDigits(cep);
    if (digits.length !== 8) throw new HttpError("CEP precisa ter 8 dígitos.", 400);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`, {
        signal: AbortSignal.timeout(4000),
      });
      if (!response.ok) throw new Error("viacep");
      const data = (await response.json()) as {
        erro?: boolean;
        logradouro?: string;
        bairro?: string;
        localidade?: string;
        uf?: string;
      };
      if (data.erro || !data.localidade || !data.uf) {
        throw new HttpError("CEP não encontrado. Digite o endereço.", 404);
      }
      const centro = centroideCarregado(data.uf, data.localidade) ?? centroideDe(data.uf, data.localidade);
      const endereco = [data.logradouro, data.bairro, data.localidade, data.uf].filter(Boolean).join(", ");
      return {
        cep: digits,
        endereco,
        bairro: data.bairro || data.localidade,
        municipio: data.localidade,
        uf: data.uf,
        latitude: centro?.lat ?? null,
        longitude: centro?.lng ?? null,
        aproximado: Boolean(centro),
      };
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError("Não foi possível consultar o CEP. Digite o endereço.", 404);
    }
  }

  async criarPedido(body: unknown) {
    const input = parse(criarPedidoSchema, body);
    const erro = validarNovoPedido(input, this.config);
    if (erro) throw new HttpError(erro, 400);
    if (input.tipoAjuda === "orientacao_detalhada") {
      throw new HttpError("Orientação detalhada não abre pedido de voluntário.", 400);
    }
    const { secao } = await this.resolverSecao(input);
    const agora = new Date().toISOString();
    const segredo = novoSegredo();
    const sessao: EleitorSession = {
      id: randomUUID(),
      latitude: input.latitude,
      longitude: input.longitude,
      cep: input.cep,
      enderecoOrigem: input.enderecoOrigem,
      uf: secao.uf,
      municipio: secao.municipio,
      zona: secao.zona,
      secao: secao.secao,
      localVotacao: secao.local,
      enderecoVotacao: secao.endereco,
      bairroVotacao: secao.bairro,
      latitudeVotacao: secao.latitude,
      longitudeVotacao: secao.longitude,
      acessibilidade: secao.acessibilidade,
      criadoEm: agora,
    };
    const pedido: Pedido = {
      id: randomUUID(),
      eleitorId: sessao.id,
      nomeEleitor: input.nomeEleitor,
      contatoEleitor: onlyDigits(input.contatoEleitor),
      aceiteLgpd: true,
      aceiteLgpdEm: agora,
      termoVersao: input.termoVersao,
      dificuldadesLocomocao: input.dificuldadesLocomocao,
      tipoAjuda: input.tipoAjuda,
      status: "Aberto",
      veiculoAceito: input.veiculoAceito,
      faixaHorario: input.faixaHorario,
      pontoEncontro: input.pontoEncontro,
      voluntarioId: null,
      raioAtualKm: this.config.initialRadiusKm,
      wave: 0,
      expiraEm: null,
      motivoCancelamento: null,
      mobilidadeExpurgadaEm: null,
      dadosExpurgadosEm: null,
      acessoHash: hashAcesso(segredo),
      criadoEm: agora,
      atualizadoEm: agora,
    };
    await this.store.saveSessao(sessao);
    await this.store.savePedido(pedido);
    try {
      await this.matching.abrir(pedido.id);
    } catch (error) {
      raise(error);
    }
    return { ...(await this.view(pedido.id)), segredo };
  }

  async getPedido(id: string, acesso?: string) {
    await this.exigirPedido(id, acesso);
    return this.view(id);
  }

  async cancelarPedido(id: string, acesso?: string) {
    await this.exigirPedido(id, acesso);
    try {
      await this.matching.cancelarPedido(id);
    } catch (error) {
      raise(error);
    }
    return this.view(id);
  }

  async avaliar(id: string, acesso: string | undefined, body: unknown) {
    await this.exigirPedido(id, acesso);
    const input = parse(
      z.object({
        nota: z.number().int().min(1).max(5),
        comentario: z.string().trim().max(400).nullable(),
      }),
      body,
    );
    const pedido = await this.store.getPedido(id);
    if (!pedido) throw new HttpError("Pedido não encontrado.", 404);
    if (pedido.status !== "Concluido" || !pedido.voluntarioId) {
      throw new HttpError("A avaliação abre quando o atendimento termina.", 400);
    }
    if (await this.store.getAvaliacaoPorPedido(id)) {
      throw new HttpError("Este pedido já foi avaliado.", 400);
    }
    await this.store.saveAvaliacao({
      id: randomUUID(),
      pedidoId: id,
      voluntarioId: pedido.voluntarioId,
      nota: input.nota,
      comentario: input.comentario,
      criadoEm: new Date().toISOString(),
    });
    return this.view(id);
  }

  async criarVoluntario(body: unknown) {
    const input = parse(voluntarioSchema, body);
    if (!cpfValido(input.cpf)) throw new HttpError("CPF inválido.", 400);
    if (onlyDigits(input.telefone).length !== 11) throw new HttpError("Informe um celular com DDD.", 400);
    if (input.termoVersao !== this.config.termoCondutaVersao) {
      throw new HttpError("O termo de conduta foi atualizado. Leia de novo.", 400);
    }
    if (input.ofereceCarona && !input.tipoVeiculo) throw new HttpError("Informe o tipo de veículo.", 400);
    const tiposAjuda = input.ofereceCarona
      ? [...new Set([...input.tiposAjudaOferecidos, "carona" as const])]
      : input.tiposAjudaOferecidos.filter((tipo) => tipo !== "carona");
    if (tiposAjuda.length === 0) throw new HttpError("Escolha ao menos um tipo de ajuda.", 400);
    const agora = new Date().toISOString();
    const id = randomUUID();
    const segredo = novoSegredo();
    try {
      await this.store.saveVoluntario({
        id,
        nome: input.nome,
        cpf: onlyDigits(input.cpf),
        telefone: onlyDigits(input.telefone),
        email: input.email,
        telefoneConfirmado: true,
        termoCondutaAceito: true,
        termoCondutaEm: agora,
        latitude: input.latitude,
        longitude: input.longitude,
        bairro: input.bairro,
        raioMaximoKm: input.raioMaximoKm,
        tiposAjudaOferecidos: tiposAjuda,
        ofereceCarona: input.ofereceCarona,
        tipoVeiculo: input.ofereceCarona ? input.tipoVeiculo : null,
        veiculoAdaptado: input.veiculoAdaptado,
        disponibilidadeHorarios: input.disponibilidadeHorarios,
        statusAprovacao: "pendente",
        ativo: false,
        notaMedia: 0,
        totalAvaliacoes: 0,
        acessoHash: hashAcesso(segredo),
        criadoEm: agora,
      });
    } catch (error) {
      raise(error);
    }
    return { id, segredo, statusAprovacao: "pendente" as const };
  }

  async getVoluntario(id: string, acesso?: string) {
    return resumoVoluntario(await this.exigirVoluntario(id, acesso));
  }

  async chamados(id: string, acesso?: string) {
    const voluntario = await this.exigirVoluntario(id, acesso);
    const aviso = this.avisos.get(id) ?? null;
    if (aviso) this.avisos.delete(id);
    if (voluntario.statusAprovacao !== "aprovado" || !voluntario.ativo) {
      return { chamados: [], atendimento: null, aviso };
    }
    const ofertas = await this.store.listOfertasDoVoluntario(id);
    const chamados: PedidoPreview[] = [];
    for (const oferta of ofertas.filter((item) => item.status === "pendente")) {
      const pedido = await this.store.getPedido(oferta.pedidoId);
      if (pedido?.status === "Buscando") chamados.push(toPreview(pedido));
    }
    return { chamados, atendimento: await this.atendimentoAtual(id), aviso };
  }

  async aceitar(id: string, pedidoId: string, acesso?: string) {
    await this.exigirVoluntario(id, acesso);
    const resultado = await this.matching.aceitar(pedidoId, id);
    if (!resultado.ok) {
      throw new HttpError(
        resultado.motivo === "ja_atendido"
          ? "Outra pessoa aceitou este pedido primeiro. Obrigado por se dispor."
          : "Este chamado não está mais disponível.",
        409,
      );
    }
    return resultado.atendimento;
  }

  async recusar(id: string, pedidoId: string, acesso?: string) {
    await this.exigirVoluntario(id, acesso);
    await this.matching.recusar(pedidoId, id);
    return { ok: true };
  }

  async iniciar(id: string, pedidoId: string, acesso?: string) {
    await this.exigirVoluntario(id, acesso);
    try {
      await this.matching.iniciar(pedidoId, id);
    } catch (error) {
      raise(error);
    }
    return this.atendimentoAtual(id);
  }

  async concluir(id: string, pedidoId: string, acesso?: string) {
    await this.exigirVoluntario(id, acesso);
    try {
      await this.matching.concluir(pedidoId, id);
    } catch (error) {
      raise(error);
    }
    return { ok: true };
  }

  async cancelarAtendimento(id: string, pedidoId: string, acesso: string | undefined, body: unknown) {
    await this.exigirVoluntario(id, acesso);
    const input = parse(z.object({ motivo: z.string().trim().min(3) }), body);
    try {
      await this.matching.cancelarAtendimento(pedidoId, id, input.motivo);
    } catch (error) {
      raise(error);
    }
    return { ok: true };
  }

  async adminList(token?: string) {
    this.assertAdmin(token);
    const lista = await this.store.listVoluntarios();
    return lista.map((voluntario) => ({
      ...resumoVoluntario(voluntario),
      cpf: voluntario.cpf,
      telefone: voluntario.telefone,
      email: voluntario.email,
      notaMedia: voluntario.notaMedia,
      totalAvaliacoes: voluntario.totalAvaliacoes,
    }));
  }

  async aprovar(token: string | undefined, id: string, body: unknown) {
    this.assertAdmin(token);
    const input = parse(z.object({ status: z.enum(["aprovado", "recusado"]) }), body);
    const voluntario = await this.store.getVoluntario(id);
    if (!voluntario) throw new HttpError("Voluntário não encontrado.", 404);
    voluntario.statusAprovacao = input.status;
    voluntario.ativo = input.status === "aprovado";
    try {
      await this.store.saveVoluntario(voluntario);
    } catch (error) {
      raise(error);
    }
    if (voluntario.ativo) await this.matching.incluirNovosVoluntarios();
    return resumoVoluntario(voluntario);
  }

  async expurgo(token: string | undefined, body: unknown) {
    this.assertAdmin(token);
    const input = parse(
      z.object({
        corte: z.string().optional(),
        pessoais: z.boolean().optional(),
      }),
      body ?? {},
    );
    const corte = input.corte ? new Date(input.corte) : new Date();
    if (Number.isNaN(corte.getTime())) throw new HttpError("Data de corte inválida.", 400);
    const mobilidade = await expurgarDadosDeMobilidade(this.store, corte);
    const pessoais = input.pessoais ? await expurgarIdentificacaoDoEleitor(this.store, corte) : 0;
    return { mobilidade, pessoais };
  }

  private assertAdmin(token?: string) {
    if (!tokenConfere(token, this.config.adminToken)) {
      throw new HttpError("Token de coordenação inválido.", 401);
    }
  }

  private async exigirPedido(id: string, acesso?: string) {
    const pedido = await this.store.getPedido(id);
    if (!pedido || !segredoConfere(acesso, pedido.acessoHash)) {
      throw new HttpError("Código de acesso inválido.", 401);
    }
    return pedido;
  }

  private async exigirVoluntario(id: string, acesso?: string) {
    const voluntario = await this.store.getVoluntario(id);
    if (!voluntario || !segredoConfere(acesso, voluntario.acessoHash)) {
      throw new HttpError("Código de acesso inválido.", 401);
    }
    return voluntario;
  }

  private async view(id: string) {
    const pedido = await this.store.getPedido(id);
    if (!pedido) throw new HttpError("Pedido não encontrado.", 404);
    const sessao = await this.store.getSessao(pedido.eleitorId);
    if (!sessao) throw new HttpError("Sessão não encontrada.", 404);
    const voluntario = pedido.voluntarioId ? await this.store.getVoluntario(pedido.voluntarioId) : null;
    const avaliacao = await this.store.getAvaliacaoPorPedido(id);
    return { ...toEleitorView(pedido, sessao, voluntario, !!avaliacao), eleitorId: pedido.eleitorId };
  }

  private async atendimentoAtual(voluntarioId: string) {
    const ofertas = await this.store.listOfertasDoVoluntario(voluntarioId);
    for (const oferta of ofertas) {
      if (oferta.status !== "aceita") continue;
      const pedido = await this.store.getPedido(oferta.pedidoId);
      if (
        pedido &&
        pedido.voluntarioId === voluntarioId &&
        (pedido.status === "Aceito" || pedido.status === "EmAndamento")
      ) {
        return toAtendimento(pedido);
      }
    }
    return null;
  }
}

function resumoVoluntario(voluntario: {
  id: string;
  nome: string;
  statusAprovacao: string;
  ativo: boolean;
  bairro: string | null;
  raioMaximoKm: number;
  tiposAjudaOferecidos: string[];
  ofereceCarona: boolean;
  tipoVeiculo: string | null;
  veiculoAdaptado: boolean;
  disponibilidadeHorarios: string[];
}) {
  return {
    id: voluntario.id,
    nome: voluntario.nome,
    statusAprovacao: voluntario.statusAprovacao,
    ativo: voluntario.ativo,
    bairro: voluntario.bairro,
    raioMaximoKm: voluntario.raioMaximoKm,
    tiposAjudaOferecidos: voluntario.tiposAjudaOferecidos,
    ofereceCarona: voluntario.ofereceCarona,
    tipoVeiculo: voluntario.tipoVeiculo,
    veiculoAdaptado: voluntario.veiculoAdaptado,
    disponibilidadeHorarios: voluntario.disponibilidadeHorarios,
  };
}
