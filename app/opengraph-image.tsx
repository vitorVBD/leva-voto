import { ImageResponse } from "next/og";

export const alt = "Leva Voto — Até a porta da seção";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "#ffffff",
        color: "#141414",
      }}
    >
      <div style={{ display: "flex", height: 18, width: "100%" }}>
        <div style={{ flex: 1, background: "#FD0000" }} />
        <div style={{ flex: 1, background: "#0034D2" }} />
        <div style={{ flex: 1, background: "#FFD400" }} />
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          justifyContent: "center",
          padding: "64px 80px",
        }}
      >
        <svg width="72" height="72" viewBox="0 0 64 64">
          <polygon
            fill="#FD0000"
            points="32,4 38.3,23.3 58.6,23.4 42.2,35.3 48.5,54.7 32,42.7 15.5,54.7 21.8,35.3 5.4,23.4 25.7,23.3"
          />
        </svg>
        <div
          style={{
            marginTop: 28,
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: 3,
            color: "#0034D2",
          }}
        >
          LEVA VOTO
        </div>
        <div
          style={{
            marginTop: 12,
            fontSize: 84,
            fontWeight: 800,
            lineHeight: 0.95,
            letterSpacing: -2,
          }}
        >
          Até a porta da seção
        </div>
        <div style={{ marginTop: 28, fontSize: 32, color: "#55555E" }}>
          Encontre sua seção e peça ajuda para chegar.
        </div>
      </div>
    </div>,
    { ...size },
  );
}
