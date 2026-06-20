#!/usr/bin/env node
// Informe automático de Andrea Carrió Studio.
// Junta en un solo correo:
//   · Meta Ads  -> gasto, impresiones, clics, visitas a la landing y LEADS de hoy, por campaña.
//   · Supabase  -> reservas de Puertas Abiertas (niñas y adultas) e inscripciones pagadas:
//                  cuántas nuevas en las últimas horas y totales acumulados.
// Y lo envía con Resend al responsable.
//
// No tiene dependencias (Node 18+, fetch nativo). Lee las llaves de:
//   · tools/meta-ads/.env        (token de Meta)
//   · frontend/.env.local        (Supabase + Resend)
//   · o de process.env           (lo que use GitHub Actions: secrets)
//
// Uso:
//   node reporte.mjs            -> compone y ENVÍA el correo
//   node reporte.mjs --dry      -> solo lo compone y lo imprime, no envía nada
//   node reporte.mjs --hours 3  -> ventana de "nuevos" (por defecto 3 h)

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));

// --- carga de .env (sin dependencias). No pisa lo que ya venga en el entorno
//     (en GitHub Actions las llaves llegan por process.env desde los secrets). ---
function loadEnvFile(path) {
  try {
    const raw = readFileSync(path, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (!m) continue;
      let val = m[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!(m[1] in process.env)) process.env[m[1]] = val;
    }
  } catch { /* el archivo puede no existir: se usará process.env */ }
}
loadEnvFile(join(HERE, '..', 'meta-ads', '.env'));
loadEnvFile(join(HERE, '..', '..', 'frontend', '.env.local'));

// --- argumentos ---
const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const HOURS = (() => {
  const i = args.indexOf('--hours');
  return i >= 0 && args[i + 1] ? Number(args[i + 1]) : 3;
})();

// --- configuración ---
const META_TOKEN = process.env.META_ACCESS_TOKEN;
const META_ACCOUNT = (process.env.META_AD_ACCOUNT_ID || '1239097093670462').replace(/^act_/, '');
const META_VERSION = process.env.META_API_VERSION || 'v22.0';
const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_KEY = process.env.RESEND_API_KEY;
const FROM = process.env.FROM_EMAIL || 'noreply@andreacarriostudio.es';
const TO = process.env.REPORT_TO || 'gioacchinopalumbo38@gmail.com';

// --- utilidades de formato ---
const eur = (v) => `${Number(v || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const num = (v) => Number(v || 0).toLocaleString('es-ES');
const actionVal = (arr, type) => {
  const hit = Array.isArray(arr) ? arr.find((a) => a.action_type === type) : null;
  return hit ? Number(hit.value) : 0;
};

// --- fuentes de datos (cada una aislada: si una falla, el informe sale igual) ---
async function getMeta() {
  if (!META_TOKEN) return { ok: false, error: 'Falta META_ACCESS_TOKEN', rows: [] };
  try {
    const params = new URLSearchParams();
    params.set('level', 'campaign');
    params.set('fields', 'campaign_name,spend,impressions,clicks,inline_link_clicks,ctr,actions');
    params.set('date_preset', 'today');
    params.set('limit', '200');
    params.set('access_token', META_TOKEN);
    const url = `https://graph.facebook.com/${META_VERSION}/act_${META_ACCOUNT}/insights?${params}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.error) return { ok: false, error: data.error.message, rows: [] };
    const rows = (data.data || []).map((c) => {
      const spend = Number(c.spend || 0);
      const leads = actionVal(c.actions, 'lead');
      return {
        name: c.campaign_name,
        spend,
        impressions: Number(c.impressions || 0),
        clicks: Number(c.inline_link_clicks || c.clicks || 0),
        lpv: actionVal(c.actions, 'landing_page_view'),
        leads,
        cpl: leads > 0 ? spend / leads : null,
      };
    }).sort((a, b) => b.spend - a.spend);
    return { ok: true, rows };
  } catch (e) {
    return { ok: false, error: e.message, rows: [] };
  }
}

async function sb(path) {
  const res = await fetch(`${SUPA_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
  });
  if (!res.ok) throw new Error(`Supabase ${path}: ${res.status}`);
  return res.json();
}

async function getInscritos(sinceMs) {
  if (!SUPA_URL || !SUPA_KEY) return { ok: false, error: 'Faltan llaves de Supabase' };
  const isNew = (r) => r.created_at && new Date(r.created_at).getTime() >= sinceMs;
  const PLAZA = new Set(['pagato', 'pagado', 'activa', 'matricula_pagada']);
  try {
    const [pa, paa, isc] = await Promise.all([
      sb('puertas_abiertas?select=created_at'),
      sb('puertas_abiertas_adultas?select=created_at'),
      sb('iscrizioni?select=created_at,stato,nome,cognome,nome_alumna,matricula'),
    ]);
    const inscritas = isc.filter((r) => PLAZA.has(r.stato));
    return {
      ok: true,
      pa: { total: pa.length, nuevas: pa.filter(isNew).length },
      paa: { total: paa.length, nuevas: paa.filter(isNew).length },
      isc: {
        total: inscritas.length,
        nuevas: inscritas.filter(isNew).length,
        nuevasLista: inscritas.filter(isNew).map((r) => ({
          nombre: [r.nome, r.cognome].filter(Boolean).join(' ') || '—',
          alumna: r.nome_alumna || null,
        })),
      },
    };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// --- composición del correo ---
function buildHtml({ meta, ins, ahora, hours }) {
  const fecha = ahora.toLocaleString('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
    timeZone: 'Europe/Madrid',
  });

  // --- bloque Meta ---
  let metaBloque;
  if (meta.ok && meta.rows.length > 0) {
    const tGasto = meta.rows.reduce((s, r) => s + r.spend, 0);
    const tLeads = meta.rows.reduce((s, r) => s + r.leads, 0);
    const filas = meta.rows.map((r) => `
      <tr>
        <td style="padding:10px 8px;border-bottom:1px solid #f0ddd5;font-size:13px;color:#25190f;font-weight:600;">${r.name}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #f0ddd5;font-size:13px;color:#56423d;text-align:right;">${eur(r.spend)}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #f0ddd5;font-size:13px;color:#56423d;text-align:right;">${num(r.impressions)}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #f0ddd5;font-size:13px;color:#56423d;text-align:right;">${num(r.lpv)}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #f0ddd5;font-size:14px;color:#7d2b13;font-weight:700;text-align:right;">${num(r.leads)}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #f0ddd5;font-size:13px;color:#56423d;text-align:right;">${r.cpl != null ? eur(r.cpl) : '—'}</td>
      </tr>`).join('');
    metaBloque = `
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        <tr>
          <th style="padding:8px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#89726c;border-bottom:2px solid #7d2b13;">Campaña</th>
          <th style="padding:8px;text-align:right;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#89726c;border-bottom:2px solid #7d2b13;">Gasto</th>
          <th style="padding:8px;text-align:right;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#89726c;border-bottom:2px solid #7d2b13;">Impr.</th>
          <th style="padding:8px;text-align:right;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#89726c;border-bottom:2px solid #7d2b13;">Visitas</th>
          <th style="padding:8px;text-align:right;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#89726c;border-bottom:2px solid #7d2b13;">Leads</th>
          <th style="padding:8px;text-align:right;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#89726c;border-bottom:2px solid #7d2b13;">€/lead</th>
        </tr>
        ${filas}
        <tr>
          <td style="padding:12px 8px;font-size:13px;color:#25190f;font-weight:700;">TOTAL</td>
          <td style="padding:12px 8px;font-size:13px;color:#25190f;font-weight:700;text-align:right;">${eur(tGasto)}</td>
          <td colspan="2"></td>
          <td style="padding:12px 8px;font-size:15px;color:#7d2b13;font-weight:700;text-align:right;">${num(tLeads)}</td>
          <td style="padding:12px 8px;font-size:13px;color:#25190f;font-weight:700;text-align:right;">${tLeads > 0 ? eur(tGasto / tLeads) : '—'}</td>
        </tr>
      </table>`;
  } else {
    metaBloque = `<p style="margin:0;font-size:13px;color:#b00020;">⚠️ No se pudieron leer los datos de Meta${meta.error ? ` (${meta.error})` : ''}.</p>`;
  }

  // --- bloque inscritos ---
  let insBloque;
  if (ins.ok) {
    const fila = (label, d, sub) => `
      <tr>
        <td style="padding:12px 14px;border-bottom:1px solid #f0ddd5;font-size:13px;color:#25190f;">${label}<br><span style="font-size:11px;color:#89726c;">${sub}</span></td>
        <td style="padding:12px 14px;border-bottom:1px solid #f0ddd5;text-align:center;">
          ${d.nuevas > 0
            ? `<span style="background:#e8f5e9;color:#2e7d32;font-size:14px;font-weight:700;padding:4px 12px;border-radius:9999px;">+${d.nuevas}</span>`
            : `<span style="color:#bcb0ab;font-size:14px;">—</span>`}
        </td>
        <td style="padding:12px 14px;border-bottom:1px solid #f0ddd5;text-align:right;font-size:16px;font-weight:700;color:#25190f;">${d.total}</td>
      </tr>`;
    const listaNuevas = ins.isc.nuevasLista.length > 0
      ? `<p style="margin:14px 0 0;font-size:12px;color:#56423d;">🎉 Nuevas matrículas: ${ins.isc.nuevasLista.map((x) => x.alumna ? `${x.alumna} (${x.nombre})` : x.nombre).join(' · ')}</p>`
      : '';
    insBloque = `
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        <tr>
          <th style="padding:8px 14px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#89726c;border-bottom:2px solid #7d2b13;"></th>
          <th style="padding:8px 14px;text-align:center;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#89726c;border-bottom:2px solid #7d2b13;">Últimas ${hours} h</th>
          <th style="padding:8px 14px;text-align:right;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#89726c;border-bottom:2px solid #7d2b13;">Total</th>
        </tr>
        ${fila('Puertas Abiertas', ins.pa, 'Niñas')}
        ${fila('Puertas Abiertas', ins.paa, 'Adultas')}
        ${fila('Matrículas pagadas', ins.isc, 'Han pagado y tienen plaza')}
      </table>
      ${listaNuevas}`;
  } else {
    insBloque = `<p style="margin:0;font-size:13px;color:#b00020;">⚠️ No se pudieron leer los inscritos${ins.error ? ` (${ins.error})` : ''}.</p>`;
  }

  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background:#f5ede8;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5ede8;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 8px 40px rgba(37,25,15,0.10);">
        <tr><td style="padding:28px 32px 8px;">
          <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#7d2b13;">Informe automático</p>
          <h1 style="margin:6px 0 2px;font-size:22px;color:#25190f;font-family:Georgia,serif;">Andrea Carrió Studio</h1>
          <p style="margin:0;font-size:12px;color:#89726c;text-transform:capitalize;">${fecha}</p>
        </td></tr>
        <tr><td style="padding:20px 32px 8px;">
          <p style="margin:0 0 12px;font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#89726c;font-weight:700;">📊 Publicidad · hoy</p>
          ${metaBloque}
        </td></tr>
        <tr><td style="padding:20px 32px 8px;">
          <p style="margin:0 0 12px;font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#89726c;font-weight:700;">👥 Inscritos</p>
          ${insBloque}
        </td></tr>
        <tr><td style="background:#fff8f5;border-top:1px solid #f0ddd5;padding:20px 32px;text-align:center;">
          <p style="margin:0;font-size:11px;color:#89726c;">Informe generado automáticamente cada ${hours} h.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`.trim();
}

function buildSubject({ meta, ins }) {
  const leads = meta.ok ? meta.rows.reduce((s, r) => s + r.leads, 0) : 0;
  const nuevos = ins.ok ? ins.pa.nuevas + ins.paa.nuevas + ins.isc.nuevas : 0;
  const hora = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' });
  const trozo = nuevos > 0 ? `+${nuevos} nuevos` : 'sin novedades';
  return `📊 ${hora} · ${trozo} · ${leads} leads hoy`;
}

async function enviar(subject, html) {
  if (!RESEND_KEY) throw new Error('Falta RESEND_API_KEY');
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: TO, subject, html }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Resend: ${JSON.stringify(data)}`);
  return data;
}

// --- principal ---
const ahora = new Date();
const sinceMs = ahora.getTime() - HOURS * 3600 * 1000;
const [meta, ins] = await Promise.all([getMeta(), getInscritos(sinceMs)]);

const subject = buildSubject({ meta, ins });
const html = buildHtml({ meta, ins, ahora, hours: HOURS });

if (DRY) {
  console.log('--- ASUNTO ---');
  console.log(subject);
  console.log('\n--- RESUMEN ---');
  if (meta.ok) {
    console.log(`Meta: ${meta.rows.length} campañas · ${eur(meta.rows.reduce((s, r) => s + r.spend, 0))} · ${meta.rows.reduce((s, r) => s + r.leads, 0)} leads`);
    meta.rows.forEach((r) => console.log(`  - ${r.name}: ${eur(r.spend)} · ${r.leads} leads · ${r.cpl != null ? eur(r.cpl) + '/lead' : 'sin leads'}`));
  } else console.log(`Meta ERROR: ${meta.error}`);
  if (ins.ok) {
    console.log(`Puertas niñas: ${ins.pa.total} (+${ins.pa.nuevas}) · adultas: ${ins.paa.total} (+${ins.paa.nuevas}) · matrículas: ${ins.isc.total} (+${ins.isc.nuevas})`);
  } else console.log(`Inscritos ERROR: ${ins.error}`);
  console.log('\n(--dry: no se ha enviado nada)');
} else {
  const r = await enviar(subject, html);
  console.log(`✓ Correo enviado a ${TO} (id ${r.id || '?'})`);
}
