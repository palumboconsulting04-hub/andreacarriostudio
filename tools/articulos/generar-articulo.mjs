#!/usr/bin/env node
// generar-articulo.mjs — Andrea Carrió Studio
// Publica automáticamente un artículo al día en WordPress a partir de la cola
// de temas (temas.json). La IA (Claude) escribe SOLO el texto; el HTML, los
// enlaces internos, el CTA y el schema FAQ los pone este script (diseño fijo).
//
// Salvaguardas:
//  - Toma el primer tema de la cola cuyo slug NO exista ya en WordPress.
//  - Si la generación falla o sale corta (<600 palabras) -> se guarda como
//    BORRADOR en vez de publicarse en vivo. Nunca sale contenido roto solo.
//  - Si la cola está agotada -> avisa por email y no inventa nada.
//  - Envía un email en cada publicación (con el enlace) para poder retirarlo.
//
// Uso:
//   node tools/articulos/generar-articulo.mjs           # genera y publica 1
//   node tools/articulos/generar-articulo.mjs --draft   # lo deja en borrador
//   node tools/articulos/generar-articulo.mjs --dry      # no toca WordPress

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));

function loadEnvFile(path) {
  try {
    const raw = readFileSync(path, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (!m) continue;
      let val = m[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
        val = val.slice(1, -1);
      if (!(m[1] in process.env)) process.env[m[1]] = val;
    }
  } catch { /* ok */ }
}
loadEnvFile(join(HERE, '.env'));                       // para pruebas locales (no subir)
loadEnvFile(join(HERE, '..', '..', 'frontend', '.env.local'));

const args   = process.argv.slice(2);
const DRY    = args.includes('--dry');
const DRAFT  = args.includes('--draft');

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const MODELO   = process.env.ARTICULO_MODELO || 'claude-opus-4-8';
const WP_BASE  = (process.env.WP_BASE || 'https://andreacarriostudio.es').replace(/\/$/, '');
const WP_USER  = process.env.WP_USER;
const WP_APP   = process.env.WP_APP_PASSWORD;
const RESEND_KEY = process.env.RESEND_API_KEY;
const FROM     = process.env.FROM_EMAIL || 'noreply@andreacarriostudio.es';
const TO       = process.env.REPORT_TO  || 'gioacchinopalumbo38@gmail.com';

const WP_AUTH = 'Basic ' + Buffer.from(`${WP_USER}:${WP_APP}`).toString('base64');

// Página de servicio + anchor por disciplina (a donde apuntan los enlaces).
const SERVICIOS = {
  ballet:  { url: `${WP_BASE}/ballet-para-ninas/`,                 anchor: 'clases de ballet para niñas en Valencia' },
  pilates: { url: `${WP_BASE}/clases-de-pilates-valencia-alfahuir/`, anchor: 'clases de Pilates en Valencia' },
  barre:   { url: `${WP_BASE}/barre-fit-en-valencia/`,             anchor: 'clases de Barre Fit en Valencia' },
};

// Página de reservas (funnel de inscripción). Se usa como destino del CTA cuando
// el tema tiene intención alta (temas.json -> "destino": "reservas").
const RESERVAS = process.env.RESERVAS_URL || 'https://reservas.andreacarriostudio.es/';

// Fotos destacadas por disciplina (recortes uniformes 3:2, 1200x800, en Medios).
// Pilates y Barre usan FOTOS REALES del estudio; Ballet usa imágenes de ballet
// (no hay fotos reales de niñas en la biblioteca). Se elige una al azar por variedad.
const FEATURED = {
  ballet:  [3809, 3811, 3812], // niña con tutú / niña en clase / técnica
  pilates: [3814, 3808, 3810], // pilates de suelo (real) / puente / pelota
  barre:   [3815, 3816, 3813], // clase (real) / barras (real) / estiramientos (real)
};
const pickFeatured = (servicio) => {
  const arr = FEATURED[servicio] || FEATURED.barre;
  return arr[Math.floor(Math.random() * arr.length)];
};

// ---------- Sistema de diseño (mismo que los artículos ya publicados) ----------
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const link = (url, a) => `<a href="${url}" style="color:#c1592f;font-weight:600;">${esc(a)}</a>`;
const introBox = t => `<div style="background:linear-gradient(135deg,#fff0eb 0%,#fff8f5 100%);border-left:5px solid #c1592f;border-radius:14px;padding:22px 26px;margin:0 0 10px;"><p style="margin:0;font-size:18px;line-height:1.7;color:#3a2c27;">${t}</p></div>`;
const h2 = t => `<h2 style="color:#c1592f;font-size:25px;line-height:1.25;margin:36px 0 14px;padding-bottom:8px;border-bottom:2px solid #ffdbd1;">${esc(t)}</h2>`;
const p = t => `<p style="font-size:16px;line-height:1.75;color:#3a2c27;">${t}</p>`;
const card = (e, ti, tx) => `<div style="background:#fff8f5;border:1px solid #f0d9cf;border-left:4px solid #c1592f;border-radius:12px;padding:14px 18px;margin:0 0 10px;"><span style="font-size:15px;font-weight:700;color:#c1592f;">${esc(e)}&nbsp; ${esc(ti)}</span><span style="display:block;margin-top:4px;color:#56423d;line-height:1.6;">${esc(tx)}</span></div>`;
const quote = t => `<div style="background:#fbeee9;border-radius:12px;padding:18px 22px;margin:16px 0;font-style:italic;color:#c1592f;border-left:4px solid #d98c6a;">${esc(t)}</div>`;
const cta = (url, tipo = 'servicio') => {
  const t = tipo === 'reservas'
    ? { k: '¿Lista para empezar?', s: 'Reserva tu plaza en un minuto, sin complicaciones.', b: 'Reservar mi plaza →' }
    : { k: '¿Damos el primer paso?', s: 'Descubre horarios, edades y precios, y ven a conocer el estudio.', b: 'Ver más →' };
  return `<div style="background:linear-gradient(135deg,#8f3a1e,#6f2f16);border-radius:16px;padding:28px 24px;margin:30px 0 12px;text-align:center;"><p style="margin:0 0 4px;color:#ffdbd1;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">${t.k}</p><p style="margin:0 0 18px;color:#fff8f5;font-size:18px;line-height:1.5;">${t.s}</p><a href="${url}" style="display:inline-block;background:#fff8f5;color:#8f3a1e;padding:15px 34px;border-radius:9999px;text-decoration:none;font-weight:700;font-size:16px;">${t.b}</a></div>`;
};
const firma = () => `<p style="font-size:16px;color:#3a2c27;">Un abrazo. 💗<br><strong>Andrea</strong></p>`;
const faqBlock = (faqs) => {
  const vis = h2('Preguntas frecuentes') + faqs.map(f => `<div style="border:1px solid #eaddd6;border-radius:12px;padding:14px 18px;margin:0 0 10px;"><p style="margin:0 0 6px;font-weight:700;color:#c1592f;">${esc(f.q)}</p><p style="margin:0;color:#56423d;line-height:1.6;">${esc(f.a)}</p></div>`).join('');
  const ld = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqs.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) };
  return vis + `<script type="application/ld+json">${JSON.stringify(ld)}</script>`;
};

// ---------- Utilidades ----------
async function wp(path, opts = {}) {
  const res = await fetch(`${WP_BASE}/wp-json${path}`, {
    ...opts,
    headers: { Authorization: WP_AUTH, 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  const txt = await res.text();
  let data; try { data = JSON.parse(txt); } catch { data = txt; }
  if (!res.ok) throw new Error(`WP ${res.status} ${path}: ${typeof data === 'string' ? data.slice(0, 200) : JSON.stringify(data).slice(0, 200)}`);
  return data;
}

async function slugsExistentes() {
  const set = new Set();
  const estados = 'publish,draft,future,pending,private';
  for (let page = 1; page <= 5; page++) {
    const rows = await wp(`/wp/v2/posts?status=${estados}&per_page=100&page=${page}&_fields=slug&context=edit`).catch(() => []);
    if (!Array.isArray(rows) || rows.length === 0) break;
    for (const r of rows) set.add(r.slug);
    if (rows.length < 100) break;
  }
  return set;
}

async function enviarEmail(subject, html) {
  if (!RESEND_KEY) { console.log('(sin RESEND_API_KEY, no envío email)'); return; }
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: `Artículos <${FROM}>`, to: [TO], subject, html }),
    });
  } catch (e) { console.log('email err:', e.message); }
}

// Carga el keyword research de una disciplina (keyword-research/<servicio>*.md), si existe.
function researchFor(servicio) {
  try {
    const dir = join(HERE, 'keyword-research');
    const f = readdirSync(dir).find(n => n.toLowerCase().startsWith(servicio) && n.endsWith('.md'));
    return f ? readFileSync(join(dir, f), 'utf8').slice(0, 4000) : '';
  } catch { return ''; }
}

// ---------- Generación con Claude ----------
async function generar(tema) {
  const system = [
    'Eres redactora SEO experta y escribes con la voz de Andrea, profesora del estudio Andrea Carrió Studio (Valencia, zona Alfahuir).',
    'Tono 1:1, cercano y personal: hablas en primera persona ("yo", "en mis clases"), NUNCA "nosotros" ni tono corporativo.',
    'REGLAS DE CONTENIDO:',
    '- Todo debe ser real y útil, que responda dudas reales del lector. NO inventes datos, cifras, estudios ni testimonios.',
    '- Nada de promesas milagro. Nada de consejo médico: ante lesiones, dolor persistente o embarazo/posparto, recomienda consultar a un profesional sanitario (matrona, fisio, médico).',
    '- Español de España, natural y claro. Frases que aporten, sin relleno.',
    '- La keyword objetivo debe aparecer en el título, en la introducción y alguna vez más de forma natural.',
    '- Mínimo 600 palabras de texto entre todos los campos. Introducción + 4 a 6 bloques + 3 o 4 preguntas frecuentes.',
    '- NO escribas enlaces, CTA, ni HTML: solo texto plano en los campos. Los enlaces y el diseño los añade el sistema.',
    'FORMATO DE SALIDA: devuelve EXCLUSIVAMENTE un objeto JSON válido (sin ```), con este esquema:',
    '{',
    '  "titulo": string,               // H1, incluye la keyword',
    '  "metaTitle": string,            // <=60 car., atractivo, con la keyword',
    '  "metaDescription": string,      // 140-155 car., con la keyword',
    '  "excerpt": string,              // 1 frase resumen, DISTINTA de la introducción',
    '  "intro": string,               // 2-3 frases de enganche (irá en una caja destacada)',
    '  "bloques": [                    // 4 a 6 bloques',
    '    { "h2": string, "parrafos": [string, ...], "tarjetas": [ {"emoji": string, "titulo": string, "texto": string}, ... ] }',
    '  ],                              // "parrafos" y "tarjetas" son opcionales por bloque; usa tarjetas para listas de ideas',
    '  "cita": string,                // opcional: una frase para destacar como cita, o ""',
    '  "faqs": [ {"q": string, "a": string}, ... ]  // 3 o 4',
    '}',
  ].join('\n');

  const guiaIntencion = {
    compra: 'INTENCIÓN DEL ARTÍCULO: COMPRA (el lector está casi decidido). Resuelve sus últimas dudas y objeciones y, hacia el final, anímale con naturalidad y calidez a dar el paso y reservar su plaza. Cierre orientado a la acción, sin agobiar.',
    informativo: 'INTENCIÓN DEL ARTÍCULO: INFORMATIVO (el lector compara y valora opciones). Sé objetiva, responde sus dudas y ayúdale a decidir; puedes mencionar el servicio sin presionar.',
    educativo: 'INTENCIÓN DEL ARTÍCULO: EDUCATIVO (contenido de valor). Enseña y aporta de verdad, genera confianza. Nada de venta: que el valor hable por sí solo y deje buena impresión.',
  }[tema.intencion] || '';

  let userMsg = [
    `Escribe el artículo para el blog sobre este tema:`,
    `- Keyword objetivo (secundaria, informacional): "${tema.keyword}"`,
    `- Título orientativo: "${tema.titulo}"`,
    `- Disciplina: ${tema.servicio}`,
    `- Ángulo y dudas a resolver: ${tema.angulo}`,
    guiaIntencion ? `- ${guiaIntencion}` : ``,
    ``,
    `Público: madres que buscan actividad para su hija (ballet) o mujeres adultas interesadas (pilates/barre). Aporta valor real y responde lo que de verdad se preguntan.`,
  ].join('\n');

  // Guía de keyword research por disciplina (si existe). El modelo puede apartarse
  // de ella cuando, como experta, tenga un enfoque mejor.
  const research = researchFor(tema.servicio);
  if (research) userMsg += `\n\n--- KEYWORD RESEARCH: búsquedas reales sobre ${tema.servicio} (guía) ---\n${research}\n--- fin research ---\n`
    + 'Prioriza responder estas preguntas y usar estos términos donde encajen de forma natural. PERO si como experta ves un enfoque, una duda o una estructura más útil para el lector, puedes saltarte esta guía.';

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODELO, max_tokens: 4000, system, messages: [{ role: 'user', content: userMsg }] }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  let raw = (data.content?.[0]?.text || '').trim();
  raw = raw.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const first = raw.indexOf('{'), last = raw.lastIndexOf('}');
  if (first < 0 || last < 0) throw new Error('La IA no devolvió JSON');
  return JSON.parse(raw.slice(first, last + 1));
}

// ---------- Render + validación ----------
function construir(art, servicio, destino) {
  const partes = [introBox(esc(art.intro))];
  for (const b of (art.bloques || [])) {
    if (b.h2) partes.push(h2(b.h2));
    for (const par of (b.parrafos || [])) partes.push(p(esc(par)));
    for (const t of (b.tarjetas || [])) partes.push(card(t.emoji || '•', t.titulo || '', t.texto || ''));
  }
  if (art.cita && art.cita.trim()) partes.push(quote(art.cita));
  // Enlace interno contextual -> siempre a la página de servicio (info).
  partes.push(p(`Si quieres ver horarios, edades y precios, aquí tienes toda la información de las ${link(servicio.url, servicio.anchor)}.`));
  partes.push(faqBlock(art.faqs || []));
  // CTA final: a reservas si el tema es de intención alta; si no, a la página de servicio.
  const aReservas = destino === 'reservas';
  partes.push(cta(aReservas ? RESERVAS : servicio.url, aReservas ? 'reservas' : 'servicio'));
  partes.push(firma());
  const html = `<div style="max-width:740px;margin:0 auto;">${partes.join('')}</div>`;
  const txt = html.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ');
  const palabras = txt.split(/\s+/).filter(Boolean).length;
  return { html, palabras };
}

// ---------- Main ----------
(async () => {
  try {
    if (!ANTHROPIC_KEY) throw new Error('Falta ANTHROPIC_API_KEY');
    if (!DRY && (!WP_USER || !WP_APP)) throw new Error('Faltan WP_USER / WP_APP_PASSWORD');

    const cola = JSON.parse(readFileSync(join(HERE, 'temas.json'), 'utf8')).temas || [];
    const usados = DRY ? new Set() : await slugsExistentes();
    const tema = cola.find(t => !usados.has(t.slug));

    if (!tema) {
      console.log('Cola de temas agotada.');
      await enviarEmail('📝 Cola de artículos agotada', '<p>Se han publicado todos los temas de <code>temas.json</code>. Añade más temas para que el artículo diario siga funcionando.</p>');
      return;
    }

    const servicio = SERVICIOS[tema.servicio] || SERVICIOS.ballet;
    console.log(`Tema: "${tema.keyword}" (${tema.servicio}) → slug ${tema.slug}`);

    let art, palabras = 0, html = '', motivo = '';
    try {
      art = await generar(tema);
      const r = construir(art, servicio, (tema.intencion === 'compra') ? 'reservas' : 'servicio');
      html = r.html; palabras = r.palabras;
      if (palabras < 600) motivo = `artículo corto (${palabras} palabras)`;
      if (!art.faqs || art.faqs.length < 3) motivo = 'faltan preguntas frecuentes';
    } catch (e) {
      motivo = `error de generación: ${e.message}`;
    }

    // Puerta de calidad: si algo falla, borrador (no sale en vivo).
    const forzarBorrador = DRAFT || !!motivo;
    const status = forzarBorrador ? 'draft' : 'publish';

    if (DRY) {
      console.log(`[DRY] ${art?.titulo || '(sin título)'} — ${palabras} palabras — motivo: ${motivo || 'ok'}`);
      console.log(html.slice(0, 400));
      return;
    }
    if (!html) throw new Error(motivo || 'sin contenido');

    const post = await wp('/wp/v2/posts', {
      method: 'POST',
      body: JSON.stringify({ title: art.titulo, slug: tema.slug, status, content: html, excerpt: art.excerpt || '', featured_media: pickFeatured(tema.servicio) }),
    });

    // Rank Math (focus keyword + meta). No es crítico: si falla, seguimos.
    await wp('/rankmath/v1/updateMeta', {
      method: 'POST',
      body: JSON.stringify({ objectID: post.id, objectType: 'post', meta: {
        rank_math_focus_keyword: tema.keyword,
        rank_math_title: art.metaTitle || art.titulo,
        rank_math_description: art.metaDescription || art.excerpt || '',
      } }),
    }).catch(e => console.log('Rank Math err (no crítico):', e.message));

    console.log(`${status.toUpperCase()} #${post.id} · ${palabras} palabras · ${post.link}`);

    // El artículo entero va DENTRO del correo (sin el <script> del schema, que
    // los clientes de email ignoran). El enlace de WordPress queda al pie.
    const htmlEmail = html.replace(/<script[\s\S]*?<\/script>/g, '');
    const editar = `${WP_BASE}/wp-admin/post.php?post=${post.id}&action=edit`;

    if (forzarBorrador) {
      await enviarEmail(`⚠️ BORRADOR (revísalo): ${art.titulo}`,
        `<div style="background:#fff3cd;border:1px solid #e0c97a;border-radius:8px;padding:12px 16px;font-family:sans-serif;color:#665200;margin-bottom:14px;">⚠️ Guardado como <strong>borrador</strong> (no publicado) por: <em>${esc(motivo || 'forzado --draft')}</em>. Aquí lo tienes para revisarlo:</div>`
        + htmlEmail
        + `<hr><p style="font-family:sans-serif;font-size:13px;color:#8a8a8a;">${palabras} palabras · keyword: ${esc(tema.keyword)} · <a href="${editar}">abrir en WordPress</a></p>`);
    } else {
      await enviarEmail(`✅ Publicado: ${art.titulo}`,
        htmlEmail
        + `<hr><p style="font-family:sans-serif;font-size:13px;color:#8a8a8a;">Publicado automáticamente · ${palabras} palabras · keyword: ${esc(tema.keyword)} · <a href="${post.link}">ver en la web</a> · <a href="${editar}">editar en WordPress</a></p>`);
    }
  } catch (e) {
    console.error('FALLO:', e.message);
    await enviarEmail('❌ Fallo en el artículo diario', `<p>El generador de artículos ha fallado:</p><pre>${esc(e.message)}</pre>`);
    process.exit(1);
  }
})();
