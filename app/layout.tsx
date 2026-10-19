import type { Metadata, Viewport } from "next";
import { Archivo, Barlow_Condensed, Montserrat } from "next/font/google";
import Script from "next/script";
import { Pwa } from "@/components/pwa";
import "./globals.css";

const sans = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat",
  display: "swap",
});

const condensed = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["700", "800", "900"],
  variable: "--font-barlow",
  display: "swap",
});

const display = Archivo({
  subsets: ["latin"],
  weight: ["800", "900"],
  variable: "--font-archivo",
  display: "swap",
});

const siteUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Leva Voto — Até a porta da seção",
  description: "Encontre sua seção eleitoral e peça ajuda para chegar, com privacidade.",
  applicationName: "Leva Voto",
  openGraph: {
    title: "Leva Voto — Até a porta da seção",
    description: "Encontre sua seção eleitoral e peça ajuda para chegar, com privacidade.",
    siteName: "Leva Voto",
    locale: "pt_BR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Leva Voto — Até a porta da seção",
    description: "Encontre sua seção eleitoral e peça ajuda para chegar, com privacidade.",
  },
};

export const viewport: Viewport = {
  themeColor: "#0034D2",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`light ${sans.variable} ${condensed.variable} ${display.variable} h-full`} style={{ colorScheme: "light" }}>
      <body className="min-h-full font-sans text-[17px] leading-6 antialiased">
        <Script src="https://barra.comitedetecnologia.com.br/barra.js" strategy="afterInteractive" />
        <a
          href="#conteudo"
          className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-3 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-3 focus:font-bold focus:text-primary-foreground"
        >
          Ir para o conteúdo
        </a>
        <Pwa />
        <div id="conteudo">{children}</div>
      </body>
    </html>
  );
}
