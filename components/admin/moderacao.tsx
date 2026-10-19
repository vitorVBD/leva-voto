"use client";

import { useState } from "react";
import { Shell } from "@/components/shell";
import { api, VoluntarioResumo } from "@/lib/api";
import { TextField } from "@/components/choices";
import { Actions, Banner, Body, Button, Card } from "@/lib/design";
import { AJUDA_LABEL, STATUS_LABEL } from "@/lib/labels";

export function Moderacao() {
  const [token, setToken] = useState("");
  const [lista, setLista] = useState<VoluntarioResumo[]>([]);
  const [erro, setErro] = useState("");

  async function carregar(valor = token) {
    setErro("");
    try {
      setLista(
        await api<VoluntarioResumo[]>("/api/admin/voluntarios", {
          headers: { "x-admin-token": valor },
        }),
      );
      sessionStorage.setItem("leva-admin-token", valor);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível abrir a coordenação.");
    }
  }

  async function decidir(id: string, status: "aprovado" | "recusado") {
    await api(`/api/admin/voluntarios/${id}/aprovacao`, {
      method: "POST",
      headers: { "x-admin-token": token },
      body: JSON.stringify({ status }),
    });
    await carregar();
  }

  return (
    <Shell title="Coordenação" lede="Aprove quem pode receber chamados. Quem está pendente não entra na fila." width="board">
      {erro ? <Banner tone="danger">{erro}</Banner> : null}
      <TextField
        label="Token de coordenação"
        type="password"
        value={token}
        onChange={(event) => setToken(event.target.value)}
      />
      <Button type="button" onClick={() => void carregar()}>
        Carregar voluntários
      </Button>
      {lista.map((pessoa) => (
        <Card key={pessoa.id}>
          <Body>
            <strong>{pessoa.nome}</strong> · {STATUS_LABEL[pessoa.statusAprovacao]}
          </Body>
          <Body muted>
            {pessoa.email} · {pessoa.telefone} · CPF {pessoa.cpf}
          </Body>
          <Body muted>
            {pessoa.bairro ?? "Sem bairro"} · raio {pessoa.raioMaximoKm} km ·{" "}
            {pessoa.tiposAjudaOferecidos.map((tipo) => AJUDA_LABEL[tipo] ?? tipo).join(", ")}
          </Body>
          <Actions>
            <Button type="button" onClick={() => void decidir(pessoa.id, "aprovado")}>
              Aprovar
            </Button>
            <Button type="button" variant="danger" onClick={() => void decidir(pessoa.id, "recusado")}>
              Reprovar
            </Button>
          </Actions>
        </Card>
      ))}
    </Shell>
  );
}
