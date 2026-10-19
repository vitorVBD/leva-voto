"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Organizacao } from "@/components/organizacao";
import { Body, Button, Screen, Title } from "@/lib/design";

export function Shell({
  title,
  lede,
  width = "reading",
  children,
}: {
  title: string;
  lede?: string;
  width?: "reading" | "board";
  children: ReactNode;
}) {
  const router = useRouter();

  function voltar() {
    if (window.history.length > 1) {
      router.back();
      return;
    }
    router.push("/");
  }

  return (
    <Screen width={width}>
      <Button type="button" variant="secondary" size="compact" onClick={voltar}>
        Voltar
      </Button>
      <Link
        href="/"
        className="w-fit rounded-sm text-sm font-bold text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
      >
        Leva Voto
      </Link>
      <Title>{title}</Title>
      {lede ? <Body muted>{lede}</Body> : null}
      {children}
      <Organizacao />
    </Screen>
  );
}
