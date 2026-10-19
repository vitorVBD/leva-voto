import { treDe } from '../data/tre';
import { whatsappLink } from './geo';
import {
  Atendimento,
  EleitorPedidoView,
  EleitorSession,
  Pedido,
  PedidoPreview,
  Voluntario,
} from './types';

const STATUS_COM_CONTATO = new Set(['Aceito', 'EmAndamento', 'Concluido']);

export function toPreview(pedido: Pedido): PedidoPreview {
  return {
    id: pedido.id,
    tipoAjuda: pedido.tipoAjuda,
    bairro: pedido.pontoEncontro?.bairro || 'Bairro não informado',
    faixaHorario: pedido.faixaHorario,
  };
}

export function toAtendimento(pedido: Pedido): Atendimento {
  if (!pedido.pontoEncontro) {
    throw new Error('Pedido sem ponto de encontro.');
  }
  return {
    ...toPreview(pedido),
    status: pedido.status,
    nomeEleitor: pedido.nomeEleitor,
    contatoEleitor: pedido.contatoEleitor,
    whatsappUrl: whatsappLink(pedido.contatoEleitor),
    pontoEncontro: pedido.pontoEncontro,
    dificuldadesLocomocao: pedido.dificuldadesLocomocao,
    veiculoAceito: pedido.veiculoAceito,
  };
}

export function toEleitorView(
  pedido: Pedido,
  sessao: EleitorSession,
  voluntario: Voluntario | null,
  avaliado: boolean,
): EleitorPedidoView {
  const revelar = STATUS_COM_CONTATO.has(pedido.status) && voluntario;
  return {
    id: pedido.id,
    status: pedido.status,
    tipoAjuda: pedido.tipoAjuda,
    faixaHorario: pedido.faixaHorario,
    bairro: pedido.pontoEncontro?.bairro ?? null,
    raioAtualKm: pedido.raioAtualKm,
    local: {
      nome: sessao.localVotacao,
      endereco: sessao.enderecoVotacao,
      bairro: sessao.bairroVotacao,
      latitude: sessao.latitudeVotacao,
      longitude: sessao.longitudeVotacao,
      acessibilidade: sessao.acessibilidade,
      uf: sessao.uf,
      municipio: sessao.municipio,
      zona: sessao.zona,
      secao: sessao.secao,
    },
    tre: treDe(sessao.uf),
    voluntario: revelar
      ? {
          nome: voluntario.nome,
          telefone: voluntario.telefone,
          whatsappUrl: whatsappLink(voluntario.telefone),
        }
      : null,
    avaliado,
  };
}

export function previewNaoVazaContato(preview: PedidoPreview): boolean {
  const serialized = JSON.stringify(preview);
  const keys = Object.keys(preview);
  const allowed = ['id', 'tipoAjuda', 'bairro', 'faixaHorario'];
  return (
    keys.every((key) => allowed.includes(key)) &&
    !serialized.includes('contato') &&
    !serialized.includes('lat') &&
    !serialized.includes('endereco')
  );
}
