"use client";

import Link from "next/link";
import { Organizacao } from "@/components/organizacao";
import { Actions, Body, buttonVariants, Card, Screen, Title } from "@/lib/design";

export default function Home() {
  return (
    <Screen>
      <p className="text-sm font-bold tracking-wide text-primary uppercase">Leva Voto</p>
      <Title>Até a porta da seção</Title>
      <Body>
        Ache o local de votação, monte a rota e, se precisar, peça companhia para chegar. Seus dados de contato só
        aparecem para quem aceitar ajudar.
      </Body>
      <Actions>
        <Link href="/eleitor" className={buttonVariants()}>
          Encontrar minha seção
        </Link>
        <Link href="/voluntario" className={buttonVariants({ variant: "secondary" })}>
          Quero ser voluntário
        </Link>
      </Actions>
      <Card>
        <Body muted>
          Os locais de votação vêm da base aberta do TSE de 2026. Se a seção não aparecer, confirme zona e seção na
          consulta oficial.
        </Body>
      </Card>
      <Organizacao />
    </Screen>
  );
}
