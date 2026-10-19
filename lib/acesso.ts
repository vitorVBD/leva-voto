export function guardarVoluntario(id: string, acesso: string) {
  localStorage.setItem("leva-voluntario-id", id);
  localStorage.setItem("leva-voluntario-acesso", acesso);
}

export function lerVoluntario() {
  return {
    id: localStorage.getItem("leva-voluntario-id") ?? "",
    acesso: localStorage.getItem("leva-voluntario-acesso") ?? "",
  };
}

export function guardarPedido(id: string, acesso: string) {
  localStorage.setItem(`leva-pedido-acesso:${id}`, acesso);
}

export function lerPedido(id: string) {
  return localStorage.getItem(`leva-pedido-acesso:${id}`) ?? "";
}

export function acessoHeaders(acesso: string): HeadersInit {
  return { "x-acesso": acesso };
}
