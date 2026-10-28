import React from "react";

// Pantalla de carga de marca: un changuito empujando el carrito del súper.
export default function ChanguitoLoader(props: { label?: string; fullScreen?: boolean }) {
  const fullScreen = props.fullScreen !== false;
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={props.label ?? "Cargando Changuito Express"}
      style={{
        minHeight: fullScreen ? "100dvh" : "220px",
        background: fullScreen ? "var(--bg-base)" : "transparent",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "18px",
      }}
    >
      <style>{`
        .chl-stage { position: relative; width: 190px; height: 92px; overflow: hidden; }
        .chl-road { position: absolute; left: 0; right: 0; bottom: 6px; height: 3px; border-radius: 3px; background: repeating-linear-gradient(90deg, rgba(217,154,37,.7) 0 18px, transparent 18px 32px); animation: chl-road .7s linear infinite; }
        .chl-crew { position: absolute; left: 50%; bottom: 10px; display: flex; align-items: flex-end; margin-left: -62px; animation: chl-bob .5s ease-in-out infinite; }
        .chl-monkey { font-size: 50px; line-height: 1; margin-right: -6px; transform-origin: 50% 90%; animation: chl-lean .5s ease-in-out infinite; }
        .chl-cart { font-size: 52px; line-height: 1; filter: drop-shadow(0 4px 3px rgba(0,0,0,.18)); transform: scaleX(-1); }
        .chl-dust { position: absolute; bottom: 8px; width: 7px; height: 7px; border-radius: 50%; background: rgba(120,120,120,.35); animation: chl-dust .9s ease-out infinite; }
        @keyframes chl-road { to { background-position-x: -32px; } }
        @keyframes chl-bob { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
        @keyframes chl-lean { 0%,100% { transform: rotate(4deg); } 50% { transform: rotate(-3deg); } }
        @keyframes chl-dust { from { opacity: .7; transform: translateX(0) scale(.6); } to { opacity: 0; transform: translateX(-26px) scale(1.5); } }
        @media (prefers-reduced-motion: reduce) { .chl-road, .chl-crew, .chl-monkey, .chl-dust { animation: none; } }
      `}</style>
      <div className="chl-stage" aria-hidden="true">
        <span className="chl-dust" style={{ left: "46px" }} />
        <span className="chl-dust" style={{ left: "58px", animationDelay: ".35s" }} />
        <div className="chl-crew">
          <span className="chl-monkey">🐒</span>
          <span className="chl-cart">🛒</span>
        </div>
        <div className="chl-road" />
      </div>
      <div style={{ textAlign: "center", lineHeight: 1.15 }}>
        <div style={{ fontSize: "12px", fontWeight: 900, letterSpacing: ".18em", color: "var(--text-primary)" }}>CHANGUITO EXPRESS</div>
        <div style={{ marginTop: "5px", fontSize: "11px", color: "var(--text-muted)" }}>{props.label ?? "Preparando tu mandado…"}</div>
      </div>
    </div>
  );
}
