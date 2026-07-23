"use client";

// Botón de imprimir (no sale en el papel).
export default function BotonImprimir() {
  return (
    <div className="no-print" style={{ textAlign: "center", margin: "0 0 24px" }}>
      <button
        onClick={() => window.print()}
        style={{
          backgroundColor: "#7d2b13", color: "#fff8f5", border: "none",
          borderRadius: "9999px", padding: "14px 32px", fontSize: "15px",
          fontWeight: 700, cursor: "pointer",
        }}
      >
        🖨️ Imprimir la lista
      </button>
      <p style={{ fontSize: "13px", color: "#89726c", marginTop: "10px" }}>
        Se imprime una hoja por turno. También puedes guardarlo en PDF eligiendo
        «Guardar como PDF» en el destino de la impresora.
      </p>
    </div>
  );
}
