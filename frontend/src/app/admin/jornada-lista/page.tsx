import { supabaseAdmin } from "@/lib/supabase-admin";
import { SLOTS, EVENTO } from "@/lib/jornada";
import BotonImprimir from "./BotonImprimir";

// Hoja imprimible del pase de lista de la Jornada de Puertas Abiertas.
// Una hoja por turno (día + hora + disciplina), con las columnas que se rellenan
// a mano el mismo día. Sin teléfono ni email: el papel se fotografía después y
// los datos se pasan al admin. Protegida por el middleware de /admin.

export const dynamic = "force-dynamic";

type Reserva = { id: string; nombre: string; nombre_madre: string | null; slot_id: string };
type Espera = { id: string; nombre: string; nombre_madre: string | null; telefono: string | null; slot_id: string };

const FILAS_EXTRA = 3; // filas en blanco para quien venga sin reserva

function Casilla() {
  return (
    <span style={{ display: "inline-block", width: "16px", height: "16px", border: "1.5px solid #555", borderRadius: "3px" }} />
  );
}

export default async function JornadaListaPage() {
  const [{ data: rRes }, { data: rEsp }] = await Promise.all([
    supabaseAdmin.from("reservas_jornada").select("id, nombre, nombre_madre, slot_id"),
    supabaseAdmin.from("lista_espera_jornada").select("id, nombre, nombre_madre, telefono, slot_id"),
  ]);
  const reservas = (rRes ?? []) as Reserva[];
  const espera = (rEsp ?? []) as Espera[];

  const th: React.CSSProperties = {
    border: "1px solid #999", padding: "6px 8px", fontSize: "11px",
    textTransform: "uppercase", letterSpacing: "0.5px", background: "#f2e9e4", textAlign: "left",
  };
  const td: React.CSSProperties = { border: "1px solid #999", padding: "9px 8px", fontSize: "13px", height: "30px" };
  const tdC: React.CSSProperties = { ...td, textAlign: "center" };

  return (
    <div style={{ background: "#fff", color: "#111", padding: "24px", fontFamily: "Arial, Helvetica, sans-serif" }}>
      <style>{`
        @page { size: A4; margin: 12mm; }
        @media print {
          .no-print { display: none !important; }
          .hoja { break-after: page; }
          .hoja:last-child { break-after: auto; }
          tr { break-inside: avoid; }
        }
      `}</style>

      <BotonImprimir />

      {SLOTS.map((slot) => {
        const esNinas = slot.bloque === "ninas";
        const lista = reservas
          .filter((r) => r.slot_id === slot.id)
          .sort((a, b) => (a.nombre || "").localeCompare(b.nombre || "", "es"));

        return (
          <section key={slot.id} className="hoja" style={{ marginBottom: "36px" }}>
            {/* Cabecera de la hoja */}
            <div style={{ borderBottom: "3px solid #7d2b13", paddingBottom: "8px", marginBottom: "4px" }}>
              <p style={{ margin: 0, fontSize: "12px", letterSpacing: "2px", color: "#7d2b13", fontWeight: 700 }}>
                ANDREA CARRIÓ STUDIO · {EVENTO.titulo.toUpperCase()}
              </p>
              <h1 style={{ margin: "6px 0 0", fontSize: "22px", color: "#111" }}>
                {slot.dia.toUpperCase()} · {slot.hora}
              </h1>
              <p style={{ margin: "2px 0 0", fontSize: "17px", fontWeight: 700, color: "#7d2b13" }}>
                {slot.titulo}
              </p>
            </div>
            <p style={{ margin: "0 0 10px", fontSize: "12px", color: "#555" }}>
              {lista.length} reservadas de {slot.tope} plazas
            </p>

            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ ...th, width: "26px", textAlign: "center" }}>#</th>
                  <th style={th}>{esNinas ? "Niña" : "Nombre"}</th>
                  {esNinas && <th style={th}>Madre / Padre</th>}
                  <th style={{ ...th, width: "52px", textAlign: "center" }}>Vino</th>
                  <th style={{ ...th, width: "52px", textAlign: "center" }}>Pagó</th>
                  <th style={{ ...th, width: "120px" }}>Forma de pago</th>
                  <th style={{ ...th, width: esNinas ? "150px" : "230px" }}>Comentario</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((r, i) => (
                  <tr key={r.id}>
                    <td style={tdC}>{i + 1}</td>
                    <td style={{ ...td, fontWeight: 600 }}>{r.nombre}</td>
                    {esNinas && <td style={td}>{r.nombre_madre || ""}</td>}
                    <td style={tdC}><Casilla /></td>
                    <td style={tdC}><Casilla /></td>
                    <td style={td} />
                    <td style={td} />
                  </tr>
                ))}
                {/* Filas en blanco: alguien que viene sin haber reservado */}
                {Array.from({ length: FILAS_EXTRA }).map((_, i) => (
                  <tr key={`extra-${i}`}>
                    <td style={{ ...tdC, color: "#aaa" }}>{lista.length + i + 1}</td>
                    <td style={td} />
                    {esNinas && <td style={td} />}
                    <td style={tdC}><Casilla /></td>
                    <td style={tdC}><Casilla /></td>
                    <td style={td} />
                    <td style={td} />
                  </tr>
                ))}
              </tbody>
            </table>

            <p style={{ marginTop: "14px", fontSize: "13px", color: "#333" }}>
              Vinieron: <strong>______</strong> &nbsp;·&nbsp; Se apuntaron: <strong>______</strong>
            </p>
          </section>
        );
      })}

      {/* Hoja final: lista de espera (aquí SÍ el teléfono, es para llamarlas) */}
      {espera.length > 0 && (
        <section className="hoja">
          <div style={{ borderBottom: "3px solid #7d2b13", paddingBottom: "8px", marginBottom: "10px" }}>
            <p style={{ margin: 0, fontSize: "12px", letterSpacing: "2px", color: "#7d2b13", fontWeight: 700 }}>
              ANDREA CARRIÓ STUDIO · {EVENTO.titulo.toUpperCase()}
            </p>
            <h1 style={{ margin: "6px 0 0", fontSize: "22px" }}>LISTA DE ESPERA</h1>
            <p style={{ margin: "2px 0 0", fontSize: "13px", color: "#555" }}>
              Si alguien no viene, llama a la siguiente de su turno.
            </p>
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ ...th, width: "26px", textAlign: "center" }}>#</th>
                <th style={th}>Turno</th>
                <th style={th}>Nombre</th>
                <th style={{ ...th, width: "120px" }}>Teléfono</th>
                <th style={{ ...th, width: "60px", textAlign: "center" }}>Avisada</th>
                <th style={{ ...th, width: "170px" }}>Comentario</th>
              </tr>
            </thead>
            <tbody>
              {espera.map((e, i) => {
                const s = SLOTS.find((x) => x.id === e.slot_id);
                return (
                  <tr key={e.id}>
                    <td style={tdC}>{i + 1}</td>
                    <td style={{ ...td, fontSize: "12px" }}>{s ? `${s.dia.replace(" de julio", "")} · ${s.hora} · ${s.titulo}` : e.slot_id}</td>
                    <td style={{ ...td, fontWeight: 600 }}>{e.nombre}{e.nombre_madre ? ` (${e.nombre_madre})` : ""}</td>
                    <td style={td}>{e.telefono || ""}</td>
                    <td style={tdC}><Casilla /></td>
                    <td style={td} />
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
