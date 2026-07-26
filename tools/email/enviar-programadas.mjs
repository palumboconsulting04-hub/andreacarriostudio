// Procesa las campañas de email PROGRAMADAS cuya hora ya ha llegado.
// Corre desde GitHub Actions (sin npm install) con fetch nativo contra la REST
// de Supabase y la de Resend. Reutiliza los mismos secretos que el informe.
//
// Clave: la lista se guardó al programar, pero AQUÍ se re-filtra contra
// compradoras y bajas del momento, para no escribir a quien ya compró.
//
// La plantilla HTML es un espejo de la de frontend/src/app/api/admin/
// email-enviar/route.ts — si cambias una, cambia la otra.

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@andreacarriostudio.es';
const FROM = FROM_EMAIL.includes('<') ? FROM_EMAIL : `Andrea Carrió Studio <${FROM_EMAIL}>`;
const REPLY_TO = 'andreacarriostudio@gmail.com';
const PAGADAS = ['pagato', 'pagado', 'activa', 'matricula_pagada'];

if (!SUPA_URL || !SUPA_KEY || !RESEND_KEY) {
  console.error('Faltan variables: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / RESEND_API_KEY');
  process.exit(1);
}

const norm = (e) => (typeof e === 'string' ? e.trim().toLowerCase() : '');
const esc = (s) => String(s ?? '').replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
const esUrlSegura = (u) => /^https?:\/\//i.test((u || '').trim());
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Espejo de email-enviar/route.ts: quita un saludo escrito al principio.
const RE_SALUDO_INICIAL = /^[\s¡!]*(?:hola+|holi+|hey|buenas(?:\s+tardes|\s+noches)?|buenos?\s+d[ií]as)\b[^\n,!:]{0,25}[,!:\n]+[ \t]*\n?/i;

async function sbGet(path) {
  const res = await fetch(`${SUPA_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
  });
  if (!res.ok) throw new Error(`Supabase GET ${res.status} — ${path} — ${await res.text()}`);
  return res.json();
}

async function sbWrite(path, method, body, prefer = '') {
  const res = await fetch(`${SUPA_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`,
      'Content-Type': 'application/json', ...(prefer ? { Prefer: prefer } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Supabase ${method} ${res.status} — ${path} — ${await res.text()}`);
  const txt = await res.text();
  return txt ? JSON.parse(txt) : null;
}

function plantilla(nombre, cuerpo, urlBaja, extra = {}) {
  const saludo = nombre ? `¡Hola ${esc(String(nombre).split(' ')[0])}!` : '¡Hola!';
  const parrafos = String(cuerpo).replace(RE_SALUDO_INICIAL, '').split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 16px;line-height:1.65;">${esc(p).replace(/\n/g, '<br/>')}</p>`).join('');
  const imagen = extra.imagenUrl && esUrlSegura(extra.imagenUrl)
    ? `<img src="${extra.imagenUrl}" alt="" style="width:100%;max-width:512px;border-radius:14px;display:block;margin:0 0 22px;" />` : '';
  const cta = extra.ctaTexto && esUrlSegura(extra.ctaUrl)
    ? `<div style="text-align:center;margin:26px 0 4px;"><a href="${extra.ctaUrl}" style="display:inline-block;background:#7d2b13;color:#fff8f5;text-decoration:none;font-size:15px;font-weight:700;padding:14px 34px;border-radius:9999px;">${esc(extra.ctaTexto)} →</a></div>` : '';
  return `<div style="font-family:Arial,Helvetica,sans-serif;color:#25190f;max-width:560px;margin:0 auto;padding:28px 24px;background:#fff8f5;">
  ${imagen}
  <p style="font-size:13px;letter-spacing:2px;color:#7d2b13;font-weight:700;margin:0 0 20px;">ANDREA CARRIÓ STUDIO</p>
  <p style="margin:0 0 16px;font-size:16px;font-weight:600;">${saludo}</p>
  <div style="font-size:15px;color:#3d2b23;">${parrafos}</div>
  ${cta}
  <p style="margin:24px 0 0;font-size:15px;color:#3d2b23;line-height:1.6;">Un abrazo,<br/><strong style="color:#7d2b13;">Andrea</strong> 🤎</p>
  <div style="margin-top:28px;padding-top:18px;border-top:1px solid #dcc1b9;font-size:12px;color:#89726c;line-height:1.6;">
    Andrea Carrió Studio · Danza &amp; Pilates · C/ Motilla del Palancar 34 bajo, 46019 Valencia<br/>
    ¿No quieres recibir más correos? <a href="${urlBaja}" style="color:#7d2b13;">Darme de baja</a>
  </div>
</div>`;
}

async function enviarResend(to, subject, html, urlBaja) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, replyTo: REPLY_TO, to, subject, html, headers: { 'List-Unsubscribe': `<${urlBaja}>` } }),
  });
  if (!res.ok) throw new Error(await res.text());
}

async function excluidos() {
  const [isc, bon, baj] = await Promise.all([
    sbGet(`iscrizioni?select=email,stato&stato=in.(${PAGADAS.join(',')})`),
    sbGet('bonos?select=email'),
    sbGet('email_bajas?select=email'),
  ]);
  const fuera = new Set();
  for (const r of [...isc, ...bon, ...baj]) { const e = norm(r.email); if (e) fuera.add(e); }
  return fuera;
}

async function procesar(camp, fuera) {
  const dest = Array.isArray(camp.destinatarios) ? camp.destinatarios : [];
  const lista = dest.filter((d) => d && d.email && !fuera.has(norm(d.email)));
  const extra = { imagenUrl: camp.imagen_url, ctaTexto: camp.cta_texto, ctaUrl: camp.cta_url };

  let ok = 0, ko = 0;
  const registros = [];
  // Resend limita a 10/seg → tandas de 8 con ~1,1s entre ellas, y un reintento.
  const LOTE = 8;
  const enviarUno = async (d) => {
    for (let intento = 0; intento < 2; intento++) {
      try {
        await enviarResend(d.email, camp.asunto, plantilla(d.nombre, camp.cuerpo, d.baja || '', extra), d.baja || '');
        return { email: d.email, ok: true, error: null };
      } catch (e) {
        if (intento === 0) { await sleep(1300); continue; }
        return { email: d.email, ok: false, error: String(e.message || e).slice(0, 300) };
      }
    }
    return { email: d.email, ok: false, error: 'no enviado' };
  };
  for (let i = 0; i < lista.length; i += LOTE) {
    const res = await Promise.all(lista.slice(i, i + LOTE).map(enviarUno));
    for (const r of res) { if (r.ok) ok++; else ko++; registros.push(r); }
    if (i + LOTE < lista.length) await sleep(1100);
  }

  // Registro histórico (misma tabla que los envíos inmediatos).
  let campanaId = null;
  try {
    const [row] = await sbWrite('email_campanas', 'POST',
      { segmento: camp.segmento, asunto: camp.asunto, cuerpo: camp.cuerpo, enviados: ok, fallidos: ko },
      'return=representation');
    campanaId = row?.id ?? null;
  } catch (e) { console.error('email_campanas:', e.message); }
  if (campanaId && registros.length) {
    try {
      await sbWrite('email_envios', 'POST',
        registros.map((r) => ({ campana_id: campanaId, email: r.email, ok: r.ok, error: r.error })), 'return=minimal');
    } catch (e) { console.error('email_envios:', e.message); }
  }

  await sbWrite(`email_programadas?id=eq.${camp.id}`, 'PATCH',
    { estado: 'enviada', enviados: ok, fallidos: ko, enviada_at: new Date().toISOString() });
  console.log(`Campaña ${camp.id} (${camp.segmento}) enviada: ${ok} ok · ${ko} fallidos`);
}

async function main() {
  const ahora = new Date().toISOString();
  const pendientes = await sbGet(
    `email_programadas?estado=eq.pendiente&programado_para=lte.${ahora}&select=*&order=programado_para.asc`);
  if (!pendientes.length) { console.log('No hay campañas pendientes.'); return; }

  const fuera = await excluidos();
  for (const camp of pendientes) {
    // "Claim": marca como enviando solo si sigue pendiente (evita doble envío si
    // dos ejecuciones se solapan).
    let claimed;
    try {
      claimed = await sbWrite(
        `email_programadas?id=eq.${camp.id}&estado=eq.pendiente`, 'PATCH',
        { estado: 'enviando' }, 'return=representation');
    } catch (e) { console.error('claim:', e.message); continue; }
    if (!Array.isArray(claimed) || claimed.length === 0) { console.log(`Campaña ${camp.id} ya tomada, salto.`); continue; }

    try {
      await procesar(camp, fuera);
    } catch (e) {
      console.error(`Campaña ${camp.id} ERROR:`, e.message);
      try {
        await sbWrite(`email_programadas?id=eq.${camp.id}`, 'PATCH',
          { estado: 'error', error: String(e.message || e).slice(0, 500) });
      } catch {}
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
