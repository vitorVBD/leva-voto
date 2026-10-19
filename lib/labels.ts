export const UFS = [
  "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT",
  "PA", "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO",
] as const;

export const DIFICULDADES = [
  { value: "cadeira_de_rodas", label: "Cadeira de rodas" },
  { value: "andador", label: "Andador" },
  { value: "baixa_visao", label: "Baixa visão" },
  { value: "acompanhante", label: "Precisa de acompanhante" },
] as const;

export const FAIXAS = [
  { value: "manha", label: "Manhã, das 8h às 12h" },
  { value: "tarde", label: "Tarde, das 12h às 16h" },
  { value: "fim_de_tarde", label: "Fim da tarde, das 16h às 17h" },
] as const;

export const STATUS_LABEL: Record<string, string> = {
  Aberto: "Pedido registrado",
  Buscando: "Procurando alguém por perto",
  SemVoluntario: "Ninguém disponível neste raio",
  Aceito: "Uma pessoa aceitou te acompanhar",
  EmAndamento: "Atendimento em andamento",
  Concluido: "Atendimento concluído",
  Cancelado: "Pedido cancelado",
  pendente: "Aguardando análise",
  aprovado: "Aprovado",
  recusado: "Não aprovado",
};

export const AJUDA_LABEL: Record<string, string> = {
  orientacao_detalhada: "Orientação detalhada",
  acompanhante_a_pe: "Acompanhante a pé",
  carona: "Carona solidária",
};
