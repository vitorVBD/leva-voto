"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckChoice, Choice, SelectField, TextField } from "@/components/choices";
import { MunicipioField } from "@/components/eleitor/municipio-field";
import { Mapa } from "@/components/mapa";
import { Orientacao } from "@/components/orientacao";
import { Shell } from "@/components/shell";
import { guardarPedido } from "@/lib/acesso";
import { api, AppConfig, Secao, Termos } from "@/lib/api";
import { Actions, Banner, Body, Button, Card, FormSection } from "@/lib/design";
import { DIFICULDADES, FAIXAS, UFS } from "@/lib/labels";
import { calendarLink, mapsDirections } from "@/lib/maps";

const dadosSchema = z.object({
  uf: z.string().length(2, "Escolha a UF."),
  municipio: z.string().trim().min(2, "Informe o município."),
  zona: z.string().trim().min(1, "Informe a zona."),
  secao: z.string().trim().min(1, "Informe a seção."),
});

const contatoSchema = z.object({
  nome: z.string().trim().min(3, "Informe seu nome."),
  contato: z.string().trim().min(10, "Informe o WhatsApp com DDD."),
  endereco: z.string().trim().min(3, "Informe o ponto de encontro."),
  bairro: z.string().trim().min(2, "Informe o bairro."),
});

type Dados = z.infer<typeof dadosSchema>;
type Contato = z.infer<typeof contatoSchema>;
type Step =
  | "sabe"
  | "tse"
  | "dados"
  | "local"
  | "origem"
  | "rota"
  | "ajuda"
  | "lembrete"
  | "lgpd"
  | "mobilidade"
  | "tipo"
  | "orientacao"
  | "encontro";

type Origem = {
  lat: number | null;
  lng: number | null;
  endereco: string;
  bairro: string;
  cep: string | null;
};

export function FluxoEleitor() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("sabe");
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [termos, setTermos] = useState<Termos | null>(null);
  const [municipios, setMunicipios] = useState<string[]>([]);
  const [cidadesEstado, setCidadesEstado] = useState<"idle" | "carregando" | "pronto" | "erro">("idle");
  const [secao, setSecao] = useState<Secao | null>(null);
  const [origem, setOrigem] = useState<Origem | null>(null);
  const [cep, setCep] = useState("");
  const [enderecoManual, setEnderecoManual] = useState("");
  const [aceite, setAceite] = useState(false);
  const [dificuldades, setDificuldades] = useState<string[]>([]);
  const [tipo, setTipo] = useState<string>("");
  const [veiculo, setVeiculo] = useState<string>("carro");
  const [faixa, setFaixa] = useState<string>("");
  const [erro, setErro] = useState("");
  const [busy, setBusy] = useState(false);
  const dados = useForm<Dados>({
    resolver: zodResolver(dadosSchema),
    defaultValues: { uf: "", municipio: "", zona: "", secao: "" },
  });
  const contato = useForm<Contato>({
    resolver: zodResolver(contatoSchema),
    defaultValues: { nome: "", contato: "", endereco: "", bairro: "" },
  });
  const uf = dados.watch("uf");

  useEffect(() => {
    void api<AppConfig>("/api/config").then(setConfig).catch(() => setErro("Não foi possível carregar a plataforma."));
    void api<Termos>("/api/termos").then(setTermos).catch(() => undefined);
  }, []);

  useEffect(() => {
    dados.setValue("municipio", "");
    if (uf.length !== 2) {
      setMunicipios([]);
      setCidadesEstado("idle");
      return;
    }
    let cancelado = false;
    setCidadesEstado("carregando");
    void api<string[]>(`/api/secoes/municipios?uf=${uf}`)
      .then((lista) => {
        if (cancelado) return;
        setMunicipios(lista);
        setCidadesEstado("pronto");
      })
      .catch(() => {
        if (cancelado) return;
        setMunicipios([]);
        setCidadesEstado("erro");
      });
    return () => {
      cancelado = true;
    };
    // O reset acompanha só a UF. `dados` é estável o bastante para não entrar na lista.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uf]);

  async function buscarSecao(values: Dados) {
    setBusy(true);
    setErro("");
    try {
      const params = new URLSearchParams(values);
      const found = await api<Secao>(`/api/secoes?${params.toString()}`);
      setSecao(found);
      setStep("local");
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não encontramos essa seção.");
    } finally {
      setBusy(false);
    }
  }

  function usarLocalizacao() {
    setErro("");
    if (!navigator.geolocation) {
      setErro("Este aparelho não informou a localização. Digite o CEP ou o endereço.");
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const next = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          endereco: "Minha localização atual",
          bairro: secao?.bairro ?? "",
          cep: null,
        };
        setOrigem(next);
        contato.setValue("endereco", next.endereco);
        contato.setValue("bairro", next.bairro);
        setStep("rota");
        setBusy(false);
      },
      () => {
        setErro("Sem acesso à localização. Digite o CEP ou o endereço de partida.");
        setBusy(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  async function buscarCep() {
    setBusy(true);
    setErro("");
    try {
      const data = await api<{
        endereco: string;
        bairro: string;
        latitude: number | null;
        longitude: number | null;
        cep: string;
      }>(`/api/cep/${cep.replace(/\D/g, "")}`);
      const next = {
        lat: data.latitude,
        lng: data.longitude,
        endereco: data.endereco,
        bairro: data.bairro,
        cep: data.cep,
      };
      setOrigem(next);
      contato.setValue("endereco", data.endereco);
      contato.setValue("bairro", data.bairro);
      setStep("rota");
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível consultar o CEP.");
    } finally {
      setBusy(false);
    }
  }

  function usarEndereco() {
    if (enderecoManual.trim().length < 5) {
      setErro("Escreva o endereço de onde você vai sair.");
      return;
    }
    setOrigem({
      lat: null,
      lng: null,
      endereco: enderecoManual.trim(),
      bairro: "",
      cep: null,
    });
    contato.setValue("endereco", enderecoManual.trim());
    setErro("");
    setStep("rota");
  }

  async function enviarPedido(values: Contato) {
    if (!secao || !config || !origem || !faixa || !tipo) return;
    if ((tipo === "acompanhante_a_pe" || tipo === "carona") && (origem.lat == null || origem.lng == null)) {
      setErro("Para chamar alguém, precisamos da localização ou de um CEP da cidade atendida.");
      return;
    }
    setBusy(true);
    setErro("");
    try {
      const pedido = await api<{ id: string; segredo: string }>("/api/pedidos", {
        method: "POST",
        body: JSON.stringify({
          uf: secao.uf,
          municipio: secao.municipio,
          zona: secao.zona,
          secao: secao.secao,
          latitude: origem.lat,
          longitude: origem.lng,
          cep: origem.cep,
          enderecoOrigem: origem.endereco,
          nomeEleitor: values.nome,
          contatoEleitor: values.contato,
          aceiteLgpd: true,
          termoVersao: config.termoVersao,
          dificuldadesLocomocao: dificuldades,
          tipoAjuda: tipo,
          veiculoAceito: tipo === "carona" ? veiculo : null,
          faixaHorario: faixa,
          pontoEncontro: {
            lat: origem.lat,
            lng: origem.lng,
            endereco: values.endereco,
            bairro: values.bairro,
          },
        }),
      });
      guardarPedido(pedido.id, pedido.segredo);
      router.push(`/eleitor/pedido/${pedido.id}`);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível abrir o pedido.");
      setBusy(false);
    }
  }

  const origemTexto =
    origem?.lat != null && origem.lng != null ? `${origem.lat},${origem.lng}` : (origem?.endereco ?? "");
  const destinoTexto = secao ? `${secao.latitude},${secao.longitude}` : "";
  const rota = secao && origem ? mapsDirections(origemTexto, destinoTexto, "walking") : "";
  const temDificuldade = dificuldades.length > 0;
  const podeCarona = Boolean(config?.enableRideFeature);

  return (
    <Shell
      title="Até a porta da seção"
      lede="Encontre o local de votação e, se precisar, peça companhia para chegar."
    >
      <p className="sr-only" aria-live="polite">
        {erro}
      </p>
      {erro ? <Banner tone="danger">{erro}</Banner> : null}

      {step === "sabe" ? (
        <FormSection title="Zona e seção">
          <Body>Você já sabe a zona e a seção do seu título?</Body>
          <Actions>
            <Button type="button" onClick={() => setStep("dados")}>
              Sim, eu sei
            </Button>
            <Button type="button" variant="secondary" onClick={() => setStep("tse")}>
              Ainda não
            </Button>
          </Actions>
        </FormSection>
      ) : null}

      {step === "tse" && config ? (
        <FormSection title="Consulta oficial">
          <Body>Abra a consulta do TSE, anote zona e seção, e volte para preencher aqui.</Body>
          <a
            className="inline-flex min-h-12 items-center font-bold text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
            href={config.tseUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Abrir consulta oficial do TSE (abre em nova aba)
          </a>
          <Actions>
            <Button type="button" onClick={() => setStep("dados")}>
              Já anotei, quero preencher
            </Button>
            <Button type="button" variant="secondary" onClick={() => setStep("sabe")}>
              Voltar
            </Button>
          </Actions>
        </FormSection>
      ) : null}

      {step === "dados" ? (
        <form onSubmit={dados.handleSubmit(buscarSecao)} className="flex flex-col gap-3">
          <FormSection title="Onde você vota">
            <SelectField label="UF" error={dados.formState.errors.uf?.message} {...dados.register("uf")}>
              <option value="">Escolha</option>
              {UFS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </SelectField>
            <MunicipioField
              value={dados.watch("municipio")}
              onChange={(nome) => dados.setValue("municipio", nome, { shouldValidate: true })}
              cidades={municipios}
              estado={cidadesEstado}
              uf={uf}
              error={dados.formState.errors.uf && !uf ? undefined : dados.formState.errors.municipio?.message}
            />
            <TextField label="Seção" inputMode="numeric" error={dados.formState.errors.secao?.message} {...dados.register("secao")} />
            <TextField label="Zona" inputMode="numeric" error={dados.formState.errors.zona?.message} {...dados.register("zona")} />
            <Actions>
              <Button type="submit" busy={busy}>
                Buscar local
              </Button>
              <Button type="button" variant="secondary" onClick={() => setStep("sabe")}>
                Voltar
              </Button>
            </Actions>
          </FormSection>
        </form>
      ) : null}

      {step === "local" && secao ? (
        <FormSection title="Local encontrado">
          <Banner tone="warn">{secao.aviso}</Banner>
          <Card accent>
            <Body>
              <strong>{secao.local}</strong>
            </Body>
            <Body muted>
              Zona {secao.zona}, seção {secao.secao}
            </Body>
            <Body>{secao.endereco}</Body>
          </Card>
          <Mapa lat={secao.latitude} lng={secao.longitude} nome={secao.local} />
          <Body>Este é o seu local de votação?</Body>
          <Actions>
            <Button type="button" onClick={() => setStep("origem")}>
              Sim, é este
            </Button>
            <Button type="button" variant="secondary" onClick={() => setStep("dados")}>
              Não, quero corrigir
            </Button>
          </Actions>
        </FormSection>
      ) : null}

      {step === "origem" ? (
        <FormSection title="De onde você sai">
          <Body>Use sua localização ou informe o CEP ou o endereço de partida.</Body>
          <Actions>
            <Button type="button" busy={busy} onClick={usarLocalizacao}>
              Usar minha localização
            </Button>
          </Actions>
          <TextField label="CEP" inputMode="numeric" value={cep} onChange={(event) => setCep(event.target.value)} />
          <Button type="button" variant="secondary" busy={busy} onClick={() => void buscarCep()}>
            Buscar CEP
          </Button>
          <TextField
            label="Ou digite o endereço"
            value={enderecoManual}
            onChange={(event) => setEnderecoManual(event.target.value)}
          />
          <Actions>
            <Button type="button" variant="secondary" onClick={usarEndereco}>
              Usar este endereço
            </Button>
            <Button type="button" variant="secondary" onClick={() => setStep("local")}>
              Voltar
            </Button>
          </Actions>
        </FormSection>
      ) : null}

      {step === "rota" && secao && origem ? (
        <FormSection title="Sua rota">
          <Body>
            De {origem.endereco} até {secao.local}.
          </Body>
          <a
            className="inline-flex min-h-12 items-center justify-center rounded-lg border border-primary bg-primary px-4 font-bold text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
            href={rota}
            target="_blank"
            rel="noopener noreferrer"
          >
            Abrir rota no Google Maps (abre em nova aba)
          </a>
          <Body>Precisa de ajuda para chegar?</Body>
          <Actions>
            <Button type="button" onClick={() => setStep("lgpd")}>
              Sim, quero ajuda
            </Button>
            <Button type="button" variant="secondary" onClick={() => setStep("lembrete")}>
              Não, só o lembrete
            </Button>
          </Actions>
        </FormSection>
      ) : null}

      {step === "lembrete" && secao && config ? (
        <FormSection title="Lembrete da votação">
          <Card>
            <Body>
              {secao.local}, zona {secao.zona}, seção {secao.secao}.
            </Body>
            <Body muted>{secao.endereco}</Body>
          </Card>
          <a
            className="inline-flex min-h-12 items-center font-bold text-primary underline"
            href={calendarLink({
              start: config.electionAt,
              end: config.electionEnd,
              title: `Votação — zona ${secao.zona}, seção ${secao.secao}`,
              location: secao.endereco,
              details: secao.local,
            })}
          >
            Salvar data e horário na agenda
          </a>
        </FormSection>
      ) : null}

      {step === "lgpd" && termos ? (
        <FormSection title={termos.uso.titulo}>
          {termos.uso.paragrafos.map((paragrafo) => (
            <Body key={paragrafo}>{paragrafo}</Body>
          ))}
          <Body muted>Versão {termos.uso.versao}</Body>
          <CheckChoice
            checked={aceite}
            onChange={setAceite}
            label="Li e aceito este uso dos meus dados"
          />
          <Actions>
            <Button type="button" disabled={!aceite} onClick={() => setStep("mobilidade")}>
              Continuar
            </Button>
            <Button type="button" variant="secondary" onClick={() => setStep("rota")}>
              Voltar
            </Button>
          </Actions>
        </FormSection>
      ) : null}

      {step === "mobilidade" ? (
        <FormSection title="Ajuda para se locomover">
          <Body>Tem alguma dificuldade de locomoção? Marque só a necessidade. Não pedimos diagnóstico.</Body>
          {DIFICULDADES.map((item) => (
            <CheckChoice
              key={item.value}
              checked={dificuldades.includes(item.value)}
              label={item.label}
              onChange={(checked) =>
                setDificuldades((atual) =>
                  checked ? [...atual, item.value] : atual.filter((valor) => valor !== item.value),
                )
              }
            />
          ))}
          <Actions>
            <Button type="button" onClick={() => setStep("tipo")}>
              Continuar
            </Button>
            <Button type="button" variant="secondary" onClick={() => setStep("lgpd")}>
              Voltar
            </Button>
          </Actions>
        </FormSection>
      ) : null}

      {step === "tipo" ? (
        <FormSection title="Que ajuda você quer">
          <Choice
            name="tipo"
            checked={tipo === "orientacao_detalhada"}
            onChange={() => setTipo("orientacao_detalhada")}
            label="Orientação detalhada"
            description="Um passo a passo da rota, da acessibilidade e do contato do TRE."
          />
          <Choice
            name="tipo"
            checked={tipo === "acompanhante_a_pe"}
            onChange={() => setTipo("acompanhante_a_pe")}
            label="Acompanhante a pé"
            description="Alguém vai com você do ponto combinado até a seção."
          />
          <Choice
            name="tipo"
            checked={tipo === "carona"}
            disabled={!podeCarona}
            reason="Desligada em respeito à Lei 6.091/74, que regula o transporte de eleitores."
            onChange={() => setTipo("carona")}
            label="Carona"
            description="Só aparece quando a função está autorizada na plataforma."
          />
          {tipo === "carona" ? (
            <>
              <Choice
                name="veiculo"
                checked={veiculo === "carro"}
                onChange={() => setVeiculo("carro")}
                label="Carro"
              />
              <Choice
                name="veiculo"
                checked={veiculo === "moto"}
                disabled={temDificuldade}
                reason="Moto fica indisponível quando há dificuldade de locomoção."
                onChange={() => setVeiculo("moto")}
                label="Moto"
              />
            </>
          ) : null}
          <Actions>
            <Button
              type="button"
              disabled={!tipo || (tipo === "carona" && temDificuldade && veiculo === "moto")}
              onClick={() => setStep(tipo === "orientacao_detalhada" ? "orientacao" : "encontro")}
            >
              Continuar
            </Button>
            <Button type="button" variant="secondary" onClick={() => setStep("mobilidade")}>
              Voltar
            </Button>
          </Actions>
        </FormSection>
      ) : null}

      {step === "orientacao" && secao ? (
        <>
          <Orientacao local={{ ...secao, nome: secao.local }} tre={secao.tre} />
          <Button type="button" variant="secondary" onClick={() => setStep("tipo")}>
            Voltar
          </Button>
        </>
      ) : null}

      {step === "encontro" ? (
        <form onSubmit={contato.handleSubmit(enviarPedido)} className="flex flex-col gap-3">
          <FormSection title="Combinar o encontro">
            <TextField
              label="Ponto de encontro"
              error={contato.formState.errors.endereco?.message}
              {...contato.register("endereco")}
            />
            <TextField label="Bairro" error={contato.formState.errors.bairro?.message} {...contato.register("bairro")} />
            {FAIXAS.map((item) => (
              <Choice
                key={item.value}
                name="faixa"
                checked={faixa === item.value}
                onChange={() => setFaixa(item.value)}
                label={item.label}
              />
            ))}
            <TextField label="Seu nome" error={contato.formState.errors.nome?.message} {...contato.register("nome")} />
            <TextField
              label="WhatsApp"
              inputMode="tel"
              autoComplete="tel"
              error={contato.formState.errors.contato?.message}
              {...contato.register("contato")}
            />
            <Actions>
              <Button type="submit" busy={busy} disabled={!faixa}>
                Pedir ajuda
              </Button>
              <Button type="button" variant="secondary" onClick={() => setStep("tipo")}>
                Voltar
              </Button>
            </Actions>
          </FormSection>
        </form>
      ) : null}
    </Shell>
  );
}
