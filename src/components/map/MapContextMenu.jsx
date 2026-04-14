export default function MapContextMenu({ contextMenuState, onClose, onCopy }) {
  if (!contextMenuState) return null;

  return (
    <div
      data-export-ignore="true"
      onClick={(event) => event.stopPropagation()}
      style={{
        position: "absolute",
        left: contextMenuState.left,
        top: contextMenuState.top,
        zIndex: 20010,
        width: 318,
        minHeight: 112,
        borderRadius: 22,
        background: "rgba(255,255,255,0.97)",
        border: "1px solid rgba(0,0,0,0.08)",
        boxShadow: "0 22px 46px rgba(0,0,0,0.22)",
        backdropFilter: "blur(14px)",
        overflow: "hidden",
        display: "flex",
      }}
    >
      <div
        style={{
          position: "relative",
          width: 88,
          flex: "0 0 88px",
          background: "linear-gradient(180deg, #bc955b 0%, #9f2241 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        <span
          style={{
            position: "absolute",
            right: -26,
            top: 0,
            bottom: 0,
            width: 54,
            background: "rgba(255,255,255,0.96)",
            clipPath: "polygon(0 0, 100% 0, 100% 100%, 0 100%, 62% 50%)",
          }}
        />
        <span
          style={{
            width: 44,
            height: 44,
            borderRadius: 999,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            border: "1px solid rgba(255,255,255,0.34)",
            background: "rgba(255,255,255,0.12)",
            boxShadow: "0 10px 18px rgba(58,20,32,0.14)",
            zIndex: 1,
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M12 21s6-5.2 6-11a6 6 0 10-12 0c0 5.8 6 11 6 11zm0-8.2a2.8 2.8 0 110-5.6 2.8 2.8 0 010 5.6z"
              fill="currentColor"
            />
          </svg>
        </span>
      </div>
      <div
        style={{
          position: "relative",
          flex: 1,
          padding: "14px 14px 12px 18px",
          display: "grid",
          alignContent: "center",
          gap: 10,
        }}
      >
        <button
          type="button"
          aria-label="Cerrar"
          onClick={(event) => {
            event.stopPropagation();
            onClose();
          }}
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            width: 28,
            height: 28,
            border: "none",
            borderRadius: 999,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            color: "#7d7d7d",
            background: "rgba(0,0,0,0.05)",
            transition: "background 120ms ease, color 120ms ease, transform 120ms ease",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M6 6l12 12M18 6L6 18"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>
        <div style={{ display: "grid", gap: 3, paddingRight: 18 }}>
          <strong style={{ fontSize: 13, color: "#202020" }}>Coordenadas del punto</strong>
          <span
            style={{
              fontSize: 14,
              color: "#3a3a3a",
              fontVariantNumeric: "tabular-nums",
              letterSpacing: "0.01em",
            }}
          >
            {contextMenuState.coordsText}
          </span>
        </div>
        <button
          type="button"
          onClick={() => onCopy(contextMenuState.coordsText)}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            padding: "11px 12px",
            borderRadius: 14,
            border: "1px solid rgba(122,29,49,0.14)",
            background: contextMenuState.copied
              ? "linear-gradient(135deg, rgba(36,133,93,0.12), rgba(77,187,133,0.18))"
              : "linear-gradient(135deg, rgba(122,29,49,0.08), rgba(188,149,91,0.18))",
            color: contextMenuState.copied ? "#1f6b4c" : "#7a1d31",
            cursor: "pointer",
            transition: "transform 120ms ease, box-shadow 120ms ease, background 120ms ease",
            boxShadow: "0 10px 20px rgba(0,0,0,0.08)",
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 700, fontSize: 12.5 }}>
            <span
              style={{
                width: 28,
                height: 28,
                borderRadius: 999,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(255,255,255,0.7)",
              }}
            >
              {contextMenuState.copied ? (
                <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M20 7L10 17l-5-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="9" y="9" width="10" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
                  <path d="M7 15H6a2 2 0 01-2-2V6a2 2 0 012-2h7a2 2 0 012 2v1" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              )}
            </span>
            {contextMenuState.copied ? "Coordenadas copiadas" : "Copiar coordenadas"}
          </span>
          <span style={{ fontSize: 11.5, opacity: 0.78 }}>
            {contextMenuState.copied ? "Listo" : "Click"}
          </span>
        </button>
      </div>
    </div>
  );
}
