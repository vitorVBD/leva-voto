"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckChoice, Choice, TextField } from "@/components/choices";
import { guardarVoluntario } from "@/lib/acesso";
import { Shell } from "@/components/shell";
import { api, AppConfig, Termos } from "@/lib/api";
import { Actions, Banner, Body, Button, Card, FormSection } from "@/lib/design";
import { DIFICULDADES, FAIXAS } from "@/lib/labels";

const schema = z.object({
  nome: z.string().trim().min(3, "Informe seu nome."),
  cpf: z.string().trim().min(11, "Informe o CPF."),
  telefone: z
    .string()
    .trim()
    .refine((valor) => valor.replace(/\D/g, "").length === 11, "Informe o celular com DDD."),
  email: z.string().trim().regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Informe um e-mail válido."),
  bairro: z.string().trim().min(2, "Informe o bairro."),
  raio: z.string().trim().min(1, "Informe o raio."),
});

type FormValues = z.infer<typeof schema>;

export function CadastroVoluntario() {
  const [step, setStep] = useState<"dados" | "conduta" | "atuacao" | "pronto">("dados");
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [termos, setTermos] = useState<Termos | null>(null);
  const [termo, setTermo] = useState(false);
  const [tipos, setTipos] = useState<string[]>(["acompanhante_a_pe"]);
  const [faixas, setFaixas] = useState<string[]>(["manha"]);
  const [ofereceCarona, setOfereceCarona] = useState(false);
  const [veiculo, setVeiculo] = useState<"carro" | "moto">("carro");
  const [adaptado, setAdaptado] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [fonte, setFonte] = useState<"aparelho" | "cep" | null>(null);
  const [cep, setCep] = useState("");
  const [origemTexto, setOrigemTexto] = useState("");
  const [consultandoCep, setConsultandoCep] = useState(false);
  const [erro, setErro] = useState("");
  const [busy, setBusy] = useState(false);
  const [id, setId] = useState("");
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { nome: "", cpf: "", telefone: "", email: "", bairro: "", raio: "3" },
  });

  useEffect(() => {
    void api<AppConfig>("/api/config").then(setConfig);
    void api<Termos>("/api/termos").then(setTermos);
  }, []);

  async function seguirDados() {
    const ok = await form.trigger(["nome", "cpf", "telefone", "email"]);
    if (!ok) return;
    setErro("");
    setStep("conduta");
  }

  function localizar() {
    if (!navigator.geolocation) {
      setErro("Este navegador não informa a localização. Informe o CEP da região.");
      return;
    }
    setErro("");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
        setFonte("aparelho");
        setOrigemTexto("Localização do aparelho registrada. Ela define a região dos chamados.");
        setErro("");
      },
      (error) => {
        setErro(
          error.code === error.PERMISSION_DENIED
            ? "Permita a localização do navegador ou informe o CEP da região."
            : "Não foi possível ler a localização. Informe o CEP da região.",
        );
      },
      { enableHighAccuracy: false, timeout: 12_000, maximumAge: 60_000 },
    );
  }

  async function buscarCep() {
    const digits = cep.replace(/\D/g, "");
    if (digits.length !== 8) {
      setErro("CEP precisa ter 8 dígitos.");
      return;
    }
    setConsultandoCep(true);
    setErro("");
    try {
      const data = await api<{
        endereco: string;
        bairro: string;
        latitude: number | null;
        longitude: number | null;
        aproximado: boolean;
      }>(`/api/cep/${digits}`);
      if (data.latitude == null || data.longitude == null) {
        setErro("Encontramos o CEP, mas não há um ponto no mapa para essa cidade. Use a localização do aparelho.");
        return;
      }
      setCoords({ lat: data.latitude, lng: data.longitude });
      setFonte("cep");
      if (!form.getValues("bairro").trim()) {
        form.setValue("bairro", data.bairro, { shouldValidate: true });
      }
      setOrigemTexto(
        data.aproximado
          ? `${data.endereco}. O ponto no mapa é o centro do município.`
          : data.endereco,
      );
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível consultar o CEP.");
    } finally {
      setConsultandoCep(false);
    }
  }

  async function enviar() {
    if (!config) {
      setErro("Não foi possível carregar a configuração. Atualize a página e tente de novo.");
      return;
    }
    if (!coords) {
      setErro("Informe o CEP da região ou use a localização do aparelho antes de enviar.");
      return;
    }
    const tiposEnvio = ofereceCarona
      ? Array.from(new Set([...tipos, "carona"]))
      : tipos.filter((tipo) => tipo !== "carona");
    if (tiposEnvio.length === 0) {
      setErro("Escolha ao menos um tipo de ajuda.");
      return;
    }
    if (faixas.length === 0) {
      setErro("Escolha ao menos uma faixa de horário.");
      return;
    }
    let ok = false;
    try {
      ok = await form.trigger(["bairro", "raio"]);
    } catch {
      setErro("Não foi possível validar o cadastro. Revise o bairro e o raio.");
      return;
    }
    if (!ok) {
      setErro("Revise o bairro e o raio antes de enviar.");
      return;
    }
    setBusy(true);
    setErro("");
    try {
      const salvo = await api<{ id: string; segredo: string }>("/api/voluntarios", {
        method: "POST",
        body: JSON.stringify({
          nome: form.getValues("nome"),
          cpf: form.getValues("cpf"),
          telefone: form.getValues("telefone"),
          email: form.getValues("email"),
          termoCondutaAceito: true,
          termoVersao: config.termoCondutaVersao,
          latitude: coords.lat,
          longitude: coords.lng,
          bairro: form.getValues("bairro"),
          raioMaximoKm: Number(form.getValues("raio")),
          tiposAjudaOferecidos: tiposEnvio,
          ofereceCarona,
          tipoVeiculo: ofereceCarona ? veiculo : null,
          veiculoAdaptado: ofereceCarona ? adaptado : false,
          disponibilidadeHorarios: faixas,
        }),
      });
      setId(salvo.segredo);
      guardarVoluntario(salvo.id, salvo.segredo);
      setStep("pronto");
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível enviar o cadastro.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell title="Quero ser voluntário" lede="O cadastro passa por análise antes de você receber chamados.">
      {erro && step !== "atuacao" ? <Banner tone="danger">{erro}</Banner> : null}
      {step === "dados" ? (
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void seguirDados();
          }}
        >
          <FormSection title="Seus dados">
            <TextField label="Nome" error={form.formState.errors.nome?.message} {...form.register("nome")} />
            <TextField label="CPF" inputMode="numeric" error={form.formState.errors.cpf?.message} {...form.register("cpf")} />
            <TextField
              label="Celular"
              inputMode="tel"
              autoComplete="tel"
              placeholder="(00) 00000-0000"
              error={form.formState.errors.telefone?.message}
              {...form.register("telefone")}
              onChange={(event) => {
                event.target.value = formatarCelular(event.target.value);
                void form.register("telefone").onChange(event);
              }}
            />
            <TextField label="E-mail" type="email" error={form.formState.errors.email?.message} {...form.register("email")} />
            <Banner tone="neutral">
              Quem precisar de ajuda poderá entrar em contato com você por este celular ou por este e-mail.
            </Banner>
            <Button type="submit">Continuar</Button>
          </FormSection>
        </form>
      ) : null}
      {step === "conduta" && termos ? (
        <FormSection title={termos.conduta.titulo}>
          {termos.conduta.paragrafos.map((paragrafo) => (
            <Body key={paragrafo}>{paragrafo}</Body>
          ))}
          <CheckChoice checked={termo} onChange={setTermo} label="Aceito o termo de conduta" />
          <Button type="button" disabled={!termo} onClick={() => setStep("atuacao")}>
            Continuar
          </Button>
        </FormSection>
      ) : null}
      {step === "atuacao" ? (
        <FormSection title="Onde e como você ajuda">
          <TextField
            label="CEP da região"
            inputMode="numeric"
            autoComplete="postal-code"
            value={cep}
            onChange={(event) => setCep(event.target.value)}
          />
          <Actions>
            <Button type="button" variant="secondary" busy={consultandoCep} onClick={() => void buscarCep()}>
              Buscar CEP
            </Button>
            <Button type="button" variant="secondary" onClick={localizar}>
              {fonte === "aparelho" ? "Localização do aparelho registrada" : "Usar minha localização"}
            </Button>
          </Actions>
          <Body muted>
            {origemTexto || "Informe o CEP ou use a localização do aparelho. Sem isso o envio não segue."}
          </Body>
          <TextField label="Bairro de atuação" error={form.formState.errors.bairro?.message} {...form.register("bairro")} />
          <TextField label="Raio máximo em km" inputMode="decimal" error={form.formState.errors.raio?.message} {...form.register("raio")} />
          <CheckChoice
            checked={tipos.includes("orientacao_detalhada")}
            label="Orientação detalhada"
            onChange={(checked) => toggle(setTipos, "orientacao_detalhada", checked)}
          />
          <CheckChoice
            checked={tipos.includes("acompanhante_a_pe")}
            label="Acompanhante a pé"
            onChange={(checked) => toggle(setTipos, "acompanhante_a_pe", checked)}
          />
          <CheckChoice
            checked={ofereceCarona}
            onChange={setOfereceCarona}
            label="Carona solidária"
            description="Ofereço transporte gratuito até a seção."
          />
          {ofereceCarona ? (
            <>
              <Choice name="veiculo" checked={veiculo === "carro"} onChange={() => setVeiculo("carro")} label="Carro" />
              <Choice name="veiculo" checked={veiculo === "moto"} onChange={() => setVeiculo("moto")} label="Moto" />
              <CheckChoice checked={adaptado} onChange={setAdaptado} label="Veículo adaptado para cadeira de rodas" />
            </>
          ) : null}
          {FAIXAS.map((item) => (
            <CheckChoice
              key={item.value}
              checked={faixas.includes(item.value)}
              label={item.label}
              onChange={(checked) => toggle(setFaixas, item.value, checked)}
            />
          ))}
          <Body muted>
            Necessidades de locomoção de quem pede ajuda: {DIFICULDADES.map((item) => item.label).join(", ")}. Você só vê o
            detalhe depois de aceitar.
          </Body>
          {erro ? <Banner tone="danger">{erro}</Banner> : null}
          <Button type="button" busy={busy} onClick={() => void enviar()}>
            Enviar para análise
          </Button>
        </FormSection>
      ) : null}
      {step === "pronto" ? (
        <Card accent>
          <Body>
            Cadastro enviado com status pendente. A coordenação precisa aprovar antes de você receber chamados.
          </Body>
          <Body muted>Guarde este código de acesso. Ele abre o painel neste aparelho: {id}</Body>
          <a className="font-bold text-primary underline" href="/voluntario/painel">
            Abrir painel
          </a>
        </Card>
      ) : null}
    </Shell>
  );
}

function formatarCelular(valor: string): string {
  const digits = valor.replace(/\D/g, "").slice(0, 11);
  if (digits.length === 0) return "";
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function toggle(set: (value: (atual: string[]) => string[]) => void, value: string, checked: boolean) {
  set((atual) => (checked ? [...atual, value] : atual.filter((item) => item !== value)));
}
