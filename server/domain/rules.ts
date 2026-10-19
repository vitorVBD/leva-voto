import { AppConfig } from '../config';
import {
  DificuldadeLocomocao,
  FaixaHorario,
  Pedido,
  TipoAjuda,
  TipoVeiculo,
  Voluntario,
} from './types';

export function motoPermitida(dificuldades: readonly DificuldadeLocomocao[]): boolean {
  return dificuldades.length === 0;
}

export function tiposAjudaDisponiveis(enableRideFeature: boolean): TipoAjuda[] {
  const tipos: TipoAjuda[] = ['orientacao_detalhada', 'acompanhante_a_pe'];
  if (enableRideFeature) tipos.push('carona');
  return tipos;
}

export function veiculoCompativel(pedido: Pedido, voluntario: Voluntario): boolean {
  if (pedido.tipoAjuda !== 'carona') return true;
  if (!voluntario.ofereceCarona || !voluntario.tipoVeiculo) return false;
  if (!motoPermitida(pedido.dificuldadesLocomocao) && voluntario.tipoVeiculo === 'moto') {
    return false;
  }
  if (
    pedido.dificuldadesLocomocao.includes('cadeira_de_rodas') &&
    !voluntario.veiculoAdaptado
  ) {
    return false;
  }
  if (pedido.veiculoAceito && voluntario.tipoVeiculo !== pedido.veiculoAceito) return false;
  return true;
}

export function horarioCompativel(pedido: Pedido, voluntario: Voluntario): boolean {
  if (!pedido.faixaHorario) return true;
  if (voluntario.disponibilidadeHorarios.length === 0) return true;
  return voluntario.disponibilidadeHorarios.includes(pedido.faixaHorario);
}

export function voluntarioCompativel(
  pedido: Pedido,
  voluntario: Voluntario & { distanciaKm: number },
): boolean {
  if (!voluntario.ativo || voluntario.statusAprovacao !== 'aprovado') return false;
  if (!voluntario.telefoneConfirmado || !voluntario.termoCondutaAceito) return false;
  if (voluntario.distanciaKm > pedido.raioAtualKm) return false;
  if (voluntario.distanciaKm > voluntario.raioMaximoKm) return false;
  if (!voluntario.tiposAjudaOferecidos.includes(pedido.tipoAjuda)) return false;
  if (!horarioCompativel(pedido, voluntario)) return false;
  return veiculoCompativel(pedido, voluntario);
}

export type NovoPedidoInput = {
  aceiteLgpd: boolean;
  termoVersao: string;
  dificuldadesLocomocao: DificuldadeLocomocao[];
  tipoAjuda: TipoAjuda;
  veiculoAceito: TipoVeiculo | null;
  faixaHorario: FaixaHorario | null;
  nomeEleitor: string;
  contatoEleitor: string;
};

export function validarNovoPedido(input: NovoPedidoInput, config: AppConfig): string | null {
  if (!input.aceiteLgpd) return 'O aceite do termo de uso é obrigatório.';
  if (input.termoVersao !== config.termoVersao) {
    return 'O termo de uso foi atualizado. Leia a versão nova antes de continuar.';
  }
  if (!tiposAjudaDisponiveis(config.enableRideFeature).includes(input.tipoAjuda)) {
    return 'Carona está desligada nesta plataforma, em respeito à Lei 6.091/74.';
  }
  if (input.tipoAjuda === 'orientacao_detalhada') return null;
  if (input.nomeEleitor.trim().length < 3) return 'Informe o nome de quem vai receber a ajuda.';
  if (input.contatoEleitor.replace(/\D/g, '').length < 10) {
    return 'Informe um telefone com DDD para o WhatsApp.';
  }
  if (!input.faixaHorario) return 'Escolha a faixa de horário.';
  if (input.veiculoAceito === 'moto' && !motoPermitida(input.dificuldadesLocomocao)) {
    return 'Moto fica indisponível quando há dificuldade de locomoção.';
  }
  if (input.tipoAjuda === 'carona' && input.veiculoAceito === 'moto' && !motoPermitida(input.dificuldadesLocomocao)) {
    return 'Moto fica indisponível quando há dificuldade de locomoção.';
  }
  if (
    input.tipoAjuda === 'carona' &&
    !motoPermitida(input.dificuldadesLocomocao) &&
    input.veiculoAceito === null
  ) {
    return 'Com dificuldade de locomoção, a carona precisa ser de carro.';
  }
  return null;
}

export function proximoRaio(
  atualKm: number,
  passoKm: number,
  maxKm: number,
): { raioKm: number; esgotado: boolean } {
  if (atualKm >= maxKm) return { raioKm: atualKm, esgotado: true };
  return { raioKm: Math.min(maxKm, atualKm + passoKm), esgotado: false };
}
