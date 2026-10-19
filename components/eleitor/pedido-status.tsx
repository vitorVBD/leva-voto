"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { io } from "socket.io-client";
import { Orientacao } from "@/components/orientacao";
import { Shell } from "@/components/shell";
import { acessoHeaders, guardarPedido, lerPedido } from "@/lib/acesso";
import { API_URL, api, PedidoView } from "@/lib/api";
import { TextField } from "@/components/choices";
import { Actions, Banner, Body, Button, Card } from "@/lib/design";
import { AJUDA_LABEL, FAIXAS, STATUS_LABEL } from "@/lib/labels";

export function PedidoStatus() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [pedido, setPedido] = useState<PedidoView | null>(null);
  const [acesso, setAcesso] = useState("");
  const [codigo, setCodigo] = useState("");
  const [erro, setErro] = useState("");
  const [nota, setNota] = useState(0);
  const [comentario, setComentario] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setAcesso(lerPedido(id));
  }, [id]);

  useEffect(() => {
    if (!acesso) return;
    let stop = false;
    const load = () =>
      api<PedidoView>(`/api/pedidos/${id}`, { headers: acessoHeaders(acesso) })
        .then((data) => {
          if (!stop) setPedido(data);
        })
        .catch((error: unknown) => {
          if (!stop) setErro(error instanceof Error ? error.message : "Pedido não encontrado.");
        });
    void load();
    const timer = setInterval(() => void load(), 5000);
    const socket = io(API_URL, { transports: ["websocket"] });
    socket.emit("identificar", { papel: "pedido", id, segredo: acesso });
    socket.on("pedido:atualizado", (view: PedidoView) => setPedido(view));
    return () => {
      stop = true;
      clearInterval(timer);
      socket.close();
    };
  }, [id, acesso]);

  async function avaliar() {
    setBusy(true);
    try {
      setPedido(
        await api<PedidoView>(`/api/pedidos/${id}/avaliacao`, {
          method: "POST",
          headers: acessoHeaders(acesso),
          body: JSON.stringify({ nota, comentario: comentario || null }),
        }),
      );
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível enviar a avaliação.");
    } finally {
      setBusy(false);
    }
  }

  const faixa = FAIXAS.find((item) => item.value === pedido?.faixaHorario)?.label;

  return (
    <Shell title="Seu pedido" lede="Acompanhe aqui. O endereço só aparece para quem aceitar te ajudar.">
      {erro ? <Banner tone="danger">{erro}</Banner> : null}
      {!acesso ? (
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            const valor = codigo.trim();
            if (!valor) return;
            guardarPedido(id, valor);
            setAcesso(valor);
            setErro("");
          }}
        >
          <TextField label="Código de acesso" value={codigo} onChange={(event) => setCodigo(event.target.value)} />
          <Button type="submit">Ver pedido</Button>
        </form>
      ) : null}
      {acesso && !pedido ? <Body>Carregando o pedido…</Body> : null}
      {pedido ? (
        <div aria-live="polite" className="flex flex-col gap-3">
          <Card accent>
            <Body>
              <strong>{STATUS_LABEL[pedido.status] ?? pedido.status}</strong>
            </Body>
            <Body muted>
              {AJUDA_LABEL[pedido.tipoAjuda] ?? pedido.tipoAjuda}
              {faixa ? ` · ${faixa}` : ""} · buscando em {pedido.raioAtualKm} km
            </Body>
            <Body>
              {pedido.local.nome}, zona {pedido.local.zona}, seção {pedido.local.secao}
            </Body>
          </Card>
          {pedido.voluntario ? (
            <Card>
              <Body>
                <strong>{pedido.voluntario.nome}</strong> vai te acompanhar.
              </Body>
              <a
                className="font-bold text-primary underline"
                href={pedido.voluntario.whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Chamar no WhatsApp (abre em nova aba)
              </a>
            </Card>
          ) : null}
          {pedido.status === "SemVoluntario" ? (
            <>
              <Banner tone="warn">
                Não achamos alguém neste raio. Você ainda pode seguir com a orientação detalhada.
              </Banner>
              <Orientacao local={pedido.local} tre={pedido.tre} />
            </>
          ) : null}
          {pedido.status === "Concluido" && !pedido.avaliado ? (
            <Card>
              <Body>Como foi o atendimento?</Body>
              <div className="flex gap-2" role="group" aria-label="Nota de 1 a 5">
                {[1, 2, 3, 4, 5].map((valor) => (
                  <button
                    key={valor}
                    type="button"
                    aria-pressed={nota === valor}
                    aria-label={`${valor} de 5`}
                    className="min-h-12 min-w-12 rounded-lg border border-border text-xl font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    onClick={() => setNota(valor)}
                  >
                    {valor <= nota ? "★" : "☆"}
                  </button>
                ))}
              </div>
              <TextField
                label="Comentário, se quiser"
                value={comentario}
                onChange={(event) => setComentario(event.target.value)}
              />
              <Actions>
                <Button type="button" disabled={nota < 1} busy={busy} onClick={() => void avaliar()}>
                  Enviar avaliação
                </Button>
              </Actions>
            </Card>
          ) : null}
          {pedido.avaliado ? <Banner tone="ok">Obrigado pela avaliação.</Banner> : null}
        </div>
      ) : null}
    </Shell>
  );
}
