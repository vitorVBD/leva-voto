"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Shell } from "@/components/shell";
import { acessoHeaders, guardarVoluntario, lerVoluntario } from "@/lib/acesso";
import { api, Atendimento, Preview, VoluntarioResumo } from "@/lib/api";
import { TextField } from "@/components/choices";
import { Actions, Banner, Body, Button, Card } from "@/lib/design";
import { AJUDA_LABEL, DIFICULDADES, FAIXAS, STATUS_LABEL } from "@/lib/labels";
import { mapsDirections } from "@/lib/maps";

export function PainelVoluntario() {
  const [id, setId] = useState("");
  const [acesso, setAcesso] = useState("");
  const [codigo, setCodigo] = useState("");
  const [resumo, setResumo] = useState<VoluntarioResumo | null>(null);
  const [chamados, setChamados] = useState<Preview[]>([]);
  const [atendimento, setAtendimento] = useState<Atendimento | null>(null);
  const [aviso, setAviso] = useState("");
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState("");
  const identificador = useRef<HTMLInputElement>(null);

  function entrar(event: FormEvent) {
    event.preventDefault();
    const value = identificador.current?.value.trim() ?? "";
    const segredo = codigo.trim();
    if (!value || !segredo) return;
    guardarVoluntario(value, segredo);
    setId(value);
    setAcesso(segredo);
  }

  useEffect(() => {
    const salvo = lerVoluntario();
    setId(salvo.id);
    setAcesso(salvo.acesso);
  }, []);

  useEffect(() => {
    if (!id || !acesso) return;
    let stop = false;
    const load = async () => {
      try {
        const headers = acessoHeaders(acesso);
        const [pessoa, fila] = await Promise.all([
          api<VoluntarioResumo>(`/api/voluntarios/${id}`, { headers }),
          api<{ chamados: Preview[]; atendimento: Atendimento | null; aviso: string | null }>(
            `/api/voluntarios/${id}/chamados`,
            { headers },
          ),
        ]);
        if (stop) return;
        setResumo(pessoa);
        setChamados(fila.chamados);
        setAtendimento(fila.atendimento);
        if (fila.aviso) setAviso(fila.aviso);
      } catch (error) {
        if (!stop) setErro(error instanceof Error ? error.message : "Não foi possível carregar o painel.");
      }
    };
    void load();
    const timer = setInterval(() => void load(), 8000);
    return () => {
      stop = true;
      clearInterval(timer);
    };
  }, [id, acesso]);

  async function aceitar(pedidoId: string) {
    setErro("");
    try {
      const dados = await api<Atendimento>(`/api/voluntarios/${id}/chamados/${pedidoId}/aceitar`, {
        method: "POST",
        headers: acessoHeaders(acesso),
      });
      setAtendimento(dados);
      setChamados((atual) => atual.filter((item) => item.id !== pedidoId));
    } catch (error) {
      setAviso(error instanceof Error ? error.message : "Este pedido já foi atendido.");
    }
  }

  async function recusar(pedidoId: string) {
    await api(`/api/voluntarios/${id}/chamados/${pedidoId}/recusar`, {
      method: "POST",
      headers: acessoHeaders(acesso),
    });
    setChamados((atual) => atual.filter((item) => item.id !== pedidoId));
  }

  async function acao(caminho: string) {
    if (!atendimento) return;
    setErro("");
    try {
      await api(`/api/voluntarios/${id}/atendimentos/${atendimento.id}/${caminho}`, {
        method: "POST",
        headers: acessoHeaders(acesso),
        body: caminho === "cancelar" ? JSON.stringify({ motivo }) : undefined,
      });
      const fila = await api<{ chamados: Preview[]; atendimento: Atendimento | null }>(
        `/api/voluntarios/${id}/chamados`,
        { headers: acessoHeaders(acesso) },
      );
      setAtendimento(fila.atendimento);
      setChamados(fila.chamados);
      setMotivo("");
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível atualizar o atendimento.");
    }
  }

  return (
    <Shell title="Chamados" lede="Antes de aceitar, você vê só o tipo de ajuda, o bairro e o horário.">
      {erro ? <Banner tone="danger">{erro}</Banner> : null}
      {aviso ? <Banner tone="warn">{aviso}</Banner> : null}
      {!id || !acesso ? (
        <form key={id || "novo"} onSubmit={entrar} className="flex flex-col gap-3">
          <TextField ref={identificador} label="Identificador do cadastro" defaultValue={id} />
          <TextField label="Código de acesso" value={codigo} onChange={(event) => setCodigo(event.target.value)} />
          <Button type="submit">Ver chamados</Button>
        </form>
      ) : null}
      {resumo ? (
        <Card>
          <Body>
            <strong>{resumo.nome}</strong> · {STATUS_LABEL[resumo.statusAprovacao]}
          </Body>
          {!resumo.ativo ? <Body muted>Você ainda não recebe chamados.</Body> : null}
        </Card>
      ) : null}
      {chamados.map((chamado) => (
        <Card key={chamado.id} accent>
          <Body>{AJUDA_LABEL[chamado.tipoAjuda] ?? chamado.tipoAjuda}</Body>
          <Body muted>
            Bairro {chamado.bairro} · {FAIXAS.find((item) => item.value === chamado.faixaHorario)?.label}
          </Body>
          <Actions>
            <Button type="button" onClick={() => void aceitar(chamado.id)}>
              Aceitar
            </Button>
            <Button type="button" variant="secondary" onClick={() => void recusar(chamado.id)}>
              Recusar
            </Button>
          </Actions>
        </Card>
      ))}
      {atendimento ? (
        <Card>
          <Body>
            <strong>{STATUS_LABEL[atendimento.status]}</strong>
          </Body>
          <Body>{atendimento.nomeEleitor}</Body>
          <Body>{atendimento.pontoEncontro.endereco}</Body>
          <Body muted>
            Necessidades:{" "}
            {atendimento.dificuldadesLocomocao.length
              ? atendimento.dificuldadesLocomocao
                  .map((item) => DIFICULDADES.find((opcao) => opcao.value === item)?.label ?? item)
                  .join(", ")
              : "nenhuma informada"}
          </Body>
          <a className="font-bold text-primary underline" href={atendimento.whatsappUrl} target="_blank" rel="noopener noreferrer">
            Abrir WhatsApp (abre em nova aba)
          </a>
          <a
            className="font-bold text-primary underline"
            href={mapsDirections(
              `${atendimento.pontoEncontro.lat},${atendimento.pontoEncontro.lng}`,
              atendimento.pontoEncontro.endereco,
              "walking",
            )}
            target="_blank"
            rel="noopener noreferrer"
          >
            Ver ponto de encontro no mapa
          </a>
          <Actions>
            {atendimento.status === "Aceito" ? (
              <Button type="button" onClick={() => void acao("iniciar")}>
                Iniciar atendimento
              </Button>
            ) : null}
            {atendimento.status === "EmAndamento" ? (
              <Button type="button" onClick={() => void acao("concluir")}>
                Concluir atendimento
              </Button>
            ) : null}
          </Actions>
          <TextField label="Motivo do cancelamento" value={motivo} onChange={(event) => setMotivo(event.target.value)} />
          <Button type="button" variant="danger" onClick={() => void acao("cancelar")}>
            Cancelar e devolver à fila
          </Button>
        </Card>
      ) : null}
      {resumo?.ativo && chamados.length === 0 && !atendimento ? (
        <Body muted>Nenhum chamado agora. Esta tela atualiza sozinha.</Body>
      ) : null}
    </Shell>
  );
}
