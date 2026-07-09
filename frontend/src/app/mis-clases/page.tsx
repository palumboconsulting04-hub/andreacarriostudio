const C = { burgundy: "#7d2b13", blush: "#ffdbd1", bg: "#f5ede8", brown: "#56423d" };
const fSerif = "var(--font-playfair), 'Playfair Display', Georgia, serif";

// Placeholder (Fase 1). La Fase 2 lo sustituye por el panel real: login por email,
// calendario en vivo y reserva de clases con el bono.
export default function MisClases() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-16 text-center" style={{ backgroundColor: C.bg }}>
      <div className="w-20 h-20 rounded-full flex items-center justify-center mb-8 text-4xl" style={{ backgroundColor: C.blush }}>🗓️</div>
      <h1 className="text-3xl sm:text-4xl mb-4" style={{ fontFamily: fSerif, color: C.burgundy }}>Tu panel llega enseguida</h1>
      <p className="text-base max-w-md leading-relaxed" style={{ color: C.brown }}>
        Estamos terminando tu panel de reservas. En cuanto esté, podrás entrar con tu correo y elegir el día de tus clases. Te avisaremos. 🤎
      </p>
    </div>
  );
}
