"use client";

import { useState } from "react";

// Pie de página legal: Privacidad, Términos y Contacto como ventanas emergentes.
// Reutiliza el estilo del modal de privacidad del paso de pago para mantener la
// coherencia visual en toda la web.

type ModalKey = "privacidad" | "terminos" | "contacto";

function Modal({ titulo, onClose, children }: { titulo: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ backgroundColor: "rgba(37,25,15,0.6)" }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg max-h-[80vh] overflow-y-auto rounded-3xl p-8"
        style={{ backgroundColor: "#fff8f5", boxShadow: "0 8px 40px rgba(37,25,15,0.2)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-5 right-5 text-sm font-semibold hover:opacity-70" style={{ color: "#89726c" }}>✕</button>
        <h2 className="text-2xl mb-6 pr-8" style={{ fontFamily: "var(--font-playfair), 'Playfair Display', Georgia, serif", color: "#7d2b13" }}>
          {titulo}
        </h2>
        <div className="space-y-4 text-sm leading-relaxed" style={{ color: "#56423d" }}>
          {children}
        </div>
        <button onClick={onClose} className="mt-6 w-full py-3 rounded-full text-sm font-semibold tracking-widest uppercase" style={{ backgroundColor: "#7d2b13", color: "#ffffff" }}>
          Cerrar
        </button>
      </div>
    </div>
  );
}

function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="font-semibold mb-1" style={{ color: "#25190f" }}>{titulo}</p>
      <p>{children}</p>
    </div>
  );
}

export default function FooterLegal() {
  const [abierto, setAbierto] = useState<ModalKey | null>(null);

  const links: { key: ModalKey; label: string }[] = [
    { key: "privacidad", label: "Privacidad" },
    { key: "terminos", label: "Términos" },
    { key: "contacto", label: "Contacto" },
  ];

  return (
    <>
      <div className="flex justify-center gap-6">
        {links.map((l) => (
          <button
            key={l.key}
            type="button"
            onClick={() => setAbierto(l.key)}
            className="text-xs tracking-widest uppercase transition-colors hover:opacity-80"
            style={{
              color: "#89726c",
              fontFamily: "var(--font-montserrat), 'Montserrat', sans-serif",
              letterSpacing: "0.1em",
            }}
          >
            {l.label}
          </button>
        ))}
      </div>

      {abierto === "privacidad" && (
        <Modal titulo="Política de Privacidad" onClose={() => setAbierto(null)}>
          <Bloque titulo="Responsable del tratamiento">
            Andrea Carrió, titular de Andrea Carrió Studio, C/ Motilla del Palancar 34, Alfahuir (Valencia). Contacto: andreacarriostudio@gmail.com
          </Bloque>
          <Bloque titulo="Finalidad">
            Gestionar la inscripción, impartir las clases, cobrar las cuotas, cumplir las obligaciones fiscales y contables y adaptar la práctica a la información médica facilitada.
          </Bloque>
          <Bloque titulo="Base jurídica">
            Ejecución del contrato de prestación del servicio y cumplimiento de obligaciones legales (RGPD, art. 6.1.b y c). Para datos de salud, su consentimiento explícito (RGPD, art. 9.2.a).
          </Bloque>
          <Bloque titulo="Conservación">
            Durante la relación con el estudio y, una vez finalizada, durante los plazos legalmente exigidos (hasta 6 años a efectos fiscales).
          </Bloque>
          <Bloque titulo="Destinatarios">
            No se cederán datos a terceros salvo obligación legal. Los pagos se procesan a través de Stripe Payments Europe, Ltd. como encargado del tratamiento.
          </Bloque>
          <Bloque titulo="Derechos">
            Puede ejercer los derechos de acceso, rectificación, supresión, oposición, limitación y portabilidad escribiendo a andreacarriostudio@gmail.com.
          </Bloque>
          <Bloque titulo="Menores">
            El tratamiento de datos de alumnas menores de 14 años requiere el consentimiento de su madre, padre o tutor legal (art. 7 LOPDGDD).
          </Bloque>
        </Modal>
      )}

      {abierto === "terminos" && (
        <Modal titulo="Términos y Condiciones" onClose={() => setAbierto(null)}>
          <Bloque titulo="1. Titular">
            Andrea Carrió Studio, titularidad de Andrea Carrió Caselles (DNI/NIF [pendiente de completar]), con domicilio en C/ Motilla del Palancar 34, Alfahuir (Valencia) y correo de contacto andreacarriostudio@gmail.com.
          </Bloque>
          <Bloque titulo="2. Objeto">
            Estas condiciones regulan la inscripción y la participación en las clases y actividades impartidas por el estudio, así como las condiciones económicas asociadas.
          </Bloque>
          <Bloque titulo="3. Inscripción y matrícula">
            La inscripción se formaliza al completar el formulario y abonar la matrícula. La matrícula es un pago anual único por curso, que da derecho a la reserva de plaza, la evaluación inicial y el material de bienvenida. La matrícula no es reembolsable una vez iniciado el curso, salvo que el estudio no pueda prestar el servicio.
          </Bloque>
          <Bloque titulo="4. Cuotas (bono mensual)">
            El importe del bono mensual depende del plan elegido y se indica en el momento de la inscripción. El bono se cobra de forma automática y recurrente en la tarjeta facilitada a partir del 1 de septiembre y, después, cada mes mientras se mantenga el alta. La primera mensualidad no se cobra hasta esa fecha.
          </Bloque>
          <Bloque titulo="5. Forma de pago">
            Los pagos se realizan con tarjeta a través de la pasarela segura Stripe. Al inscribirse, la alumna (o su tutor) autoriza el cobro de la matrícula y la domiciliación del bono mensual en dicha tarjeta.
          </Bloque>
          <Bloque titulo="6. Baja y cancelación">
            No existe permanencia mínima. La baja puede solicitarse en cualquier momento escribiendo a Andrea (andreacarriostudio@gmail.com) antes de la fecha del siguiente cobro mensual. Las cuotas ya cobradas correspondientes a meses iniciados no se reembolsan.
          </Bloque>
          <Bloque titulo="7. Impago">
            La falta de pago de una cuota podrá suspender el derecho de asistencia a las clases hasta su regularización.
          </Bloque>
          <Bloque titulo="8. Calendario y clases">
            Las clases siguen el calendario del curso del estudio, respetando los días festivos. El estudio podrá reprogramar clases puntuales por causas justificadas, ofreciendo alternativas de recuperación según disponibilidad.
          </Bloque>
          <Bloque titulo="9. Alumnas menores de edad">
            La inscripción de menores la realiza su madre, padre o tutor legal, que acepta estas condiciones en su nombre y se responsabiliza de su veracidad.
          </Bloque>
          <Bloque titulo="10. Derechos de imagen">
            El estudio no captará ni publicará imágenes de las alumnas sin un consentimiento específico y separado, que podrá otorgarse o revocarse en cualquier momento.
          </Bloque>
          <Bloque titulo="11. Responsabilidad">
            La alumna (o su tutor) declara encontrarse en condiciones físicas adecuadas para la práctica. El estudio no se responsabiliza de los objetos personales depositados en sus instalaciones.
          </Bloque>
          <Bloque titulo="12. Modificaciones">
            El estudio podrá modificar horarios, profesorado o estas condiciones por causas organizativas justificadas, comunicándolo con antelación razonable.
          </Bloque>
          <Bloque titulo="13. Protección de datos">
            El tratamiento de los datos personales se rige por la Política de Privacidad, disponible en esta misma web.
          </Bloque>
          <Bloque titulo="14. Legislación y fuero">
            Estas condiciones se rigen por la legislación española. Para cualquier controversia, las partes se someten a los juzgados y tribunales de Valencia, salvo que la normativa de consumo establezca otro fuero.
          </Bloque>
        </Modal>
      )}

      {abierto === "contacto" && (
        <Modal titulo="Contacto" onClose={() => setAbierto(null)}>
          <Bloque titulo="Andrea Carrió Studio">
            C/ Motilla del Palancar 34, Alfahuir (Valencia).
          </Bloque>
          <Bloque titulo="Email">
            <a href="mailto:andreacarriostudio@gmail.com" className="underline hover:opacity-70" style={{ color: "#7d2b13" }}>
              andreacarriostudio@gmail.com
            </a>
          </Bloque>
          <Bloque titulo="Teléfono">
            <a href="tel:+34614679291" className="underline hover:opacity-70" style={{ color: "#7d2b13" }}>
              +34 614 679 291
            </a>
          </Bloque>
          <Bloque titulo="WhatsApp">
            <a href="https://chat.whatsapp.com/Gi2SUxvVc0xCqtw8egpkQu?mode=gi_t" target="_blank" rel="noopener noreferrer" className="underline hover:opacity-70" style={{ color: "#7d2b13" }}>
              Únete a nuestro grupo de WhatsApp
            </a>
          </Bloque>
        </Modal>
      )}
    </>
  );
}
