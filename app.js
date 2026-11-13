/* ============================================================
   BRIVIAN · app.js  (versión con Firebase)
   SPA sencilla con rutas por hash: #landing #login #registro
   #inicio #explorar #crear #comunidad #comunidad/<id> #perfil #mensajes #chat/<id>
   Datos: Firebase Authentication + Cloud Firestore.
   Imágenes: por ahora son enlaces (URL https) a imágenes de la web.
   ============================================================ */
import {
  auth, db,
  onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
  sendPasswordResetEmail, deleteUser, sendEmailVerification, reauthenticateWithCredential, EmailAuthProvider, verifyBeforeUpdateEmail,
  doc, collection, getDoc, getDocs, setDoc, updateDoc, deleteDoc, addDoc,
  query, where, orderBy, limit, limitToLast, startAfter, writeBatch, runTransaction, serverTimestamp, increment, onSnapshot,
} from './firebase.js';
import { GEO, COUNTRIES, canonCountry, canonState, canonCity } from './geo.js';

/* ---------- Utilidades ---------- */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const icons = () => window.lucide && window.lucide.createIcons();
const initials = (name) => String(name || '?').split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
const colorsFor = (str) => {
  let h = 0;
  for (const ch of String(str)) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return [`hsl(${h} 55% 38%)`, `hsl(${(h + 50) % 360} 70% 55%)`];
};

/* Solo se aceptan enlaces https. Todo lo que viene de la base de datos pasa por aquí antes de pintarse. */
function cleanUrl(raw) {
  let v = String(raw || '').trim();
  if (!v) return '';
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(v)) v = `https://${v}`;
  try {
    const u = new URL(v);
    return u.protocol === 'https:' && u.hostname.includes('.') ? u.href : '';
  } catch { return ''; }
}
/* Enlaces de IMAGEN: acepta cualquier URL que cargue como imagen (no hace falta que termine en .jpg).
   Además arregla los enlaces más comunes que no son la imagen en sí. */
function imgUrl(raw) {
  const v = String(raw || '').trim().replace(/^http:\/\//i, 'https://');
  const c = cleanUrl(v);
  if (!c) return '';
  try {
    const u = new URL(c), host = u.hostname.replace(/^www\./, '');
    if (host === 'drive.google.com') {                       // Drive (compartido con "cualquiera con el enlace")
      const id = (u.pathname.match(/\/file\/d\/([\w-]+)/) || [])[1] || u.searchParams.get('id');
      if (id && /^[\w-]+$/.test(id)) return `https://lh3.googleusercontent.com/d/${id}`;
    }
    if (host === 'dropbox.com') { u.searchParams.delete('dl'); u.searchParams.set('raw', '1'); return u.href; }
    if (host === 'imgur.com' && /^\/[A-Za-z0-9]{5,10}$/.test(u.pathname)) return `https://i.imgur.com${u.pathname}.jpg`;
  } catch { /* se usa el enlace tal cual */ }
  return c;
}
const cssUrl = (u) => `url('${u.replace(/['()]/g, (c) => '%' + c.charCodeAt(0).toString(16))}')`;

/* Ajuste de imagen: { x, y, z } = punto de enfoque (% horizontal y vertical) y zoom (1 = sin zoom) */
const clampN = (n, a, b) => Math.min(b, Math.max(a, n));
function posOf(p) {
  if (!p || typeof p !== 'object') return null;
  const x = Number(p.x), y = Number(p.y), z = Number(p.z);
  if (![x, y, z].every(Number.isFinite)) return null;
  const r = { x: Math.round(clampN(x, 0, 100) * 10) / 10, y: Math.round(clampN(y, 0, 100) * 10) / 10, z: Math.round(clampN(z, 1, 4) * 100) / 100 };
  return r.x === 50 && r.y === 50 && r.z === 1 ? null : r;
}
const posCss = (p) => { p = posOf(p); return p ? `object-position:${p.x}% ${p.y}%;transform:scale(${p.z});transform-origin:${p.x}% ${p.y}%` : ''; };
function setCover(el, url, pos) {
  const p = posOf(pos) || { x: 50, y: 50, z: 1 };
  el.style.setProperty('--img', url ? cssUrl(url) : 'none');
  el.style.setProperty('--px', p.x + '%'); el.style.setProperty('--py', p.y + '%'); el.style.setProperty('--pz', p.z);
}

/* La foto va en un <img> sobre las iniciales: si el enlace falla, se quedan las iniciales (nunca un círculo vacío) */
const avatarImg = (u, pos) => (u ? `<img class="av-img" src="${esc(u)}" alt="" referrerpolicy="no-referrer" decoding="async"${posOf(pos) ? ` style="${esc(posCss(pos))}"` : ''}>` : '');
const avatarHTML = (name, size = 'sm', img, pos) => {
  const [c1, c2] = colorsFor(name);
  return `<span class="avatar ${size}" style="${esc(`--c1:${c1};--c2:${c2}`)}">${esc(initials(name))}${avatarImg(cleanUrl(img), pos)}</span>`;
};
document.addEventListener('load', (e) => { const t = e.target; if (t.classList && t.classList.contains('av-img')) t.parentElement.classList.add('loaded'); }, true);
document.addEventListener('error', (e) => {
  const t = e.target; if (!t.classList) return;
  if (t.classList.contains('av-img')) t.remove();
  else if (t.classList.contains('pick-img')) { t.parentElement.classList.remove('has-img'); t.remove(); }
  else if (t.classList.contains('post-img')) { t.style.display = 'none'; if (t.parentElement.classList.contains('post-media')) t.parentElement.style.display = 'none'; }
}, true);

/* Comprueba que un enlace sea de verdad una imagen que se puede mostrar */
function checkImage(url, ms = 8000) {
  return new Promise((resolve) => {
    const img = new Image();
    img.referrerPolicy = 'no-referrer';
    const t = setTimeout(() => { img.src = ''; resolve('timeout'); }, ms);
    img.onload = () => { clearTimeout(t); resolve('ok'); };
    img.onerror = () => { clearTimeout(t); resolve('error'); };
    img.src = url;
  });
}
const IMG_HELP = 'No encontramos ninguna imagen en ese enlace. Prueba con otro enlace, o con el de la imagen misma (mantén presionada la imagen y elige "Copiar dirección de imagen").';

/* Busca una imagen que se pueda mostrar a partir de CUALQUIER enlace, en este orden:
   1) el enlace tal cual (incluye Google Imágenes, Drive, Dropbox, Imgur y http://)
   2) el mismo enlace a través de un proxy de imágenes gratuito (para webs que bloquean que otros muestren sus fotos)
   3) la imagen principal de la página (la que se ve al compartir el enlace en WhatsApp o Facebook)
   Devuelve { url, via } o { url: '' } si no se encontró nada. */
const PROXY = (u) => `https://images.weserv.nl/?url=${encodeURIComponent(u)}&w=800&we`;
async function pageImage(u) {
  try {
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 9000);
    const r = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(u)}`, { signal: ctl.signal, referrerPolicy: 'no-referrer' });
    clearTimeout(t);
    const d = ((await r.json()) || {}).data || {};
    return cleanUrl((d.image && d.image.url) || (d.logo && d.logo.url) || '');
  } catch { return ''; }
}
const resolveCache = new Map();
function resolveImage(raw) {
  const key = String(raw || '').trim();
  if (!key) return Promise.resolve({ url: '', via: '' });
  if (!resolveCache.has(key)) {
    const p = doResolve(key);
    resolveCache.set(key, p);
    p.then((r) => { if (!r.url) resolveCache.delete(key); });
  }
  return resolveCache.get(key);
}
async function doResolve(key) {
  let u = imgUrl(key);
  if (!u) return { url: '', via: '', invalid: true };
  try {   // enlace de Google Imágenes: trae la imagen real en "imgurl"
    const g = new URL(u);
    if (/(^|\.)google\./.test(g.hostname) && g.searchParams.get('imgurl')) u = imgUrl(g.searchParams.get('imgurl')) || u;
  } catch { /* sigue con el enlace original */ }
  /* Se prueba en paralelo "desde tu navegador" y "desde un servidor sin sesión".
     Si solo carga en tu navegador, la imagen es privada (por ejemplo, un archivo de Drive sin compartir):
     a ti se te ve porque tienes la sesión iniciada, pero las demás personas no la verían. */
  const [direct, viaServer] = await Promise.all([checkImage(u, 6000), checkImage(PROXY(u), 9000)]);
  if (direct === 'ok') {
    if (viaServer === 'error' && NEEDS_LOGIN.test(new URL(u).hostname)) return { url: '', via: '', private: true };
    return { url: u, via: 'direct' };
  }
  if (direct === 'timeout') return { url: u, via: 'slow' };
  const proxied = viaServer;
  const page = await pageImage(u);
  if (proxied === 'ok') return { url: PROXY(u), via: 'proxy' };
  if (page) {
    if ((await checkImage(page, 6000)) === 'ok') return { url: page, via: 'page' };
    if ((await checkImage(PROXY(page), 9000)) === 'ok') return { url: PROXY(page), via: 'page' };
  }
  return { url: '', via: '' };
}
const NEEDS_LOGIN = /(^|\.)(drive\.google\.com|googleusercontent\.com|photos\.google\.com|facebook\.com|fbcdn\.net|instagram\.com|cdninstagram\.com|dropbox\.com|dropboxusercontent\.com|onedrive\.live\.com|1drv\.ms|sharepoint\.com|icloud\.com)$/;
const IMG_PRIVATE = 'Esa imagen es privada: tú la ves porque tienes la sesión iniciada, pero las demás personas no. Compártela como "cualquier persona con el enlace" (o hazla pública) y pega el enlace otra vez, o usa otro enlace.';
const IMG_OK = { direct: '✓ Imagen lista', proxy: '✓ Imagen lista (la ajustamos para que se vea bien)', page: '✓ Usamos la imagen principal de esa página', slow: 'La imagen tarda en cargar; se guardará de todos modos.' };
/* Al escribir un enlace muestra al instante si funciona (y la vista previa, si hay) */
/* ============================================================
   AJUSTAR IMAGEN · mover con el dedo/ratón y hacer zoom
   Solo se guarda el enfoque y el zoom (no se toca el archivo), así funciona con cualquier enlace.
   ============================================================ */
const CROP = { res: null, pos: { x: 50, y: 50, z: 1 }, ptrs: new Map(), pinch: null };
const cropOpen = () => !$('#cropSheet').hidden;
function paintCrop() {
  const { x, y, z } = CROP.pos;
  $('#cropImg').style.cssText = `object-position:${x}% ${y}%;transform:scale(${z});transform-origin:${x}% ${y}%`;
  $('#cropZoom').value = z;
}
function openCrop({ url, kind = 'wide', pos }) {
  return new Promise((resolve) => {
    if (CROP.res) closeCrop(undefined);
    CROP.res = resolve; CROP.ptrs.clear(); CROP.pinch = null;
    CROP.pos = { ...(posOf(pos) || { x: 50, y: 50, z: 1 }) };
    CROP.pos.z = clampN(CROP.pos.z, 1, 3);
    $('#cropFrame').className = `crop-frame ${kind}`;
    $('#cropTitle').textContent = kind === 'round' ? 'Ajusta tu foto de perfil' : kind === 'wide' ? 'Ajusta tu portada' : 'Ajusta tu foto';
    const img = $('#cropImg');
    img.onerror = () => { toast('No pudimos abrir esa imagen.'); closeCrop(undefined); };
    img.src = url;
    paintCrop();
    $('#cropSheet').hidden = false;
    $('#cropFrame').focus({ preventScroll: true });
  });
}
function closeCrop(result) {
  $('#cropSheet').hidden = true;
  CROP.ptrs.clear(); CROP.pinch = null;
  $('#cropImg').onerror = null;
  const r = CROP.res; CROP.res = null;
  if (r) r(result);
}
/* píxeles de recorrido que hay en cada eje con el zoom actual (0 = no hay nada que mover) */
function cropSlack() {
  const f = $('#cropFrame'), im = $('#cropImg');
  const Fw = f.clientWidth, Fh = f.clientHeight, nw = im.naturalWidth || Fw, nh = im.naturalHeight || Fh;
  const s = Math.max(Fw / nw, Fh / nh), z = CROP.pos.z;
  return { x: z * nw * s - Fw, y: z * nh * s - Fh };
}
function cropMove(dx, dy) {
  const sl = cropSlack();
  if (sl.x > 0.5) CROP.pos.x = clampN(CROP.pos.x - (dx / sl.x) * 100, 0, 100);
  if (sl.y > 0.5) CROP.pos.y = clampN(CROP.pos.y - (dy / sl.y) * 100, 0, 100);
  paintCrop();
}
function cropZoom(z) { CROP.pos.z = clampN(z, 1, 3); paintCrop(); }
(function wireCrop() {
  const f = $('#cropFrame');
  const dist = () => { const [a, b] = [...CROP.ptrs.values()]; return Math.hypot(a.x - b.x, a.y - b.y) || 1; };
  f.addEventListener('pointerdown', (e) => {
    f.setPointerCapture?.(e.pointerId);
    CROP.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    CROP.pinch = CROP.ptrs.size === 2 ? { d: dist(), z: CROP.pos.z } : null;
  });
  f.addEventListener('pointermove', (e) => {
    const prev = CROP.ptrs.get(e.pointerId); if (!prev) return;
    const cur = { x: e.clientX, y: e.clientY };
    CROP.ptrs.set(e.pointerId, cur);
    if (CROP.ptrs.size === 1) cropMove(cur.x - prev.x, cur.y - prev.y);
    else if (CROP.ptrs.size === 2 && CROP.pinch) cropZoom(CROP.pinch.z * (dist() / CROP.pinch.d));
  });
  const up = (e) => { CROP.ptrs.delete(e.pointerId); CROP.pinch = null; };
  f.addEventListener('pointerup', up); f.addEventListener('pointercancel', up);
  f.addEventListener('wheel', (e) => { e.preventDefault(); cropZoom(CROP.pos.z - e.deltaY * 0.002); }, { passive: false });
  f.addEventListener('keydown', (e) => {
    const k = e.key, st = 8;
    if (k === 'ArrowLeft') cropMove(st, 0); else if (k === 'ArrowRight') cropMove(-st, 0);
    else if (k === 'ArrowUp') cropMove(0, st); else if (k === 'ArrowDown') cropMove(0, -st);
    else if (k === '+' || k === '=') cropZoom(CROP.pos.z + 0.1); else if (k === '-') cropZoom(CROP.pos.z - 0.1);
    else return;
    e.preventDefault();
  });
  $('#cropZoom').addEventListener('input', (e) => cropZoom(Number(e.target.value)));
  $('#cropReset').addEventListener('click', () => { CROP.pos = { x: 50, y: 50, z: 1 }; paintCrop(); });
  $('#cropOk').addEventListener('click', () => closeCrop(posOf(CROP.pos)));
  $('#cropClose').addEventListener('click', () => closeCrop(undefined));
  $('#cropSheet').addEventListener('click', (e) => { if (e.target.id === 'cropSheet') closeCrop(undefined); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && cropOpen()) { e.stopPropagation(); closeCrop(undefined); }
  }, true);
})();
/* Botón "Mover y ajustar" junto a un campo de enlace de imagen */
function wireAdjust({ input, btn, kind, get, set }) {
  const sync = () => { btn.hidden = !input.value.trim(); };
  input.addEventListener('input', () => { set(null); sync(); });
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    let r; try { r = await resolveImage(input.value); } finally { btn.disabled = false; }
    if (!r || !r.url) { toast('Primero pega el enlace de una imagen válida.'); return; }
    const res = await openCrop({ url: r.url, kind, pos: get() });
    if (res !== undefined) set(res);
  });
  sync();
  return { sync };
}

function watchImageInput(input, status, onUrl) {
  let seq = 0, timer;
  const run = async () => {
    const my = ++seq, raw = input.value.trim();
    status.className = 'img-status';
    if (!raw) { status.textContent = ''; onUrl && onUrl(''); return; }
    status.textContent = 'Buscando la imagen…';
    const r = await resolveImage(raw);
    if (my !== seq) return;
    if (r.url) { status.textContent = IMG_OK[r.via] || IMG_OK.direct; status.classList.add('ok'); onUrl && onUrl(r.url); }
    else { status.textContent = r.invalid ? 'Pega un enlace de internet (https://…).' : r.private ? IMG_PRIVATE : IMG_HELP; status.classList.add('bad'); onUrl && onUrl(''); }
  };
  input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(run, 450); });
  return { run, clear() { seq++; clearTimeout(timer); status.textContent = ''; status.className = 'img-status'; } };
}
/* Para validar al guardar: devuelve un mensaje de error o '' */
async function imageProblem(raw, label) {
  if (!String(raw || '').trim()) return '';
  const r = await resolveImage(raw);
  return r.url ? '' : `${r.invalid ? 'Pega un enlace de internet (https://…).' : r.private ? IMG_PRIVATE : IMG_HELP} (${label})`;
}

const toMs = (ts) => (ts && typeof ts.toMillis === 'function' ? ts.toMillis() : ts instanceof Date ? ts.getTime() : typeof ts === 'number' ? ts : Date.now());
const timeAgo = (ts) => {
  const mins = Math.max(0, Math.round((Date.now() - toMs(ts)) / 60000));
  if (mins < 1) return 'ahora';
  if (mins < 60) return `hace ${mins} min`;
  if (mins < 1440) return `hace ${Math.round(mins / 60)} h`;
  return `hace ${Math.round(mins / 1440)} d`;
};

/* localStorage solo para preferencias del navegador (tema, avisos cerrados) */
const store = {
  get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin storage */ } },
};
let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
}
function authError(e) {
  const map = {
    'auth/email-already-in-use': 'Ya existe una cuenta con ese correo. Inicia sesión.',
    'auth/invalid-email': 'Escribe un correo válido.',
    'auth/weak-password': 'La contraseña es muy débil. Usa al menos 8 caracteres.',
    'auth/invalid-credential': 'Correo o contraseña incorrectos.',
    'auth/wrong-password': 'Correo o contraseña incorrectos.',
    'auth/user-not-found': 'Correo o contraseña incorrectos.',
    'auth/operation-not-allowed': 'Firebase no permite cambiar el correo con esta configuración. Avísanos desde Ayuda.',
    'auth/requires-recent-login': 'Por seguridad, cierra sesión, vuelve a entrar e inténtalo de nuevo.',
    'auth/too-many-requests': 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.',
    'auth/network-request-failed': 'Sin conexión. Revisa tu internet e inténtalo de nuevo.',
    'app/handle-taken': 'Ese usuario ya está en uso. Prueba con otro.',
    'permission-denied': 'Sin permiso en la base de datos. Revisa que publicaste las reglas de Firestore.',
  };
  return map[e?.code] || 'Algo salió mal. Inténtalo de nuevo.';
}

/* ---------- Catálogos ---------- */
const CATEGORIES = [
  { id: 'gastronomia', name: 'Gastronomía', desc: 'Cocinas, cafés y repostería', icon: 'utensils-crossed' },
  { id: 'belleza', name: 'Belleza', desc: 'Estética, barbería y cuidado', icon: 'scissors' },
  { id: 'moda', name: 'Moda', desc: 'Prendas, accesorios y textiles', icon: 'shirt' },
  { id: 'tecnologia', name: 'Tecnología', desc: 'Desarrollo, software y datos', icon: 'code-xml' },
  { id: 'marketing', name: 'Marketing', desc: 'Contenido, marcas y publicidad', icon: 'megaphone' },
  { id: 'servicios', name: 'Servicios profesionales', desc: 'Consultoría y especialidades', icon: 'briefcase' },
  { id: 'arte', name: 'Arte y creatividad', desc: 'Fotografía, diseño y oficios', icon: 'palette' },
  { id: 'hogar', name: 'Hogar y construcción', desc: 'Interiorismo y obra', icon: 'house' },
  { id: 'educacion', name: 'Educación', desc: 'Cursos, talleres y formación', icon: 'book-open' },
  { id: 'bienestar', name: 'Bienestar', desc: 'Salud, naturaleza y cuidado personal', icon: 'leaf' },
];
/* ---------- Ubicación: país · estado o región · ciudad ---------- */
const norm = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
const isMX = (c) => norm(c) === 'mexico';
const canon = (v, list = []) => list.find((x) => norm(x) === norm(v)) || String(v || '').trim().replace(/\s+/g, ' ');
/* Los perfiles anteriores no tenían país ni estado: se leen como Jalisco, México.
   Además se normaliza: "Jal", "jalisco" y "Jalisco" son el mismo estado (así filtros y "Mi zona" no se parten). */
const placeCache = new Map();
const placeParts = (o = {}) => {
  const ck = `${o.country}|${o.state}|${o.municipio}`;
  let r = placeCache.get(ck);
  if (r) return r;
  const country = canonCountry(o.country || 'México');
  const state = canonState(country, o.state != null ? o.state : (o.country ? '' : 'Jalisco'));
  const muni = o.municipio && o.municipio !== 'Otro' ? o.municipio : '';
  r = { municipio: canonCity(country, state, muni), state, country };
  if (placeCache.size > 3000) placeCache.clear();
  placeCache.set(ck, r);
  return r;
};
const placeText = (o) => { const p = placeParts(o); return [p.municipio, p.state, isMX(p.country) ? '' : p.country].filter(Boolean).join(', '); };
const buildCity = ({ colonia, municipio, state, country }) => [colonia, municipio, state, isMX(country) ? '' : country].filter(Boolean).join(', ');
const sameCity = (a, b) => {
  const x = placeParts(a), y = placeParts(b);
  return !!x.municipio && norm(x.municipio) === norm(y.municipio) && norm(x.country) === norm(y.country)
    && (!x.state || !y.state || norm(x.state) === norm(y.state));
};
/* ---- Formulario de ubicación con listas: país → estado o región → ciudad ----
   Los países con lista (GEO) se eligen de menús; en otros países el estado y la ciudad se escriben.
   Siempre existe "Otra ciudad…" / "Otro país…" por si la tuya no aparece. */
const OTHER = '__other';
const optHTML = (v, l = v) => `<option value="${esc(v)}">${esc(l)}</option>`;
const placeFieldsHTML = (p) => `
  <label class="field-label" for="${p}Country">País</label>
  <select class="select" id="${p}Country"></select>
  <input class="input" id="${p}CountryOther" maxlength="60" autocomplete="off" placeholder="Escribe tu país" hidden>
  <label class="field-label" for="${p}State" id="${p}StateLbl">Estado o región</label>
  <select class="select" id="${p}State"></select>
  <input class="input" id="${p}StateTxt" maxlength="60" autocomplete="off" placeholder="Estado o región (opcional)" hidden>
  <label class="field-label" for="${p}Muni">Ciudad o municipio</label>
  <select class="select" id="${p}Muni"></select>
  <input class="input" id="${p}MuniTxt" maxlength="60" autocomplete="off" placeholder="Escribe tu ciudad o municipio" hidden>`;
const pf = (p) => ({
  cSel: $(`#${p}Country`), cOth: $(`#${p}CountryOther`), sSel: $(`#${p}State`), sTxt: $(`#${p}StateTxt`),
  mSel: $(`#${p}Muni`), mTxt: $(`#${p}MuniTxt`), sLbl: $(`#${p}StateLbl`),
});
const findIn = (list, v) => list.find((x) => norm(x) === norm(v));
/* Redibuja estado y ciudad según el país (y estado) elegidos. `want` conserva valores al editar. */
function paintPlace(p, want = {}) {
  const { cSel, cOth, sSel, sTxt, mSel, mTxt, sLbl } = pf(p);
  const country = cSel.value === OTHER ? '' : cSel.value;
  cOth.hidden = cSel.value !== OTHER;
  const tree = GEO[country];
  // estado o región
  if (tree) {
    const states = Object.keys(tree);
    const prev = want.state != null ? want.state : sSel.value;
    const hit = findIn(states, prev);
    sSel.hidden = false; sTxt.hidden = true; sSel.disabled = false;
    sSel.innerHTML = optHTML('', 'Elige tu estado o región') + states.map((x) => optHTML(x)).join('')
      + (prev && !hit ? optHTML(prev) : '');
    sSel.value = hit || (prev || '');
    sLbl.innerHTML = 'Estado o región';
  } else if (!cSel.value) {
    sSel.hidden = false; sTxt.hidden = true; sSel.disabled = true;
    sSel.innerHTML = optHTML('', 'Primero elige tu país'); sLbl.innerHTML = 'Estado o región';
  } else {
    sSel.hidden = true; sSel.innerHTML = ''; sTxt.hidden = false;
    if (want.state != null) sTxt.value = want.state;
    sLbl.innerHTML = 'Estado o región <span class="muted">(opcional)</span>';
  }
  // ciudad
  const state = !sSel.hidden ? sSel.value : '';
  const cities = tree && state && tree[findIn(Object.keys(tree), state)];
  if (cities) {
    const prev = want.municipio != null ? want.municipio : (mSel.value === OTHER ? '' : mSel.value);
    const hit = findIn(cities, prev);
    mSel.hidden = false; mSel.disabled = false;
    mSel.innerHTML = optHTML('', 'Elige tu ciudad o municipio') + cities.map((x) => optHTML(x)).join('') + optHTML(OTHER, 'Otra ciudad…');
    if (hit) { mSel.value = hit; mTxt.hidden = true; }
    else if (prev) { mSel.value = OTHER; mTxt.hidden = false; mTxt.value = prev; }
    else { mSel.value = ''; mTxt.hidden = true; }
  } else if (tree) {
    mSel.hidden = false; mSel.disabled = true; mTxt.hidden = true;
    mSel.innerHTML = optHTML('', 'Primero elige tu estado o región');
  } else {
    mSel.hidden = true; mSel.innerHTML = ''; mTxt.hidden = !cSel.value;
    if (want.municipio != null) mTxt.value = want.municipio;
  }
}
/* Ciudades sugeridas del estado de la persona (para crear comunidades por ciudad) */
function citiesOfMe() {
  const p = placeParts(ME), t = GEO[p.country];
  return (t && t[findIn(Object.keys(t), p.state) || '']) || [];
}
function wirePlace(p) {
  $(`#${p}Place`).innerHTML = placeFieldsHTML(p);
  const { cSel, cOth, sSel, mSel, mTxt } = pf(p);
  const main = Object.keys(GEO), rest = COUNTRIES.filter((c) => !main.includes(c)).sort((x, y) => x.localeCompare(y, 'es'));
  cSel.innerHTML = optHTML('', 'Elige tu país') + main.map((c) => optHTML(c)).join('')
    + `<optgroup label="Otros países">${rest.map((c) => optHTML(c)).join('')}</optgroup>` + optHTML(OTHER, 'Otro país…');
  cSel.addEventListener('change', () => { paintPlace(p, { state: '', municipio: '' }); if (cSel.value === OTHER) cOth.focus(); });
  sSel.addEventListener('change', () => paintPlace(p, { municipio: '' }));
  mSel.addEventListener('change', () => { mTxt.hidden = mSel.value !== OTHER; if (!mTxt.hidden) mTxt.focus(); });
  paintPlace(p);
}
/* Para "Editar perfil": pone el lugar actual (también perfiles antiguos con texto libre) */
function setPlace(p, place) {
  const { cSel, cOth } = pf(p);
  const hit = findIn(COUNTRIES, place.country);
  if (hit) { cSel.value = hit; cOth.value = ''; }
  else if (place.country) { cSel.value = OTHER; cOth.value = place.country; }
  else { cSel.value = ''; cOth.value = ''; }
  paintPlace(p, { state: place.state || '', municipio: place.municipio || '' });
}
/* Texto escrito a mano: espacios limpios y, si viene todo en minúsculas, con mayúscula inicial ("laredo" → "Laredo") */
const tidy = (s) => {
  const t = String(s || '').trim().replace(/\s+/g, ' ');
  return t && t === t.toLowerCase() ? t.replace(/(^|\s)(\S)/g, (m, sp, ch, off) => (off > 0 && /^(de|del|la|las|los|y|e)$/.test(t.slice(off + sp.length).split(' ')[0]) ? m : sp + ch.toUpperCase())) : t;
};
function readPlace(prefix) {
  const { cSel, cOth, sSel, sTxt, mSel, mTxt } = pf(prefix);
  const country = cSel.value === OTHER ? canonCountry(tidy(cOth.value)) : cSel.value;
  const state = !sSel.hidden ? sSel.value : tidy(sTxt.value);
  const raw = !mSel.hidden ? (mSel.value === OTHER ? mTxt.value : mSel.value) : mTxt.value;
  const tree = GEO[country], cities = tree && tree[findIn(Object.keys(tree), state) || ''];
  const municipio = canon(tidy(raw), cities || []);
  const colonia = $(`#${prefix}Colonia`).value.trim();
  return { country, state, municipio, colonia, city: buildCity({ colonia, municipio, state, country }) };
}
function placeError(p) {
  if (p.country.length < 2) return 'Elige tu país.';
  if (GEO[p.country] && !p.state) return 'Elige tu estado o región.';
  if (p.municipio.length < 2) return 'Elige tu ciudad o municipio (o escríbela en "Otra ciudad") para que te encuentren cerca.';
  return '';
}

const POST_TYPES = [
  { id: 'General', icon: 'pen-line' }, { id: 'Producto', icon: 'shopping-bag' }, { id: 'Servicio', icon: 'briefcase' },
  { id: 'Portafolio', icon: 'image' }, { id: 'Novedad', icon: 'megaphone' }, { id: 'Pregunta', icon: 'circle-help' },
  { id: 'Colaboración', icon: 'link' },
];
/* Comunidades iniciales: las carga un admin con un botón (ver "admins" en las instrucciones) */
const COMMUNITY_SEED = [
  { id: 'c4', name: 'Gastronomía local', kind: 'sector', tag: 'Gastronomía', desc: 'Cocinas, cafés y repostería: proveedores, recetas y eventos.', tone: 3 },
  { id: 'c5', name: 'Moda y textiles', kind: 'sector', tag: 'Moda', desc: 'Diseñadores y talleres que comparten técnicas y proveedores.', tone: 3 },
  { id: 'c6', name: 'Tecnología y datos', kind: 'sector', tag: 'Tecnología', desc: 'Desarrolladores y creadores de software ayudando a negocios locales.', tone: 4 },
  { id: 'c7', name: 'Arte y creatividad', kind: 'sector', tag: 'Arte y creatividad', desc: 'Fotografía, diseño y oficios: portafolios, retos y colaboraciones.', tone: 1 },
  { id: 'c8', name: 'Bienestar y salud', kind: 'sector', tag: 'Bienestar', desc: 'Terapias, nutrición y cuidado personal con enfoque responsable.', tone: 2 },
];
/* ---------- Estado ---------- */
let ME = null;          // perfil del usuario con sesión (users/{uid})
let IS_ADMIN = false;
const PAGE = 20;
const state = {
  feedTab: 'para-ti', feedCat: 'all',
  following: new Set(), liked: new Set(), saved: new Set(), joined: new Set(), blocked: new Set(), msgTab: 'chats',
  postType: 'General', onlyNew: false, onlyMyCity: false, comTab: 'todas',
};
const data = {
  feed: [], feedCursor: null, feedDone: false, feedLoading: false, feedAt: 0, feedError: false,
  people: [], peopleAt: 0, peopleLoading: false, peopleError: false,
  communities: [], commAt: 0, commLoading: false, commError: false,
  mine: [], mineLoading: false,
};
const resetData = () => {
  Object.assign(data, {
    feed: [], feedCursor: null, feedDone: false, feedLoading: false, feedAt: 0, feedError: false,
    people: [], peopleAt: 0, peopleLoading: false, peopleError: false,
    communities: [], commAt: 0, commLoading: false, commError: false,
    mine: [], mineLoading: false,
  });
};
/* Chat: bandeja en tiempo real + conversación abierta */
const chat = { list: [], ready: false, unsub: null, uid: null, ctx: null, warned: false };
let uview = null;   // perfil de otra persona que se está viendo
const fresh = (t) => t && Date.now() - t < 60000;

/* Caché de perfiles: nombre y fotos siempre al día aunque la publicación o el chat guardaran una copia vieja */
const uCache = new Map();
const cacheUsers = (list) => list.forEach((u) => u.uid && uCache.set(u.uid, { ...u, _t: Date.now() }));
/* Palomita roja de cuenta verificada (correo confirmado). Se guarda en el perfil como verified:true
   y las reglas de Firestore solo lo aceptan si el token de Firebase dice que el correo está verificado. */
const VBADGE = '<span class="vbadge" role="img" aria-label="Cuenta verificada" title="Cuenta verificada"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 1.8l2.4 1.9 3-.3 1.2 2.8 2.8 1.2-.3 3L23 12l-1.9 2.4.3 3-2.8 1.2-1.2 2.8-3-.3L12 23l-2.4-1.9-3 .3-1.2-2.8-2.8-1.2.3-3L1 12l1.9-2.4-.3-3 2.8-1.2 1.2-2.8 3 .3z"/><path d="M8 12.3l2.7 2.7 5.6-5.6" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>';
const vbadge = (u) => (u && u.verified === true ? VBADGE : '');
const liveUser = (uid, fallback = {}) => (ME && uid === ME.uid ? ME : uCache.get(uid)) || fallback;
/* Cada persona corrige su propio perfil al entrar: "Jal" → "Jalisco", sin país → México, etc. */
async function healPlace() {
  if (!ME) return;
  const p = placeParts(ME), changes = {};
  if (ME.country !== p.country) changes.country = p.country;
  if ((ME.state ?? '') !== p.state && (p.state || ME.state != null)) changes.state = p.state;
  if (p.municipio && ME.municipio !== p.municipio) changes.municipio = p.municipio;
  if (!Object.keys(changes).length) return;
  changes.city = buildCity({ colonia: ME.colonia, municipio: p.municipio || ME.municipio || '', state: p.state, country: p.country });
  try { await updateDoc(doc(db, 'users', ME.uid), changes); Object.assign(ME, changes); data.peopleAt = 0; }
  catch (e) { console.debug('healPlace', e && e.code); }
}
/* Mantiene el perfil al día: verified:true solo si el correo de Firebase está verificado */
async function syncVerified() {
  const u = auth.currentUser;
  if (!u || !ME || ME.uid !== u.uid) return;
  try {
    if (!u.emailVerified && !ME.verified) await u.reload();          // por si lo verificó desde otro dispositivo
    const want = !!u.emailVerified;
    if (!!ME.verified === want) return;
    await u.getIdToken(true);                                         // las reglas leen el token: hay que renovarlo
    await updateDoc(doc(db, 'users', ME.uid), { verified: want });
    ME.verified = want;
    if (!$('#view-perfil').hidden) renderProfile();
  } catch (e) { console.debug('syncVerified', e && e.code); }
}
async function ensureUsers(uids) {
  const miss = [...new Set(uids)].filter((u) => u && !(ME && u === ME.uid) && !(uCache.get(u) && Date.now() - uCache.get(u)._t < 300000)).slice(0, 30);
  if (!miss.length) return false;
  let changed = false;
  await Promise.all(miss.map((uid) => getDoc(doc(db, 'users', uid)).then((s) => {
    if (s.exists()) { uCache.set(uid, { uid, ...s.data(), _t: Date.now() }); changed = true; }
  }).catch(() => {})));
  return changed;
}

/* ---------- Sesión ---------- */
let sessionTask = null;
let registering = false;
let authReady = false;
let resolveAuthReady;
const authReadyPromise = new Promise((r) => { resolveAuthReady = r; });
const isLoggedIn = () => !!ME;

function clearSession() {
  resetChat(); stopNotifs(); leaveCommunity(); uCache.clear(); uview = null;
  ME = null; IS_ADMIN = false; sessionTask = null;
  ['following', 'liked', 'saved', 'joined', 'blocked'].forEach((k) => (state[k] = new Set()));
  state.msgTab = 'chats'; state.feedTab = 'para-ti'; state.feedCat = 'all';
  $$('#feedTabs .tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === 'para-ti'));
  const fc = $('#feedCat'); if (fc) fc.value = 'all';
  resetData();
}
async function loadSession(user, force = false) {
  if (!force && sessionTask && sessionTask.uid === user.uid) return sessionTask.p;
  const p = (async () => {
    const snap = await getDoc(doc(db, 'users', user.uid));
    if (!snap.exists()) return false;
    const ids = async (sub) => new Set((await getDocs(collection(db, 'users', user.uid, sub))).docs.map((d) => d.id));
    const [following, liked, saved, joined, blocked, admin] = await Promise.all([
      ids('following'), ids('likedPosts'), ids('saved'), ids('joined'), ids('blocked').catch(() => new Set()),
      getDoc(doc(db, 'admins', user.uid)).then((x) => x.exists()).catch(() => false),
    ]);
    ME = { uid: user.uid, ...snap.data() };
    Object.assign(state, { following, liked, saved, joined, blocked });
    IS_ADMIN = admin;
    setTimeout(syncVerified, 0);
    setTimeout(healPlace, 0);
    return true;
  })();
  sessionTask = { uid: user.uid, p };
  try { return await p; } catch (e) { sessionTask = null; throw e; }
}

/* ---------- Router ---------- */
const APP_VIEWS = ['inicio', 'explorar', 'crear', 'comunidad', 'perfil', 'mensajes', 'chat', 'u', 'notificaciones'];
const AUTH_VIEWS = ['login', 'registro'];
function route() {
  if (!authReady) return;
  const [v, arg = ''] = (location.hash.replace('#', '') || 'landing').split('/');
  if (APP_VIEWS.includes(v) && !isLoggedIn()) { toast('Inicia sesión para continuar'); location.replace('#login'); return; }
  if (AUTH_VIEWS.includes(v) && isLoggedIn() && !registering) { location.replace('#inicio'); return; }
  const isApp = APP_VIEWS.includes(v);
  const isAuth = AUTH_VIEWS.includes(v);
  $('#landing').hidden = isApp || isAuth;
  $('#app').hidden = !isApp;
  $('#login').hidden = v !== 'login';
  $('#registro').hidden = v !== 'registro';
  renderLandingCtas();
  if (isLoggedIn()) { startInbox(); startNotifs(); }
  if (v !== 'notificaciones') NOTIF.hl.clear();
  const inComm = v === 'comunidad' && !!arg;
  if (v !== 'chat') leaveChat();
  if (!inComm) leaveCommunity();
  if (v !== 'u') uview = null;
  $('#app').classList.toggle('in-chat', v === 'chat' || inComm);

  if (isApp) {
    $$('.view').forEach((s) => (s.hidden = s.id !== `view-${inComm ? 'comm' : v === 'u' ? 'user' : v}`));
    $$('.bottom-nav a').forEach((a) => {
      const on = a.dataset.view === v;
      a.classList.toggle('active', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    applyMe();
    ({ inicio: showInicio, explorar: showExplorar, crear: renderTypeChips, comunidad: () => (inComm ? showCommunity(arg) : showComunidad()), perfil: showPerfil, mensajes: showMensajes, notificaciones: showNotifs, chat: () => showChat(arg), u: () => showUser(arg) }[v])();
    if (v !== 'chat' && !inComm) window.scrollTo(0, 0);
  } else if (isAuth) {
    window.scrollTo(0, 0);
  } else if (v !== 'landing') {
    requestAnimationFrame(() => document.getElementById(v)?.scrollIntoView());
  } else {
    window.scrollTo(0, 0);
    loadLandingCommunities();
  }
  $('#landMenu').hidden = true;
  $('#menuBtn').setAttribute('aria-expanded', 'false');
  icons();
}
window.addEventListener('hashchange', route);

/* ---------- Landing ---------- */
/* Con sesión iniciada, los botones de "crear perfil" pasan a "Entrar a mi perfil" */
function renderLandingCtas() {
  const inn = isLoggedIn();
  const hero = $('#heroCta'), menu = $('#menuCta');
  hero.setAttribute('href', inn ? '#perfil' : '#registro');
  menu.setAttribute('href', inn ? '#perfil' : '#registro');
  hero.innerHTML = inn ? '<i data-lucide="user-round"></i> Entrar a mi perfil' : '<i data-lucide="user-plus"></i> Crear mi perfil gratis';
  menu.textContent = inn ? 'Entrar a mi perfil' : 'Crear mi perfil gratis';
  $('#heroLogin').hidden = inn;
  $('#menuLogin').hidden = inn;
}
function renderLandingCategories() {
  $('#catGrid').innerHTML = CATEGORIES.map((c) => `
    <a class="cat-card" href="#explorar" data-cat="${esc(c.name)}">
      <span class="cat-ico"><i data-lucide="${c.icon}"></i></span>
      <h3>${esc(c.name)}</h3><p>${esc(c.desc)}</p></a>`).join('');
}
/* "Mejor en compañía": las comunidades que crearon los usuarios (más miembros primero) */
const landing = { list: null, at: 0, loading: false, error: false };
async function loadLandingCommunities(force = false) {
  if (landing.loading || (!force && landing.list && Date.now() - landing.at < 60000)) return;
  landing.loading = true; renderLandingCommunities();
  try {
    const s = await getDocs(query(collection(db, 'communities'), orderBy('createdAt', 'desc'), limit(40)));
    landing.list = s.docs.map((d) => ({ id: d.id, ...d.data() })).filter((c) => c.ownerUid)
      .sort((x, y) => (y.membersCount || 0) - (x.membersCount || 0) || toMs(y.createdAt) - toMs(x.createdAt)).slice(0, 3);
    landing.error = false; landing.at = Date.now();
  } catch (e) { console.debug('landing communities', e && e.code); landing.error = true; if (!landing.list) landing.list = []; }
  landing.loading = false; renderLandingCommunities();
}
function renderLandingCommunities() {
  const box = $('#landCom'); if (!box) return;
  if (!landing.list) { box.innerHTML = '<p class="muted">Cargando comunidades…</p>'; return; }
  if (!landing.list.length) {
    box.innerHTML = `<p class="muted">${landing.error ? 'No pudimos cargar las comunidades ahora. Intenta de nuevo en un momento.' : 'Aún no hay comunidades creadas por la gente. Con 10 seguidores puedes crear la primera.'}</p>`;
    return;
  }
  const kinds = { sector: 'Sector', ciudad: 'Ciudad', grupo: 'Grupo' };
  box.innerHTML = landing.list.map((c) => {
    const [f1, f2] = colorsFor(c.name), n = c.membersCount || 0;
    return `<a class="com-hero" href="#comunidad/${esc(c.id)}" style="--f1:${f1};--f2:${f2}">
      <small>${esc([kinds[c.kind] || 'Comunidad', c.tag].filter(Boolean).join(' · '))}</small><h3>${esc(c.name)}</h3>
      <span class="meta-line">${n.toLocaleString('es-MX')} ${n === 1 ? 'miembro' : 'miembros'}${c.ownerName ? ` · Creada por ${esc(c.ownerName)}` : ''}</span></a>`;
  }).join('');
}
/* Logo: siempre regresa al bloque inicial de la landing */
$$('.brand').forEach((brand) => brand.addEventListener('click', (e) => {
  e.preventDefault();
  const current = location.hash.replace('#', '') || 'landing';
  if (current === 'landing') window.scrollTo({ top: 0, behavior: 'smooth' });
  else location.hash = 'landing';
  $('#landMenu').hidden = true;
  $('#menuBtn').setAttribute('aria-expanded', 'false');
}));
$('#menuBtn').addEventListener('click', () => {
  const m = $('#landMenu');
  m.hidden = !m.hidden;
  $('#menuBtn').setAttribute('aria-expanded', String(!m.hidden));
});

/* ---------- Selects compartidos ---------- */
function fillSelects() {
  const catOpts = CATEGORIES.map((c) => `<option>${esc(c.name)}</option>`).join('');
  $('#feedCat').innerHTML = `<option value="all">Todas las categorías</option>${catOpts}`;
  $('#exCat').innerHTML = `<option value="all">Todas las categorías</option>${catOpts}`;
  $('#exCountry').innerHTML = '<option value="all">Todos los países</option>';
  $('#postCat').innerHTML = catOpts;
  $('#rCat').innerHTML = catOpts;
  $('#eCat').innerHTML = catOpts;
}

['r', 'e'].forEach(wirePlace);

/* ---------- Datos del usuario en la interfaz ---------- */
function applyMe() {
  if (!ME) return;
  const [c1, c2] = colorsFor(ME.name);
  const av = cleanUrl(ME.avatar);
  [...$$('[data-me]'), $('#topAvatar')].forEach((el) => {
    el.style.setProperty('--c1', c1); el.style.setProperty('--c2', c2);
    el.classList.remove('loaded');
    el.innerHTML = esc(initials(ME.name)) + avatarImg(av, ME.avatarPos);
  });
  $$('[data-me-name]').forEach((el) => (el.textContent = ME.name));
  $$('[data-me-handle]').forEach((el) => (el.textContent = ME.handle));
  const h = new Date().getHours();
  $('#greeting').textContent = `${h < 12 ? 'Buen día' : h < 19 ? 'Buenas tardes' : 'Buenas noches'}, ${ME.name}`;
  if (ME.category) $('#postCat').value = ME.category;
  renderOnboarding();
}
function renderOnboarding() {
  const checks = [
    ['agregar tu foto de perfil', !!cleanUrl(ME.avatar)],
    ['subir una portada', !!cleanUrl(ME.cover)],
    ['escribir tu descripción', !!String(ME.bio || '').trim()],
    ['agregar tus redes de contacto', Object.keys(ME.socials || {}).length > 0],
  ];
  const missing = checks.filter((c) => !c[1]).map((c) => c[0]);
  const pct = Math.round(((checks.length - missing.length) / checks.length) * 100);
  $('#onboard').hidden = pct === 100 || store.get(`brivian.onboardClosed.${ME.uid}`, false);
  $('#onboardText').textContent = `Te ${missing.length === 1 ? 'falta un paso' : `faltan ${missing.length} pasos`}: ${missing.join(', ')}.`;
  $('#onboardBar').style.width = `${pct}%`;
  $('#onboardProgress').setAttribute('aria-valuenow', String(pct));
  $('#onboardPct').textContent = `Perfil completo al ${pct}%`;
}
$('#onboardClose').addEventListener('click', () => { $('#onboard').hidden = true; if (ME) store.set(`brivian.onboardClosed.${ME.uid}`, true); });

/* ============================================================
   INICIO · feed
   ============================================================ */
const placeFor = (p) => placeText(p) || 'México';

function postHTML(p) {
  const liked = state.liked.has(p.id), saved = state.saved.has(p.id), follow = state.following.has(p.authorUid);
  const mine = ME && p.authorUid === ME.uid;
  const img = cleanUrl(p.imageUrl);
  const tags = (p.tags || []).slice(0, 5);
  const a = liveUser(p.authorUid, p);
  return `<article class="card post" data-id="${esc(p.id)}" data-author="${esc(p.authorUid)}">
    <div class="post-head" data-user="${esc(p.authorUid)}">
      ${avatarHTML(a.name || p.name, 'md', a.avatar, a.avatarPos)}
      <div class="post-who">
        <strong>${esc(a.name || p.name)}</strong>${vbadge(a)}<span class="badge t-${esc(p.type)}">${esc(p.type)}</span>
        <div class="post-sub">@${esc(p.handle)} · <span class="cat">${esc(p.cat)}</span> · ${esc(placeFor(p))} · ${timeAgo(p.createdAt)}</div>
      </div>
      ${mine ? '' : `<button class="btn btn-sm ${follow ? 'btn-soft' : 'btn-outline'}" data-act="follow">${follow ? 'Siguiendo' : 'Seguir'}</button>`}
    </div>
    <p class="post-body">${esc(p.body)}</p>
    ${tags.length ? `<div class="post-tags">${tags.map((t) => `<span>#${esc(t)}</span>`).join('')}</div>` : ''}
    ${img ? `<div class="post-media"><img class="post-img" src="${esc(img)}" alt="" loading="lazy" referrerpolicy="no-referrer"${posOf(p.imgPos) ? ` style="${esc(posCss(p.imgPos))}"` : ''}></div>` : ''}
    <div class="post-actions">
      <button class="act ${liked ? 'on' : ''}" data-act="like" aria-pressed="${liked}" aria-label="Me gusta"><i data-lucide="heart"></i> ${Math.max(0, p.likesCount || 0)}</button>
      <button class="act" data-act="comment" aria-label="Comentarios"><i data-lucide="message-circle"></i> ${Math.max(0, p.commentsCount || 0)}</button>
      ${mine ? '' : `<a class="act" href="#chat/${esc(chatIdFor(p.authorUid))}" aria-label="Enviar mensaje"><i data-lucide="send"></i></a>`}
      ${mine ? '<button class="act del" data-act="delete" aria-label="Eliminar publicación"><i data-lucide="trash-2"></i></button>' : ''}
      <button class="act save ${saved ? 'on' : ''}" data-act="save" aria-pressed="${saved}" aria-label="Guardar"><i data-lucide="bookmark"></i></button>
    </div></article>`;
}
const postMs = (p) => (p.createdAt ? toMs(p.createdAt) : Date.now());
function filteredPosts() {
  let list = data.feed.filter((p) => !state.blocked.has(p.authorUid));
  if (state.feedCat !== 'all') list = list.filter((p) => p.cat === state.feedCat);
  if (state.feedTab === 'siguiendo') list = list.filter((p) => state.following.has(p.authorUid));
  else if (state.feedTab === 'mi-zona') list = list.filter((p) => sameCity(p, ME));
  list = list.slice();
  if (state.feedTab === 'para-ti') {
    // Primero lo de la gente que sigues y de tu ciudad; dentro de cada grupo, lo más nuevo
    const score = (p) => (state.following.has(p.authorUid) ? 2 : 0) + (sameCity(p, ME) ? 1 : 0);
    list.sort((x, y) => score(y) - score(x) || postMs(y) - postMs(x));
  } else {
    list.sort((x, y) => postMs(y) - postMs(x));
  }
  return list;
}
/* Si un filtro deja muy pocas publicaciones, se cargan más páginas solas (hasta 6) */
function maybeFill() {
  const narrow = state.feedTab === 'siguiendo' || state.feedTab === 'mi-zona' || state.feedCat !== 'all';
  if (narrow && !data.feedLoading && !data.feedDone && data.feed.length && filteredPosts().length < 5 && (data.fill || 0) < 6) {
    data.fill = (data.fill || 0) + 1; loadFeed(false);
  }
}
function renderFeed() {
  const box = $('#feed');
  if (data.feedLoading && !data.feed.length) { box.innerHTML = '<div class="loading">Cargando publicaciones…</div>'; $('#feedMore').hidden = true; return; }
  if (data.feedError && !data.feed.length) {
    box.innerHTML = '<div class="empty">No pudimos cargar las publicaciones.<br><button class="btn btn-outline" data-retry="feed">Reintentar</button></div>';
    $('#feedMore').hidden = true; return;
  }
  const list = filteredPosts();
  let msg = 'No hay publicaciones con estos filtros.';
  if (!data.feed.length) msg = 'Aún no hay publicaciones. ¡Sé la primera persona en publicar!';
  else if (data.feedLoading) msg = 'Buscando publicaciones…';
  else if (state.feedTab === 'siguiendo') msg = state.following.size ? 'Las personas que sigues aún no han publicado. Vuelve pronto.' : 'Aún no sigues a nadie. Entra a Explorar y sigue negocios para ver sus publicaciones aquí.';
  else if (state.feedTab === 'mi-zona') msg = `Aún no hay publicaciones en ${placeText(ME) || 'tu zona'}. Mira "Recientes" para ver a todos.`;
  box.innerHTML = list.length ? list.map(postHTML).join('') : `<div class="empty">${msg}</div>`;
  $('#feedMore').hidden = data.feedDone || !data.feed.length;
  $('#feedMore').disabled = data.feedLoading;
  icons();
}
async function loadFeed(reset = false) {
  if (data.feedLoading) return;
  if (reset) Object.assign(data, { feed: [], feedCursor: null, feedDone: false, feedError: false, fill: 0 });
  if (data.feedDone) { renderFeed(); return; }
  data.feedLoading = true; data.feedError = false;
  renderFeed();
  try {
    const parts = [orderBy('createdAt', 'desc')];
    if (data.feedCursor) parts.push(startAfter(data.feedCursor));
    parts.push(limit(PAGE));
    const snap = await getDocs(query(collection(db, 'posts'), ...parts));
    snap.docs.forEach((d) => data.feed.push({ id: d.id, ...d.data() }));
    if (snap.docs.length) data.feedCursor = snap.docs[snap.docs.length - 1];
    if (snap.docs.length < PAGE) data.feedDone = true;
    data.feedAt = Date.now();
  } catch (e) {
    console.error(e); data.feedError = true; toast(authError(e));
  }
  data.feedLoading = false;
  renderFeed();
  ensureUsers(data.feed.map((p) => p.authorUid)).then((ch) => { if (ch && !$('#view-inicio').hidden) renderFeed(); });
  maybeFill();
}
function showInicio() {
  if (!fresh(data.feedAt)) loadFeed(true); else renderFeed();
}
$('#feedTabs').addEventListener('click', (e) => {
  const b = e.target.closest('.tab'); if (!b) return;
  state.feedTab = b.dataset.tab;
  $$('#feedTabs .tab').forEach((t) => t.classList.toggle('active', t === b));
  data.fill = 0; renderFeed(); maybeFill();
});
$('#feedCat').addEventListener('change', (e) => { state.feedCat = e.target.value; data.fill = 0; renderFeed(); maybeFill(); });
$('#feedMore').addEventListener('click', () => { data.fill = 0; loadFeed(false); });
$('.composer-chips').addEventListener('click', (e) => {
  const a = e.target.closest('[data-type]'); if (a) state.postType = a.dataset.type;
});

/* --- Acciones sobre publicaciones (like, guardar, seguir, eliminar) --- */
const forPost = (id, fn) => [...data.feed, ...data.mine].filter((x) => x.id === id).forEach(fn);
const findPost = (id) => data.feed.find((x) => x.id === id) || data.mine.find((x) => x.id === id) || (uview && uview.posts.find((x) => x.id === id));

async function toggleLike(p) {
  const liked = state.liked.has(p.id);
  const b = writeBatch(db);
  const likeRef = doc(db, 'posts', p.id, 'likes', ME.uid);
  const mineRef = doc(db, 'users', ME.uid, 'likedPosts', p.id);
  if (liked) { b.delete(likeRef); b.delete(mineRef); } else { b.set(likeRef, { at: serverTimestamp() }); b.set(mineRef, { at: serverTimestamp() }); }
  b.update(doc(db, 'posts', p.id), { likesCount: increment(liked ? -1 : 1) });
  await b.commit();
  if (!liked) notify(p.authorUid, 'like', { targetId: p.id }, `like_${p.id}_${ME.uid}`);
  if (liked) state.liked.delete(p.id); else state.liked.add(p.id);
  forPost(p.id, (x) => { x.likesCount = Math.max(0, (x.likesCount || 0) + (liked ? -1 : 1)); });
}
async function toggleSave(p) {
  const ref = doc(db, 'users', ME.uid, 'saved', p.id);
  if (state.saved.has(p.id)) { await deleteDoc(ref); state.saved.delete(p.id); toast('Quitado de guardados'); }
  else { await setDoc(ref, { at: serverTimestamp() }); state.saved.add(p.id); toast('Guardado'); }
}
async function toggleFollow(uid, name) {
  if (!uid || uid === ME.uid) return;
  const on = state.following.has(uid);
  const b = writeBatch(db);
  const ref = doc(db, 'users', ME.uid, 'following', uid);
  if (on) b.delete(ref); else b.set(ref, { at: serverTimestamp() });
  b.update(doc(db, 'users', uid), { followersCount: increment(on ? -1 : 1) });
  await b.commit();
  if (!on) notify(uid, 'follow', {}, `follow_${ME.uid}`);
  if (on) state.following.delete(uid); else state.following.add(uid);
  const person = data.people.find((x) => x.uid === uid);
  if (person) person.followersCount = Math.max(0, (person.followersCount || 0) + (on ? -1 : 1));
  toast(on ? `Dejaste de seguir a ${name}` : `Sigues a ${name}`);
}
async function removePost(p) {
  if (!window.confirm('¿Eliminar esta publicación? No se puede deshacer.')) return false;
  await deleteDoc(doc(db, 'posts', p.id));
  data.feed = data.feed.filter((x) => x.id !== p.id);
  data.mine = data.mine.filter((x) => x.id !== p.id);
  toast('Publicación eliminada');
  return true;
}
async function onPostAction(e, rerender) {
  const btn = e.target.closest('[data-act]'); if (!btn || btn.disabled) return;
  const card = btn.closest('.post'); if (!card) return;
  const p = findPost(card.dataset.id); if (!p) return;
  const act = btn.dataset.act;
  if (act === 'comment') { toast('Los comentarios llegan en la siguiente versión'); return; }
  btn.disabled = true;
  try {
    if (act === 'like') await toggleLike(p);
    if (act === 'save') await toggleSave(p);
    if (act === 'follow') await toggleFollow(p.authorUid, p.name);
    if (act === 'delete') await removePost(p);
  } catch (err) { console.error(err); toast(authError(err)); }
  rerender();
}
$('#feed').addEventListener('click', (e) => {
  if (e.target.closest('[data-retry="feed"]')) { loadFeed(true); return; }
  onPostAction(e, renderFeed);
});
$('#myPosts').addEventListener('click', (e) => onPostAction(e, renderProfile));

/* Si una imagen (URL externa) no carga, se oculta en vez de mostrarse rota */
document.addEventListener('error', (e) => {
  if (e.target?.matches?.('img.post-img, img.preview')) { e.target.hidden = true; if (e.target.parentElement.classList.contains('post-media')) e.target.parentElement.hidden = true; }
}, true);

/* ============================================================
   EXPLORAR
   ============================================================ */
async function loadPeople(force = false) {
  if (data.peopleLoading || (!force && fresh(data.peopleAt))) { renderResults(); return; }
  data.peopleLoading = true; data.peopleError = false;
  renderResults();
  try {
    const snap = await getDocs(query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(100)));
    data.people = snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
    cacheUsers(data.people);
    data.peopleAt = Date.now();
    fillLocFilter();
  } catch (e) { console.error(e); data.peopleError = true; toast(authError(e)); }
  data.peopleLoading = false;
  renderResults();
}
/* Filtro de ubicación de Explorar: País → Estado o región → Ciudad. Por defecto se ve a todos;
   las opciones salen de los perfiles que existen (con cuántos hay en cada una). */
const countBy = (arr, fn) => { const m = new Map(); arr.forEach((x) => { const k = fn(x); if (k) m.set(k, (m.get(k) || 0) + 1); }); return [...m.entries()].sort((x, y) => x[0].localeCompare(y[0], 'es')); };
function fillLocFilter() {
  const cSel = $('#exCountry'), sSel = $('#exState'), mSel = $('#exCity');
  const prev = { c: cSel.value || 'all', s: sSel.value || 'all', m: mSel.value || 'all' };
  const opt = (v, l) => `<option value="${esc(v)}">${esc(l)}</option>`;
  const fill = (sel, all, entries, want) => {
    sel.innerHTML = opt('all', all) + entries.map(([k, n]) => opt(k, `${k} (${n})`)).join('');
    sel.value = entries.some(([k]) => k === want) ? want : 'all';
  };
  const ps = data.people.map((b) => placeParts(b));
  fill(cSel, 'Todos los países', countBy(ps, (p) => p.country), prev.c);
  const inC = ps.filter((p) => cSel.value === 'all' || p.country === cSel.value);
  const states = countBy(inC, (p) => p.state);
  sSel.hidden = cSel.value === 'all' || !states.length;
  fill(sSel, 'Todos los estados o regiones', states, prev.s);
  const inS = inC.filter((p) => sSel.value === 'all' || p.state === sSel.value);
  const cities = countBy(inS, (p) => p.municipio);
  mSel.hidden = cSel.value === 'all' || !cities.length;
  fill(mSel, 'Todas las ciudades', cities, prev.m);
}
function locMatch(b) {
  const c = $('#exCountry').value, s = $('#exState').value, m = $('#exCity').value;
  if (c === 'all') return true;
  const p = placeParts(b);
  return p.country === c && (s === 'all' || $('#exState').hidden || p.state === s) && (m === 'all' || $('#exCity').hidden || p.municipio === m);
}
function showExplorar() { loadPeople(); }
function renderResults() {
  const box = $('#results');
  if (data.peopleLoading && !data.people.length) { box.innerHTML = '<div class="loading">Cargando emprendimientos…</div>'; $('#resultsCount').textContent = ''; return; }
  if (data.peopleError && !data.people.length) {
    box.innerHTML = '<div class="empty">No pudimos cargar los emprendimientos.<br><button class="btn btn-outline" data-retry="people">Reintentar</button></div>';
    $('#resultsCount').textContent = ''; return;
  }
  const q = $('#q').value.trim().toLowerCase();
  const cat = $('#exCat').value;
  const monthAgo = Date.now() - 30 * 864e5;
  const list = data.people.filter((b) =>
    (!q || `${b.name} ${b.category} ${b.bio || ''} ${b.role || ''} ${b.handle} ${placeText(b)}`.toLowerCase().includes(q)) &&
    (cat === 'all' || b.category === cat) &&
    locMatch(b) &&
    (!state.onlyNew || toMs(b.createdAt) > monthAgo) &&
    (!state.onlyMyCity || sameCity(b, ME)));
  $('#resultsCount').textContent = `${list.length} ${list.length === 1 ? 'emprendimiento' : 'emprendimientos'}`;
  box.innerHTML = list.length
    ? list.map((b) => {
        const f = state.following.has(b.uid), me = b.uid === ME.uid;
        const isNew = toMs(b.createdAt) > monthAgo;
        return `<article class="card biz" data-uid="${esc(b.uid)}" data-user="${esc(b.uid)}">
          ${avatarHTML(b.name, 'md', b.avatar, b.avatarPos)}
          <div class="biz-info"><strong>${esc(b.name)}</strong>${vbadge(b)} ${isNew ? '<span class="badge">Nuevo</span>' : ''}${me ? ' <span class="badge neutral">Tú</span>' : ''}
            <p>${esc(b.bio || b.role || '')}</p><small>${esc(b.category)} · ${esc(placeText(b))}</small>${quickLinks(b.socials)}</div>
          ${me ? '' : `<div class="biz-actions"><button class="btn btn-sm ${f ? 'btn-soft' : 'btn-outline'}" data-follow="${esc(b.uid)}">${f ? 'Siguiendo' : 'Seguir'}</button>
            <a class="btn btn-sm btn-outline" href="#chat/${esc(chatIdFor(b.uid))}" aria-label="Enviar mensaje a ${esc(b.name)}"><i data-lucide="message-circle"></i> Mensaje</a></div>`}</article>`;
      }).join('')
    : `<div class="empty">${data.people.length ? 'No encontramos resultados. Prueba con otra palabra o quita algún filtro.' : 'Aún no hay emprendimientos registrados.'}</div>`;
  icons();
}
['#q', '#exCat'].forEach((s) => $(s).addEventListener('input', renderResults));
['#exCountry', '#exState', '#exCity'].forEach((s) => $(s).addEventListener('change', () => { fillLocFilter(); renderResults(); }));
$('#chipNew').addEventListener('click', (e) => { state.onlyNew = !state.onlyNew; e.currentTarget.classList.toggle('active', state.onlyNew); renderResults(); });
$('#chipCity').addEventListener('click', (e) => { state.onlyMyCity = !state.onlyMyCity; e.currentTarget.classList.toggle('active', state.onlyMyCity); renderResults(); });
$('#catGrid').addEventListener('click', (e) => {
  const card = e.target.closest('[data-cat]');
  if (card) $('#exCat').value = card.dataset.cat;
});
$('#results').addEventListener('click', async (e) => {
  if (e.target.closest('[data-retry="people"]')) { loadPeople(true); return; }
  const b = e.target.closest('[data-follow]'); if (!b || b.disabled) return;
  const uid = b.dataset.follow;
  b.disabled = true;
  try { await toggleFollow(uid, data.people.find((x) => x.uid === uid)?.name || ''); }
  catch (err) { console.error(err); toast(authError(err)); }
  renderResults();
});

/* ============================================================
   CREAR PUBLICACIÓN
   ============================================================ */
function renderTypeChips() {
  $('#typeChips').innerHTML = POST_TYPES.map((t) =>
    `<button type="button" class="chip ${t.id === state.postType ? 'active' : ''}" data-type="${t.id}"><i data-lucide="${t.icon}"></i> ${t.id}</button>`).join('');
  icons();
}
$('#typeChips').addEventListener('click', (e) => {
  const c = e.target.closest('[data-type]'); if (!c) return;
  state.postType = c.dataset.type; renderTypeChips();
});
$('#postBody').addEventListener('input', (e) => {
  $('#counter').textContent = `${e.target.value.length} / 500`;
  $('#publishBtn').disabled = e.target.value.trim().length < 3;
});
const POST = { url: '', pos: null };
function setPreview(u) {
  POST.url = u || '';
  const img = $('#preview'), box = $('#previewBox');
  if (u) { box.hidden = false; img.hidden = false; if (img.getAttribute('src') !== u) img.src = u; img.style.cssText = posCss(POST.pos); }
  else { box.hidden = true; img.hidden = true; img.removeAttribute('src'); }
}
watchImageInput($('#postImgUrl'), $('#postImgStatus'), setPreview);
const postAdj = wireAdjust({ input: $('#postImgUrl'), btn: $('#postImgAdj'), kind: 'photo', get: () => POST.pos, set: (p) => { POST.pos = p; setPreview(POST.url); } });
$('#postForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const body = $('#postBody').value.trim();
  if (body.length < 3) return;
  const rawImg = $('#postImgUrl').value.trim();
  const imageUrl = (await resolveImage(rawImg)).url;
  if (rawImg && !imageUrl) { $('#postImgStatus').textContent = IMG_HELP; $('#postImgStatus').className = 'img-status bad'; toast('No encontramos la imagen de ese enlace.'); return; }
  const tags = $('#postTags').value.split(',').map((t) => t.trim().replace(/^#/, '').slice(0, 30)).filter(Boolean).slice(0, 5);
  const post = {
    authorUid: ME.uid, handle: ME.handle, name: ME.name, avatar: cleanUrl(ME.avatar),
    cat: $('#postCat').value, ...placeParts(ME), type: state.postType, body, tags, imageUrl, ...(imageUrl && POST.pos ? { imgPos: POST.pos } : {}),
    likesCount: 0, commentsCount: 0, createdAt: serverTimestamp(),
  };
  const btn = $('#publishBtn');
  btn.disabled = true;
  try {
    const ref = await addDoc(collection(db, 'posts'), post);
    const local = { id: ref.id, ...post, createdAt: new Date() };
    data.feed.unshift(local);
    data.mine.unshift({ ...local });
    e.target.reset();
    state.postType = 'General';
    POST.pos = null; setPreview(''); postAdj.sync(); $('#counter').textContent = '0 / 500';
    renderTypeChips();
    toast('Publicación creada');
    state.feedTab = 'recientes';
    $$('#feedTabs .tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === 'recientes'));
    location.hash = 'inicio';
  } catch (err) { console.error(err); toast(authError(err)); btn.disabled = false; }
});

/* ============================================================
   COMUNIDAD
   ============================================================ */
async function loadCommunities(force = false) {
  if (data.commLoading || (!force && fresh(data.commAt))) { renderCommunities(); return; }
  data.commLoading = true; data.commError = false;
  renderCommunities();
  try {
    const snap = await getDocs(query(collection(db, 'communities'), orderBy('order')));
    data.communities = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    data.commAt = Date.now();
  } catch (e) { console.error(e); data.commError = true; toast(authError(e)); }
  data.commLoading = false;
  renderCommunities();
}
function showComunidad() {
  renderCreateBox();
  refreshMe().then(renderCreateBox);   // trae el número de seguidores más reciente
  loadCommunities();
}

/* ---- Crear comunidades y grupos: se desbloquea con 10 seguidores ---- */
const FOLLOWERS_TO_CREATE = 10;
const followersNow = () => Math.max(0, (ME && ME.followersCount) || 0);
const canCreateCommunity = () => followersNow() >= FOLLOWERS_TO_CREATE;
async function refreshMe() {
  if (!ME) return;
  try {
    const s = await getDoc(doc(db, 'users', ME.uid));
    if (s.exists()) ME = { uid: ME.uid, ...s.data() };
  } catch (e) { console.warn('No se pudo actualizar el perfil', e); }
}
function renderCreateBox() {
  if (!ME) return;
  const n = followersNow();
  $('#createBox').innerHTML = canCreateCommunity()
    ? '<button class="btn btn-primary btn-block" id="newCommBtn" type="button"><i data-lucide="plus"></i> Crear comunidad o grupo</button>'
    : `<div class="card onboard">
        <div class="onboard-head"><span class="onboard-ico"><i data-lucide="lock"></i></span>
          <div><h3>Crea tus propias comunidades y grupos</h3>
            <p>Se desbloquea al llegar a ${FOLLOWERS_TO_CREATE} seguidores. Llevas ${n} de ${FOLLOWERS_TO_CREATE}: te ${FOLLOWERS_TO_CREATE - n === 1 ? 'falta 1' : `faltan ${FOLLOWERS_TO_CREATE - n}`}.</p></div></div>
        <div class="progress" role="progressbar" aria-valuenow="${n}" aria-valuemin="0" aria-valuemax="${FOLLOWERS_TO_CREATE}" style="margin-top:14px"><span style="width:${Math.min(100, (n / FOLLOWERS_TO_CREATE) * 100)}%"></span></div>
      </div>`;
  icons();
}
function fillCommTags() {
  const kind = $('#cKind').value;
  const opts = kind === 'ciudad' ? [...new Set([placeParts(ME).municipio, ...citiesOfMe()].filter(Boolean))] : kind === 'grupo' ? ['General', ...CATEGORIES.map((c) => c.name)] : CATEGORIES.map((c) => c.name);
  $('#cTag').innerHTML = opts.map((o) => `<option>${esc(o)}</option>`).join('');
}
$('#cKind').addEventListener('change', fillCommTags);
$('#createBox').addEventListener('click', (e) => {
  if (!e.target.closest('#newCommBtn')) return;
  $('#cKind').value = 'sector'; fillCommTags();
  $('#cName').value = ''; $('#cDesc').value = ''; $('#commError').hidden = true;
  openModal($('#commSheet'), '#cName');
});
$('#commClose').addEventListener('click', () => closeModal($('#commSheet')));
$('#commSheet').addEventListener('click', (e) => { if (e.target.id === 'commSheet') closeModal($('#commSheet')); });
$('#commSave').addEventListener('click', async () => {
  const err = $('#commError');
  const fail = (m) => { err.textContent = m; err.hidden = false; };
  err.hidden = true;
  const name = $('#cName').value.trim(), desc = $('#cDesc').value.trim();
  if (name.length < 3) return fail('Escribe un nombre de al menos 3 letras.');
  if (desc.length < 10) return fail('Cuéntanos en una frase para qué sirve (mínimo 10 letras).');
  const btn = $('#commSave'); btn.disabled = true;
  try {
    await refreshMe();
    if (!canCreateCommunity()) { closeModal($('#commSheet')); renderCreateBox(); toast(`Necesitas ${FOLLOWERS_TO_CREATE} seguidores para crear comunidades.`); return; }
    const ref = doc(collection(db, 'communities'));
    const b = writeBatch(db);
    b.set(ref, {
      name, desc, kind: $('#cKind').value, tag: $('#cTag').value, tone: 1 + Math.floor(Math.random() * 4),
      ownerUid: ME.uid, ownerName: ME.name, membersCount: 1, order: Date.now(), createdAt: serverTimestamp(),
    });
    b.set(doc(db, 'communities', ref.id, 'members', ME.uid), { at: serverTimestamp(), ...memberInfo() });
    b.set(doc(db, 'users', ME.uid, 'joined', ref.id), { at: serverTimestamp() });
    await b.commit();
    state.joined.add(ref.id);
    closeModal($('#commSheet'));
    toast('¡Listo! Tu comunidad ya está creada');
    loadCommunities(true);
    location.hash = `comunidad/${ref.id}`;
  } catch (e) { console.error(e); fail(authError(e)); }
  btn.disabled = false;
});
function renderCommunities() {
  const box = $('#communities');
  $('#comCount').textContent = data.communities.length ? `${data.communities.length} comunidades` : '';
  if (data.commLoading && !data.communities.length) { box.innerHTML = '<div class="loading">Cargando comunidades…</div>'; return; }
  if (data.commError && !data.communities.length) {
    box.innerHTML = '<div class="empty">No pudimos cargar las comunidades.<br><button class="btn btn-outline" data-retry="comm">Reintentar</button></div>'; return;
  }
  if (!data.communities.length) {
    box.innerHTML = IS_ADMIN
      ? '<div class="empty">Aún no hay comunidades.<br><button class="btn btn-primary" data-seed>Cargar comunidades iniciales</button></div>'
      : '<div class="empty">Pronto habrá comunidades por sector y por ciudad.</div>';
    return;
  }
  let list = data.communities;
  if (state.comTab === 'mias') list = list.filter((c) => state.joined.has(c.id));
  if (state.comTab === 'ciudad') list = list.filter((c) => c.kind === 'ciudad');
  box.innerHTML = list.length
    ? list.map((c) => {
        const joined = state.joined.has(c.id);
        const owner = ME && c.ownerUid === ME.uid;
        return `<article class="card com" data-id="${esc(c.id)}">
          <div class="com-cover tone-${esc(c.tone || 1)}"><span class="com-tag">${esc(c.tag)}</span><i data-lucide="${c.kind === 'ciudad' ? 'map-pin' : c.kind === 'grupo' ? 'handshake' : 'users'}"></i></div>
          <div class="com-body"><h3>${esc(c.name)}${c.kind === 'grupo' ? ' <span class="badge">Grupo</span>' : ''}</h3><p>${esc(c.desc)}</p>
            <div class="com-foot"><small class="muted">${Math.max(0, c.membersCount || 0)} ${c.membersCount === 1 ? 'miembro' : 'miembros'}${c.ownerName ? ` · por ${esc(c.ownerName)}` : ''}</small>
              <span class="com-actions"><a class="btn btn-sm btn-outline" href="#comunidad/${esc(c.id)}">Entrar</a>${owner ? '<button class="act del" data-del-comm aria-label="Eliminar comunidad"><i data-lucide="trash-2"></i></button>' : ''}
              <button class="btn btn-sm ${joined ? 'btn-soft' : 'btn-primary'}" data-join>${joined ? 'Miembro ✓' : 'Unirme'}</button></span></div></div></article>`;
      }).join('')
    : '<div class="empty">Aún no te has unido a ninguna comunidad.</div>';
  icons();
}
$('#comTabs').addEventListener('click', (e) => {
  const b = e.target.closest('.tab'); if (!b) return;
  state.comTab = b.dataset.tab;
  $$('#comTabs .tab').forEach((t) => t.classList.toggle('active', t === b));
  renderCommunities();
});
$('#communities').addEventListener('click', async (e) => {
  if (e.target.closest('[data-retry="comm"]')) { loadCommunities(true); return; }
  const seed = e.target.closest('[data-seed]');
  if (seed) {
    seed.disabled = true;
    try {
      const b = writeBatch(db);
      COMMUNITY_SEED.forEach(({ id, ...c }, i) => b.set(doc(db, 'communities', id), { ...c, membersCount: 0, order: i }));
      await b.commit();
      toast('Comunidades cargadas');
      await loadCommunities(true);
    } catch (err) { console.error(err); toast(authError(err)); seed.disabled = false; }
    return;
  }
  const del = e.target.closest('[data-del-comm]');
  if (del && !del.disabled) {
    const dc = data.communities.find((x) => x.id === del.closest('.com').dataset.id);
    if (!dc || !window.confirm(`¿Eliminar "${dc.name}"? No se puede deshacer.`)) return;
    del.disabled = true;
    try {
      const b = writeBatch(db);
      b.delete(doc(db, 'communities', dc.id));
      b.delete(doc(db, 'users', ME.uid, 'joined', dc.id));
      await b.commit();
      state.joined.delete(dc.id);
      data.communities = data.communities.filter((x) => x.id !== dc.id);
      toast('Comunidad eliminada');
    } catch (err) { console.error(err); toast(authError(err)); }
    renderCommunities();
    return;
  }
  const btn = e.target.closest('[data-join]');
  if (!btn) {
    const card = e.target.closest('.com');
    if (card && !e.target.closest('button, a')) location.hash = `comunidad/${card.dataset.id}`;
    return;
  }
  if (btn.disabled) return;
  const c = data.communities.find((x) => x.id === btn.closest('.com').dataset.id); if (!c) return;
  const on = state.joined.has(c.id);
  btn.disabled = true;
  try {
    const b = writeBatch(db);
    const mRef = doc(db, 'communities', c.id, 'members', ME.uid);
    const jRef = doc(db, 'users', ME.uid, 'joined', c.id);
    if (on) { b.delete(mRef); b.delete(jRef); } else { b.set(mRef, { at: serverTimestamp(), ...memberInfo() }); b.set(jRef, { at: serverTimestamp() }); }
    b.update(doc(db, 'communities', c.id), { membersCount: increment(on ? -1 : 1) });
    await b.commit();
    if (!on) notify(c.ownerUid, 'join', { targetId: c.id, targetName: c.name }, `join_${c.id}_${ME.uid}`);
    if (on) state.joined.delete(c.id); else state.joined.add(c.id);
    c.membersCount = Math.max(0, (c.membersCount || 0) + (on ? -1 : 1));
    toast(on ? `Saliste de ${c.name}` : `Te uniste a ${c.name}`);
  } catch (err) { console.error(err); toast(authError(err)); }
  renderCommunities();
});

/* ============================================================
   PÁGINA DE COMUNIDAD · chat, apoyo mutuo (likes) y miembros
   - Chat: solo miembros, en tiempo real.
   - Apoyo mutuo: publicaciones con enlace; los miembros se dan like.
   - Miembros: con sus redes para seguirse en otras plataformas.
   ============================================================ */
let cm = null;
const memberInfo = () => ({
  name: ME.name || '', handle: ME.handle || '', avatar: cleanUrl(ME.avatar) || '',
  category: ME.category || '', ...placeParts(ME), socials: ME.socials || {},
});
const cmKey = (cid, pid) => `cm_${cid}_${pid}`;
const isCmOwner = () => !!(cm && cm.c && ME && cm.c.ownerUid === ME.uid);

function leaveCommunity() {
  if (!cm) return;
  cm.unsubMsgs && cm.unsubMsgs();
  cm = null;
}
async function showCommunity(id) {
  if (!/^[A-Za-z0-9_-]{1,60}$/.test(id)) { location.replace('#comunidad'); return; }
  window.scrollTo(0, 0);
  if (cm && cm.id === id) { renderCommunityPage(); return; }
  leaveCommunity();
  const ctx = cm = { id, c: null, member: false, tab: 'chat', msgs: [], posts: null, members: null, first: true, sending: false };
  $('#cmWho').innerHTML = '<span class="muted">Cargando…</span>';
  ['#cmInfo', '#cmMsgs', '#cmPosts', '#cmMembers'].forEach((s) => ($(s).innerHTML = ''));
  $('#cmJoin').hidden = true; $('#cmForm').hidden = true; $('#cmPostForm').hidden = true; $('#cmInput').value = '';
  try {
    const [cs, ms] = await Promise.all([
      getDoc(doc(db, 'communities', id)),
      getDoc(doc(db, 'communities', id, 'members', ME.uid)),
    ]);
    if (cm !== ctx) return;
    if (!cs.exists()) { toast('Esa comunidad ya no existe'); location.replace('#comunidad'); return; }
    ctx.c = { id, ...cs.data() };
    ctx.member = ms.exists();
  } catch (e) { console.error(e); toast(authError(e)); location.replace('#comunidad'); return; }
  if (ctx.member) state.joined.add(id); else state.joined.delete(id);
  startCmMessages();
  setCmTab(ctx.member ? 'chat' : 'apoyo');
}
function startCmMessages() {
  const ctx = cm;
  if (!ctx || !ctx.member || ctx.unsubMsgs) return;
  ctx.unsubMsgs = onSnapshot(
    query(collection(db, 'communities', ctx.id, 'messages'), orderBy('createdAt', 'asc'), limitToLast(50)),
    (s) => { ctx.msgs = s.docs.map(readData); if (cm === ctx) renderCmMsgs(); },
    (e) => console.error(e));
}
function setCmTab(tab) {
  if (!cm) return;
  cm.tab = tab;
  $$('#cmTabs .tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === tab));
  $('#cmChat').hidden = tab !== 'chat';
  $('#cmApoyo').hidden = tab !== 'apoyo';
  $('#cmMembers').hidden = tab !== 'miembros';
  if (tab === 'chat') cm.first = true;
  if (tab === 'apoyo' && !cm.posts) loadCmPosts();
  if (tab === 'miembros' && !cm.members) loadCmMembers();
  renderCommunityPage();
}
$('#cmTabs').addEventListener('click', (e) => { const t = e.target.closest('[data-tab]'); if (t) setCmTab(t.dataset.tab); });

function renderCommunityPage() {
  const ctx = cm; if (!ctx || !ctx.c) return;
  const c = ctx.c, owner = isCmOwner();
  const icon = c.kind === 'ciudad' ? 'map-pin' : c.kind === 'grupo' ? 'handshake' : 'users';
  $('#cmWho').innerHTML = `<span class="cm-badge tone-${esc(c.tone || 1)}"><i data-lucide="${icon}"></i></span>
    <div style="min-width:0"><strong>${esc(c.name)}</strong><small>${esc(c.tag)}${c.kind === 'grupo' ? ' · Grupo' : ''}</small></div>`;
  const n = Math.max(0, c.membersCount || 0);
  $('#cmInfo').innerHTML = `<p>${esc(c.desc)}</p>${n} ${n === 1 ? 'miembro' : 'miembros'}${c.ownerName ? ` · administra ${esc(c.ownerName)}` : ''}`;
  const join = $('#cmJoin');
  join.hidden = owner;
  join.textContent = ctx.member ? 'Salir' : 'Unirme';
  join.className = `btn btn-sm ${ctx.member ? 'btn-outline' : 'btn-primary'}`;
  $('#cmForm').hidden = !(ctx.tab === 'chat' && ctx.member);
  $('#cmPostForm').hidden = !ctx.member;
  if (ctx.tab === 'chat') renderCmMsgs();
  if (ctx.tab === 'apoyo') renderCmPosts();
  if (ctx.tab === 'miembros') renderCmMembers();
  icons();
}

/* ---- Chat de la comunidad ---- */
function renderCmMsgs() {
  const ctx = cm; if (!ctx || ctx.tab !== 'chat') return;
  const box = $('#cmMsgs');
  if (!ctx.member) { box.innerHTML = '<div class="chat-empty">Únete a la comunidad para chatear con sus miembros.</div>'; return; }
  const nearBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 140;
  if (!ctx.msgs.length) box.innerHTML = '<div class="chat-empty">Aún no hay mensajes. ¡Saluda y cuéntales qué haces!</div>';
  else {
    let lastDay = '', html = '';
    for (const m of ctx.msgs) {
      const ms = m.createdAt ? toMs(m.createdAt) : Date.now();
      const day = dayLabel(ms);
      if (day !== lastDay) { html += `<div class="day-sep">${esc(day)}</div>`; lastDay = day; }
      const mine = m.senderUid === ME.uid;
      const canDel = mine || isCmOwner();
      html += `<div class="bubble ${mine ? 'me' : 'them'}" data-id="${esc(m.id)}">${mine ? '' : `<span class="who">${esc(m.senderName || 'Miembro')}</span>`}${esc(m.text)}<time>${hourLabel(ms)}${canDel ? ' <button class="bub-del" type="button" data-del-msg aria-label="Eliminar mensaje">eliminar</button>' : ''}</time></div>`;
    }
    box.innerHTML = html;
  }
  if (ctx.first || nearBottom) { window.scrollTo(0, document.documentElement.scrollHeight); ctx.first = false; }
}
async function sendCmMessage() {
  const ctx = cm; if (!ctx || !ctx.member || ctx.sending) return;
  const input = $('#cmInput'), text = input.value.trim();
  if (!text) return;
  ctx.sending = true; $('#cmSend').disabled = true;
  try {
    await addDoc(collection(db, 'communities', ctx.id, 'messages'), {
      senderUid: ME.uid, senderName: ME.name, senderAvatar: (cleanUrl(ME.avatar) || '').length <= 500 ? (cleanUrl(ME.avatar) || '') : '', text, createdAt: serverTimestamp(),
    });
    input.value = ''; input.style.height = ''; ctx.first = true;
  } catch (e) {
    console.error(e);
    toast(e && e.code === 'permission-denied' ? 'No pudimos enviar. ¿Sigues siendo miembro?' : authError(e));
  }
  ctx.sending = false; $('#cmSend').disabled = false;
  if (cm === ctx) input.focus();
}
$('#cmForm').addEventListener('submit', (e) => { e.preventDefault(); sendCmMessage(); });
$('#cmInput').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); sendCmMessage(); } });
$('#cmInput').addEventListener('input', (e) => { const t = e.target; t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 120) + 'px'; });
$('#cmMsgs').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-del-msg]'); if (!b || !cm) return;
  if (!window.confirm('¿Eliminar este mensaje?')) return;
  try { await deleteDoc(doc(db, 'communities', cm.id, 'messages', b.closest('.bubble').dataset.id)); }
  catch (err) { console.error(err); toast(authError(err)); }
});

/* ---- Unirse / salir ---- */
$('#cmJoin').addEventListener('click', async () => {
  const ctx = cm; if (!ctx || !ctx.c) return;
  const btn = $('#cmJoin'); btn.disabled = true;
  const on = ctx.member;
  try {
    const b = writeBatch(db);
    const mRef = doc(db, 'communities', ctx.id, 'members', ME.uid);
    const jRef = doc(db, 'users', ME.uid, 'joined', ctx.id);
    if (on) { b.delete(mRef); b.delete(jRef); } else { b.set(mRef, { at: serverTimestamp(), ...memberInfo() }); b.set(jRef, { at: serverTimestamp() }); }
    b.update(doc(db, 'communities', ctx.id), { membersCount: increment(on ? -1 : 1) });
    await b.commit();
    if (!on) notify(ctx.c.ownerUid, 'join', { targetId: ctx.id, targetName: ctx.c.name }, `join_${ctx.id}_${ME.uid}`);
    if (cm !== ctx) return;
    ctx.member = !on;
    if (on) state.joined.delete(ctx.id); else state.joined.add(ctx.id);
    const delta = on ? -1 : 1;
    ctx.c.membersCount = Math.max(0, (ctx.c.membersCount || 0) + delta);
    const listed = data.communities.find((x) => x.id === ctx.id);
    if (listed) listed.membersCount = ctx.c.membersCount;
    ctx.members = null;
    if (on) { ctx.unsubMsgs && ctx.unsubMsgs(); ctx.unsubMsgs = null; ctx.msgs = []; }
    else startCmMessages();
    toast(on ? `Saliste de ${ctx.c.name}` : `Te uniste a ${ctx.c.name}`);
    setCmTab(on ? 'apoyo' : 'chat');
  } catch (e) { console.error(e); toast(authError(e)); }
  btn.disabled = false;
});

/* ---- Apoyo mutuo ---- */
async function loadCmPosts() {
  const ctx = cm; if (!ctx) return;
  ctx.posts = []; ctx.postsLoading = true; renderCmPosts();
  try {
    const s = await getDocs(query(collection(db, 'communities', ctx.id, 'posts'), orderBy('createdAt', 'desc'), limit(30)));
    ctx.posts = s.docs.map(readData);
  } catch (e) { console.error(e); ctx.postsError = true; toast(authError(e)); }
  ctx.postsLoading = false;
  if (cm === ctx) renderCmPosts();
  ensureUsers((ctx.posts || []).map((p) => p.authorUid)).then((ch) => { if (ch && cm === ctx) renderCmPosts(); });
}
function renderCmPosts() {
  const ctx = cm; if (!ctx || ctx.tab !== 'apoyo') return;
  const box = $('#cmPosts');
  if (ctx.postsLoading) { box.innerHTML = '<div class="loading">Cargando…</div>'; return; }
  if (ctx.postsError) { box.innerHTML = '<div class="empty">No pudimos cargar las publicaciones.<br><button class="btn btn-outline" data-retry-posts>Reintentar</button></div>'; return; }
  if (!ctx.posts || !ctx.posts.length) {
    box.innerHTML = `<div class="empty">Aún no hay publicaciones.${ctx.member ? '<br>Comparte algo y pide el apoyo de la comunidad.' : '<br>Únete para publicar y dar likes.'}</div>`; return;
  }
  box.innerHTML = ctx.posts.map((p) => {
    const key = cmKey(ctx.id, p.id), liked = state.liked.has(key), mine = p.authorUid === ME.uid;
    const link = cleanUrl(p.link), au = liveUser(p.authorUid, null);
    return `<article class="card cm-post" data-id="${esc(p.id)}">
      <div class="post-head">${avatarHTML(p.authorName, 'md', (au && au.avatar) || p.authorAvatar, au && au.avatar ? au.avatarPos : null)}
        <div class="post-who"><strong>${esc(p.authorName)}</strong>${vbadge(liveUser(p.authorUid))}<div class="post-sub">@${esc(p.authorHandle || '')} · ${p.createdAt ? timeAgo(p.createdAt) : 'ahora'}</div></div></div>
      <p class="post-body">${esc(p.body)}</p>
      ${link ? `<a class="cm-link" href="${esc(link)}" target="_blank" rel="noopener noreferrer"><i data-lucide="external-link"></i> ${esc(link.replace(/^https:\/\//, '').slice(0, 60))}</a>` : ''}
      <div class="post-actions">
        ${mine
          ? `<span class="act"><i data-lucide="heart"></i> ${Math.max(0, p.likesCount || 0)}</span>`
          : `<button class="act ${liked ? 'on' : ''}" data-cm-like aria-pressed="${liked}" aria-label="Me gusta"><i data-lucide="heart"></i> ${Math.max(0, p.likesCount || 0)}</button>`}
        ${(mine || isCmOwner()) ? '<button class="act del" data-cm-del aria-label="Eliminar publicación"><i data-lucide="trash-2"></i></button>' : ''}
      </div></article>`;
  }).join('');
  icons();
}
$('#cmPostBody').addEventListener('input', () => { $('#cmPostError').hidden = true; });
$('#cmPostForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const ctx = cm; if (!ctx || !ctx.member) return;
  const err = $('#cmPostError'); err.hidden = true;
  const fail = (m) => { err.textContent = m; err.hidden = false; };
  const body = $('#cmPostBody').value.trim(), rawLink = $('#cmPostLink').value.trim(), link = cleanUrl(rawLink);
  if (body.length < 3) return fail('Escribe al menos 3 letras.');
  if (rawLink && !link) return fail('El enlace debe empezar con https://');
  const btn = $('#cmPostBtn'); btn.disabled = true;
  try {
    const post = { authorUid: ME.uid, authorName: ME.name, authorHandle: ME.handle || '', authorAvatar: cleanUrl(ME.avatar) || '', body, link: link || '', likesCount: 0, createdAt: serverTimestamp() };
    const ref = await addDoc(collection(db, 'communities', ctx.id, 'posts'), post);
    if (cm === ctx) { ctx.posts = [{ id: ref.id, ...post, createdAt: new Date() }, ...(ctx.posts || [])]; ctx.postsError = false; }
    $('#cmPostBody').value = ''; $('#cmPostLink').value = '';
    toast('Publicado. ¡Ahora la comunidad puede apoyarte!');
    renderCmPosts();
  } catch (e2) { console.error(e2); fail(authError(e2)); }
  btn.disabled = false;
});
$('#cmPosts').addEventListener('click', async (e) => {
  const ctx = cm; if (!ctx) return;
  if (e.target.closest('[data-retry-posts]')) { ctx.postsError = false; loadCmPosts(); return; }
  const card = e.target.closest('.cm-post'); if (!card) return;
  const p = ctx.posts.find((x) => x.id === card.dataset.id); if (!p) return;
  const like = e.target.closest('[data-cm-like]'), del = e.target.closest('[data-cm-del]');
  if (like && !like.disabled) {
    if (!ctx.member) { toast('Únete a la comunidad para dar like'); return; }
    like.disabled = true;
    const key = cmKey(ctx.id, p.id), on = state.liked.has(key);
    try {
      const b = writeBatch(db);
      const lRef = doc(db, 'communities', ctx.id, 'posts', p.id, 'likes', ME.uid);
      const uRef = doc(db, 'users', ME.uid, 'likedPosts', key);
      if (on) { b.delete(lRef); b.delete(uRef); } else { b.set(lRef, { at: serverTimestamp() }); b.set(uRef, { at: serverTimestamp() }); }
      b.update(doc(db, 'communities', ctx.id, 'posts', p.id), { likesCount: increment(on ? -1 : 1) });
      await b.commit();
      if (!on) notify(p.authorUid, 'clike', { targetId: ctx.id, targetName: ctx.c && ctx.c.name }, `clike_${ctx.id}_${p.id}_${ME.uid}`);
      if (on) state.liked.delete(key); else state.liked.add(key);
      p.likesCount = Math.max(0, (p.likesCount || 0) + (on ? -1 : 1));
    } catch (err) { console.error(err); toast(authError(err)); }
    renderCmPosts();
  } else if (del && !del.disabled) {
    if (!window.confirm('¿Eliminar esta publicación?')) return;
    del.disabled = true;
    try {
      await deleteDoc(doc(db, 'communities', ctx.id, 'posts', p.id));
      ctx.posts = ctx.posts.filter((x) => x.id !== p.id);
      toast('Publicación eliminada');
    } catch (err) { console.error(err); toast(authError(err)); }
    renderCmPosts();
  }
});

/* ---- Miembros ---- */
async function loadCmMembers() {
  const ctx = cm; if (!ctx) return;
  ctx.members = []; ctx.membersLoading = true; renderCmMembers();
  try {
    const s = await getDocs(query(collection(db, 'communities', ctx.id, 'members'), limit(100)));
    ctx.members = s.docs.map((d) => ({ uid: d.id, ...d.data() })).sort((a, b) =>
      (b.uid === ctx.c.ownerUid) - (a.uid === ctx.c.ownerUid) || (b.uid === ME.uid) - (a.uid === ME.uid) || msOr0(b.at) - msOr0(a.at));
    // Mantener al día mi nombre, foto y redes dentro de la comunidad
    const mine = ctx.members.find((m) => m.uid === ME.uid);
    if (mine) {
      const info = memberInfo();
      if (JSON.stringify(['name', 'handle', 'avatar', 'category', 'municipio', 'state', 'country', 'socials'].map((k) => mine[k] ?? null)) !==
          JSON.stringify(['name', 'handle', 'avatar', 'category', 'municipio', 'state', 'country', 'socials'].map((k) => info[k] ?? null))) {
        updateDoc(doc(db, 'communities', ctx.id, 'members', ME.uid), info).catch((e) => console.warn(e));
        Object.assign(mine, info);
      }
    }
  } catch (e) { console.error(e); ctx.membersError = true; toast(authError(e)); }
  ctx.membersLoading = false;
  if (cm === ctx) renderCmMembers();
}
function renderCmMembers() {
  const ctx = cm; if (!ctx || ctx.tab !== 'miembros') return;
  const box = $('#cmMembers');
  if (ctx.membersLoading) { box.innerHTML = '<div class="loading">Cargando miembros…</div>'; return; }
  if (ctx.membersError) { box.innerHTML = '<div class="empty">No pudimos cargar los miembros.<br><button class="btn btn-outline" data-retry-members>Reintentar</button></div>'; return; }
  if (!ctx.members || !ctx.members.length) { box.innerHTML = '<div class="empty">Aún no hay miembros.</div>'; return; }
  ensureUsers(ctx.members.map((m) => m.uid)).then((ch) => { if (ch && cm === ctx && ctx.tab === 'miembros') renderCmMembers(); });
  box.innerHTML = ctx.members.map((m) => {
    const me = m.uid === ME.uid, f = state.following.has(m.uid), lv = liveUser(m.uid, m), name = lv.name || m.name || 'Miembro';
    return `<article class="card cm-member" data-uid="${esc(m.uid)}" data-user="${esc(m.uid)}">
      ${avatarHTML(name, 'md', lv.avatar, lv.avatarPos)}
      <div class="biz-info"><strong>${esc(name)}</strong>${vbadge(lv)}${m.uid === ctx.c.ownerUid ? ' <span class="badge">Admin</span>' : ''}${me ? ' <span class="badge neutral">Tú</span>' : ''}
        <p>${m.handle ? `@${esc(m.handle)}` : ''}</p>
        <small>${esc([m.category, placeText(m)].filter(Boolean).join(' · '))}</small>${quickLinks(m.socials)}</div>
      ${me ? '' : `<div class="biz-actions"><button class="btn btn-sm ${f ? 'btn-soft' : 'btn-outline'}" data-m-follow>${f ? 'Siguiendo' : 'Seguir'}</button>
        <a class="btn btn-sm btn-outline" href="#chat/${esc(chatIdFor(m.uid))}" aria-label="Enviar mensaje a ${esc(name)}"><i data-lucide="message-circle"></i> Mensaje</a></div>`}</article>`;
  }).join('');
  icons();
}
$('#cmMembers').addEventListener('click', async (e) => {
  const ctx = cm; if (!ctx) return;
  if (e.target.closest('[data-retry-members]')) { ctx.membersError = false; loadCmMembers(); return; }
  const b = e.target.closest('[data-m-follow]'); if (!b || b.disabled) return;
  const m = ctx.members.find((x) => x.uid === b.closest('.cm-member').dataset.uid); if (!m) return;
  b.disabled = true;
  try { await toggleFollow(m.uid, m.name || 'Miembro'); }
  catch (err) { console.error(err); toast(authError(err)); }
  renderCmMembers();
});

/* ============================================================
   Redes sociales y contacto rápido
   - Se eligen al crear la cuenta o desde "Editar" en el perfil.
   - Cada valor se valida y se guarda normalizado.
   - En el perfil aparecen solo las redes que agregó el usuario.
   ============================================================ */
const SOCIALS = [
  { id: 'whatsapp', name: 'WhatsApp', icon: 'message-circle', color: '#128C7E', placeholder: '33 1234 5678', hint: 'Número con lada, 10 dígitos.', inputmode: 'tel' },
  { id: 'instagram', name: 'Instagram', icon: 'camera', color: '#E1306C', placeholder: '@tu_usuario' },
  { id: 'facebook', name: 'Facebook', icon: 'thumbs-up', color: '#1877F2', placeholder: 'tu.pagina o pega el enlace' },
  { id: 'tiktok', name: 'TikTok', icon: 'music-2', color: '#FE2C55', placeholder: '@tu_usuario' },
  { id: 'youtube', name: 'YouTube', icon: 'play', color: '#E02424', placeholder: '@tucanal o pega el enlace' },
  { id: 'web', name: 'Sitio web', icon: 'globe', color: '#1B4F9C', placeholder: 'tusitio.com', inputmode: 'url' },
  { id: 'email', name: 'Correo', icon: 'mail', color: '#F0694F', placeholder: 'contacto@tunegocio.com', inputmode: 'email' },
];

function normalizeSocial(id, raw) {
  const v = String(raw || '').trim();
  const ok = (value) => ({ ok: true, value });
  const bad = (error) => ({ ok: false, error });
  const lastSeg = (s) => {
    try { return new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`).pathname.split('/').filter(Boolean).pop() || ''; }
    catch { return ''; }
  };
  switch (id) {
    case 'whatsapp': {
      const d = v.replace(/\D/g, '');
      if (d.length === 10) return ok(`52${d}`);
      if (d.length >= 11 && d.length <= 13) return ok(d);
      return bad('escribe tu número con lada (10 dígitos).');
    }
    case 'instagram':
    case 'tiktok': {
      const h = (/(instagram|tiktok)\.com\//i.test(v) ? lastSeg(v) : v).replace(/^@/, '');
      return /^[A-Za-z0-9._]{2,30}$/.test(h) ? ok(h) : bad('usuario no válido (letras, números, punto y guion bajo).');
    }
    case 'facebook': {
      const h = (/(facebook|fb)\.com\//i.test(v) ? lastSeg(v) : v).replace(/^@/, '');
      return /^[A-Za-z0-9.\-]{3,60}$/.test(h) && h !== 'profile.php' ? ok(h) : bad('escribe el nombre de tu página o pega su enlace.');
    }
    case 'youtube': {
      if (/^channel\/[\w-]+$/.test(v)) return ok(v);
      const ch = v.match(/youtube\.com\/channel\/([\w-]+)/i);
      if (ch) return ok(`channel/${ch[1]}`);
      const h = (/(youtube\.com|youtu\.be)\//i.test(v) ? lastSeg(v) : v).replace(/^@/, '');
      return /^[\w.\-]{3,40}$/.test(h) ? ok(`@${h}`) : bad('escribe tu @canal o pega el enlace.');
    }
    case 'web': {
      let u;
      try { u = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`); } catch { return bad('escribe un sitio válido, por ejemplo tusitio.com.'); }
      return /^https?:$/.test(u.protocol) && u.hostname.includes('.') ? ok(u.href) : bad('escribe un sitio válido, por ejemplo tusitio.com.');
    }
    case 'email':
      return /^\S+@\S+\.\S+$/.test(v) ? ok(v.toLowerCase()) : bad('escribe un correo válido.');
    default:
      return bad('red no reconocida.');
  }
}
function socialHref(id, v) {
  v = String(v || '');
  switch (id) {
    case 'whatsapp': return `https://wa.me/${v.replace(/\D/g, '')}?text=${encodeURIComponent('Hola, te encontré en BRIVIAN 👋')}`;
    case 'instagram': return `https://instagram.com/${encodeURIComponent(v)}`;
    case 'facebook': return `https://facebook.com/${encodeURIComponent(v)}`;
    case 'tiktok': return `https://www.tiktok.com/@${encodeURIComponent(v)}`;
    case 'youtube': return `https://www.youtube.com/${v.split('/').map(encodeURIComponent).join('/')}`;
    case 'web': return /^https?:\/\//i.test(v) ? v : '#';
    case 'email': return `mailto:${v}`;
    default: return '#';
  }
}
function socialLabel(id, v) {
  v = String(v || '');
  switch (id) {
    case 'whatsapp': return /^52\d{10}$/.test(v) ? `${v.slice(2, 4)} ${v.slice(4, 8)} ${v.slice(8)}` : `+${v}`;
    case 'instagram': case 'tiktok': return `@${v}`;
    case 'youtube': return v.startsWith('channel/') ? 'Mi canal' : v;
    case 'web': try { return new URL(v).hostname.replace(/^www\./, ''); } catch { return v; }
    default: return v;
  }
}
const socialsForEdit = (s = {}) =>
  Object.fromEntries(Object.entries(s).map(([k, v]) => [k, k === 'whatsapp' ? String(v).replace(/^52(\d{10})$/, '$1') : v]));

/* Editor reutilizable: chips para elegir redes + un campo por cada red elegida */
function createSocialEditor(root) {
  let sel = new Set();
  let values = {};
  root.innerHTML = '<div class="chips social-chips"></div><div class="social-inputs"></div>';
  const chipsEl = $('.social-chips', root);
  const inputsEl = $('.social-inputs', root);

  function draw(focusId) {
    chipsEl.innerHTML = SOCIALS.map((s) =>
      `<button type="button" class="chip social-chip ${sel.has(s.id) ? 'active' : ''}" data-id="${s.id}" aria-pressed="${sel.has(s.id)}" style="--sc:${s.color}"><i data-lucide="${s.icon}"></i> ${s.name}</button>`).join('');
    inputsEl.innerHTML = SOCIALS.filter((s) => sel.has(s.id)).map((s) => `
      <div class="social-row" style="--sc:${s.color}">
        <span class="social-ico"><i data-lucide="${s.icon}"></i></span>
        <div class="social-field">
          <label for="soc-${root.id}-${s.id}">${s.name}</label>
          <input class="input" id="soc-${root.id}-${s.id}" data-social="${s.id}" inputmode="${s.inputmode || 'text'}" autocomplete="off" autocapitalize="none" maxlength="120" placeholder="${esc(s.placeholder)}" value="${esc(values[s.id] || '')}">
          ${s.hint ? `<small class="muted">${esc(s.hint)}</small>` : ''}
        </div>
        <button type="button" class="icon-btn" data-remove="${s.id}" aria-label="Quitar ${s.name}"><i data-lucide="x"></i></button>
      </div>`).join('');
    icons();
    if (focusId) $(`[data-social="${focusId}"]`, root)?.focus();
  }
  root.addEventListener('click', (e) => {
    const chip = e.target.closest('.social-chip');
    const rm = e.target.closest('[data-remove]');
    if (chip) {
      const id = chip.dataset.id;
      if (sel.has(id)) { sel.delete(id); delete values[id]; draw(); } else { sel.add(id); draw(id); }
    } else if (rm) {
      sel.delete(rm.dataset.remove); delete values[rm.dataset.remove]; draw();
    }
  });
  root.addEventListener('input', (e) => {
    const i = e.target.closest('[data-social]');
    if (i) values[i.dataset.social] = i.value;
  });
  function validate() {
    const out = {};
    for (const s of SOCIALS) {
      if (!sel.has(s.id)) continue;
      const raw = (values[s.id] || '').trim();
      if (!raw) return { error: `Completa ${s.name} o quítalo de la lista.`, values: {} };
      const r = normalizeSocial(s.id, raw);
      if (!r.ok) return { error: `${s.name}: ${r.error}`, values: {} };
      out[s.id] = r.value;
    }
    return { error: '', values: out };
  }
  function reset(initial = {}) { sel = new Set(Object.keys(initial)); values = { ...initial }; draw(); }
  reset({});
  return { validate, reset };
}

/* Botones de contacto del perfil */
function socialLinksHTML(s = {}, emptyMsg = '') {
  const items = SOCIALS.filter((n) => s[n.id]);
  return items.length
    ? items.map((n) => `<a class="social-link ${n.id === 'whatsapp' ? 'wa' : ''}" href="${esc(socialHref(n.id, s[n.id]))}" target="_blank" rel="noopener noreferrer" style="--sc:${n.color}">
        <span class="social-ico"><i data-lucide="${n.icon}"></i></span>
        <span class="social-txt"><strong>${n.id === 'whatsapp' ? 'Escribir por WhatsApp' : n.name}</strong><small>${esc(socialLabel(n.id, s[n.id]))}</small></span></a>`).join('')
    : `<p class="muted social-empty">${emptyMsg}</p>`;
}
function renderProfileSocials() {
  $('#pSocials').innerHTML = socialLinksHTML(ME.socials || {}, 'Aún no agregas redes. Añádelas para que otros emprendedores te contacten rápido.');
}
/* Accesos rápidos (iconos) para las tarjetas de Explorar */
function quickLinks(socials = {}) {
  const items = SOCIALS.filter((n) => socials && socials[n.id]);
  if (!items.length) return '';
  return `<div class="quick-links">${items.map((n) =>
    `<a class="quick" href="${esc(socialHref(n.id, socials[n.id]))}" target="_blank" rel="noopener noreferrer" aria-label="${esc(n.name)}" style="--sc:${n.color}"><i data-lucide="${n.icon}"></i></a>`).join('')}</div>`;
}

/* ============================================================
   PERFIL DE OTRA PERSONA  (#u/<uid>)
   ============================================================ */
async function showUser(uid) {
  if (!/^[A-Za-z0-9]{1,128}$/.test(uid)) { location.replace('#explorar'); return; }
  if (uid === ME.uid) { location.replace('#perfil'); return; }
  window.scrollTo(0, 0);
  const cached = uCache.get(uid) || data.people.find((x) => x.uid === uid) || null;
  const ctx = uview = { uid, u: cached, posts: [], loading: true };
  renderUser();
  try {
    const s = await getDoc(doc(db, 'users', uid));
    if (uview !== ctx) return;
    if (!s.exists()) { toast('No encontramos este perfil'); location.replace('#explorar'); return; }
    ctx.u = { uid, ...s.data() };
    cacheUsers([ctx.u]);
  } catch (e) { console.error(e); toast(authError(e)); if (!ctx.u) { location.replace('#explorar'); return; } }
  renderUser();
  try {
    const snap = await getDocs(query(collection(db, 'posts'), where('authorUid', '==', uid), limit(30)));
    ctx.posts = snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt));
  } catch (e) { console.error(e); ctx.postsError = true; }
  ctx.loading = false;
  if (uview === ctx) renderUser();
}
function renderUser() {
  const ctx = uview; if (!ctx) return;
  const u = ctx.u;
  if (!u) {
    $('#uName').textContent = 'Cargando…'; ['#uCat', '#uRole'].forEach((x) => ($(x).textContent = ''));
    $('#uPosts').innerHTML = '<div class="loading">Cargando…</div>'; return;
  }
  const [c1, c2] = colorsFor(u.name);
  const av = $('#uAvatar');
  av.style.setProperty('--c1', c1); av.style.setProperty('--c2', c2); av.classList.remove('loaded');
  av.innerHTML = esc(initials(u.name)) + avatarImg(cleanUrl(u.avatar), u.avatarPos);
  const cover = cleanUrl(u.cover);
  $('#uCover').style.setProperty('--c1', c1); $('#uCover').style.setProperty('--c2', c2);
  setCover($('#uCover'), cover, u.coverPos);
  $('#uName').textContent = u.name || 'Emprendedor';
  $('#uVerified').innerHTML = vbadge(u);
  $('#uCat').textContent = u.category || ''; $('#uCat').hidden = !u.category;
  $('#uRole').textContent = u.role || ''; $('#uRole').hidden = !u.role;
  $('#uHandle').textContent = u.handle || '';
  $('#uBio').textContent = u.bio || ''; $('#uBio').hidden = !u.bio;
  $('#uCity').textContent = placeText(u) || 'México';
  $('#uSince').textContent = u.since || '';
  $('#uSocials').innerHTML = socialLinksHTML(u.socials || {}, `${esc(u.name || 'Esta persona')} aún no agrega redes. Escríbele por mensaje.`);
  const f = state.following.has(ctx.uid);
  const btn = $('#uFollow');
  btn.textContent = f ? 'Siguiendo' : 'Seguir';
  btn.className = `btn ${f ? 'btn-soft' : 'btn-primary'}`;
  $('#uMsg').href = `#chat/${chatIdFor(ctx.uid)}`;
  $('#uStFollowers').textContent = Math.max(0, u.followersCount || 0);
  $('#uStPosts').textContent = ctx.posts.length;
  $('#uPosts').innerHTML = ctx.loading && !ctx.posts.length ? '<div class="loading">Cargando publicaciones…</div>'
    : ctx.postsError ? '<div class="empty">No pudimos cargar sus publicaciones.</div>'
    : ctx.posts.length ? ctx.posts.map(postHTML).join('') : '<div class="empty">Aún no ha publicado.</div>';
  icons();
}
$('#uBack').addEventListener('click', () => { if (history.length > 1) history.back(); else location.hash = 'explorar'; });
$('#uFollow').addEventListener('click', async () => {
  const ctx = uview; if (!ctx || !ctx.u) return;
  const btn = $('#uFollow'); btn.disabled = true;
  const on = state.following.has(ctx.uid);
  try {
    await toggleFollow(ctx.uid, ctx.u.name);
    ctx.u.followersCount = Math.max(0, (ctx.u.followersCount || 0) + (on ? -1 : 1));
  } catch (e) { console.error(e); toast(authError(e)); }
  btn.disabled = false; renderUser();
});
$('#uPosts').addEventListener('click', (e) => onPostAction(e, renderUser));
/* Tocar a una persona (tarjeta, publicación, miembro, chat) abre su perfil */
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-user]');
  if (!el || !ME || e.target.closest('button, a, input, textarea, select, label')) return;
  const uid = el.dataset.user;
  if (uid) location.hash = uid === ME.uid ? 'perfil' : `u/${uid}`;
});

/* ============================================================
   PERFIL (+ paneles para editar redes y datos)
   ============================================================ */
async function loadMine(force = false) {
  if (data.mineLoading) return;
  data.mineLoading = true;
  renderMine();
  try {
    const snap = await getDocs(query(collection(db, 'posts'), where('authorUid', '==', ME.uid)));
    data.mine = snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt));
  } catch (e) { console.error(e); toast(authError(e)); }
  data.mineLoading = false;
  renderMine();
}
function renderMine() {
  $('#stPosts').textContent = data.mine.length;
  $('#myPosts').innerHTML = data.mineLoading && !data.mine.length
    ? '<div class="loading">Cargando tus publicaciones…</div>'
    : data.mine.length ? data.mine.map(postHTML).join('') : '<div class="empty">Aún no has publicado. Toca el botón + para empezar.</div>';
  icons();
}
function renderProfile() {
  if (!ME) return;
  $('#pCat').textContent = ME.category;
  $('#pRole').textContent = ME.role;
  $('#pCity').textContent = ME.city || placeText(ME);
  $('#pSince').textContent = ME.since;
  $('#pMail').hidden = !(auth.currentUser && auth.currentUser.emailVerified);
  $('#pVerified').innerHTML = vbadge(ME);
  $('#pBio').textContent = ME.bio || '';
  $('#pBio').hidden = !ME.bio;
  const cover = cleanUrl(ME.cover);
  const [cc1, cc2] = colorsFor(ME.name);   // sin portada: fondo con los mismos colores del nombre que la foto de perfil
  $('#cover').style.setProperty('--c1', cc1); $('#cover').style.setProperty('--c2', cc2);
  setCover($('#cover'), cover, ME.coverPos);
  $('#stFollowers').textContent = Math.max(0, ME.followersCount || 0);
  $('#stFollowing').textContent = state.following.size;
  const left = FOLLOWERS_TO_CREATE - followersNow();
  $('#unlockHint').innerHTML = left <= 0
    ? 'Ya puedes crear comunidades y grupos. <a href="#comunidad">Crear ahora</a>'
    : `Te ${left === 1 ? 'falta 1 seguidor' : `faltan ${left} seguidores`} para crear comunidades y grupos.`;
  renderProfileSocials();
  renderMine();
  icons();
}
function showPerfil() {
  renderProfile(); loadMine();
  refreshMe().then(() => { if (!$('#view-perfil').hidden) { applyMe(); renderProfile(); } });   // seguidores al día
}

async function saveProfile(changes) {
  await updateDoc(doc(db, 'users', ME.uid), changes);
  Object.assign(ME, changes);
  data.peopleAt = 0;                                            // Explorar vuelve a leer perfiles (ubicación, foto…)
  const mine = data.people.find((x) => x.uid === ME.uid); if (mine) Object.assign(mine, changes);
  applyMe();
  renderProfile();
}

/* Panel: redes */
const sheetEditor = createSocialEditor($('#sheetSocials'));
const openModal = (el, focus) => { el.hidden = false; document.body.style.overflow = 'hidden'; $(focus).focus(); };
const closeModal = (el) => { el.hidden = true; document.body.style.overflow = ''; };
$('#editSocialsBtn').addEventListener('click', () => {
  sheetEditor.reset(socialsForEdit(ME.socials));
  $('#sheetError').hidden = true;
  openModal($('#sheet'), '#sheetClose');
});
$('#sheetClose').addEventListener('click', () => closeModal($('#sheet')));
$('#sheet').addEventListener('click', (e) => { if (e.target.id === 'sheet') closeModal($('#sheet')); });
$('#sheetSave').addEventListener('click', async () => {
  const r = sheetEditor.validate();
  const err = $('#sheetError');
  if (r.error) { err.textContent = r.error; err.hidden = false; return; }
  const btn = $('#sheetSave'); btn.disabled = true;
  try {
    await saveProfile({ socials: r.values });
    closeModal($('#sheet'));
    toast('Redes actualizadas');
  } catch (e) { console.error(e); err.textContent = authError(e); err.hidden = false; }
  btn.disabled = false;
});

/* Panel: editar perfil */
$('#editBtn').addEventListener('click', () => {
  $('#eName').value = ME.name || '';
  $('#eCat').value = ME.category;
  $('#eRole').value = ME.role;
  $('#eBio').value = ME.bio || '';
  const pl = placeParts(ME);
  setPlace('e', pl);
  $('#eColonia').value = ME.colonia || '';
  $('#eAvatar').value = ME.avatar || '';
  $('#eCover').value = ME.cover || '';
  EDIT.avatarPos = posOf(ME.avatarPos); EDIT.coverPos = posOf(ME.coverPos);
  editAvatarAdj.sync(); editCoverAdj.sync();
  editAvatarWatch.clear(); editCoverWatch.clear();
  $('#editError').hidden = true;
  openModal($('#editSheet'), '#editClose');
});
$('#editClose').addEventListener('click', () => closeModal($('#editSheet')));
$('#editSheet').addEventListener('click', (e) => { if (e.target.id === 'editSheet') closeModal($('#editSheet')); });
const editAvatarWatch = watchImageInput($('#eAvatar'), $('#eAvatarStatus'));
const editCoverWatch = watchImageInput($('#eCover'), $('#eCoverStatus'));
const EDIT = { avatarPos: null, coverPos: null };
const editAvatarAdj = wireAdjust({ input: $('#eAvatar'), btn: $('#eAvatarAdj'), kind: 'round', get: () => EDIT.avatarPos, set: (p) => (EDIT.avatarPos = p) });
const editCoverAdj = wireAdjust({ input: $('#eCover'), btn: $('#eCoverAdj'), kind: 'wide', get: () => EDIT.coverPos, set: (p) => (EDIT.coverPos = p) });
$('#editSave').addEventListener('click', async () => {
  const err = $('#editError');
  const fail = (m) => { err.textContent = m; err.hidden = false; };
  const name = $('#eName').value.trim();
  if (name.length < 2) return fail('Escribe el nombre de tu emprendimiento.');
  const avatar = (await resolveImage($('#eAvatar').value)).url, cover = (await resolveImage($('#eCover').value)).url;
  const place = readPlace('e');
  const pErr = placeError(place); if (pErr) return fail(pErr);
  const btn = $('#editSave'); btn.disabled = true;
  const imgErr = (await imageProblem($('#eAvatar').value, 'la foto de perfil')) || (await imageProblem($('#eCover').value, 'la portada'));
  if (imgErr) { btn.disabled = false; return fail(imgErr); }
  try {
    await saveProfile({
      name, category: $('#eCat').value, role: $('#eRole').value, bio: $('#eBio').value.trim(),
      ...place, avatar, cover,
      avatarPos: avatar ? EDIT.avatarPos : null, coverPos: cover ? EDIT.coverPos : null,
    });
    closeModal($('#editSheet'));
    toast('Perfil actualizado');
  } catch (e) { console.error(e); fail(authError(e)); }
  btn.disabled = false;
});
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  [$('#sheet'), $('#editSheet'), $('#commSheet'), $('#reportSheet'), ...ACCT_SHEETS.map((id) => $('#' + id))].forEach((m) => { if (!m.hidden) closeModal(m); });
  $('#chatMenu').hidden = true;
});
$('#shareBtn').addEventListener('click', async () => {
  const d = { title: `${ME.name} en BRIVIAN`, url: location.origin + location.pathname };
  try {
    if (navigator.share) await navigator.share(d);
    else { await navigator.clipboard.writeText(d.url); toast('Enlace copiado'); }
  } catch { /* cancelado */ }
});

/* ============================================================
   MENSAJES · chat 1 a 1 en tiempo real
   - Si ambas personas se siguen, el chat es directo.
   - Si no, el primer mensaje es una solicitud (un solo mensaje)
     que la otra persona acepta o rechaza.
   - Chat: chats/{uidA_uidB} (uids ordenados) + subcolección messages.
   ============================================================ */
const chatIdFor = (otherUid) => [ME.uid, otherUid].sort().join('_');
const msOr0 = (t) => (t ? toMs(t) : 0);
const pinfo = (u) => ({ name: u.name || 'Emprendedor', handle: u.handle || '', avatar: cleanUrl(u.avatar) || '', verified: u.verified === true });
const otherOf = (c) => {
  const uid = (c.members || []).find((m) => m !== ME.uid) || '';
  const saved = (c.people || {})[uid] || { name: 'Emprendedor' };
  const live = uCache.get(uid);
  return { uid, ...saved, ...(live ? { name: live.name || saved.name, avatar: live.avatar || '' , avatarPos: live.avatarPos, handle: live.handle || saved.handle, verified: live.verified === true } : {}) };
};
/* Para quien envió la solicitud, "rechazada" se ve igual que "pendiente" */
const isPendingForMe = (c) => c.status === 'pending' && c.requesterUid !== ME.uid;
const isUnread = (c) => c.lastSender && c.lastSender !== ME.uid && msOr0(c.lastAt) > msOr0((c.reads || {})[ME.uid]);
const readData = (d) => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) });

function startInbox() {
  if (!ME || (chat.unsub && chat.uid === ME.uid)) return;
  stopInbox();
  chat.uid = ME.uid;
  const q = query(collection(db, 'chats'), where('members', 'array-contains', ME.uid), limit(100));
  chat.unsub = onSnapshot(q, (snap) => {
    chat.list = snap.docs.map(readData).sort((a, b) => msOr0(b.lastAt) - msOr0(a.lastAt));
    chat.ready = true;
    updateMsgBadge();
    if (!$('#view-mensajes').hidden) renderInbox();
  }, (err) => {
    console.error(err);
    chat.ready = true;
    if (!chat.warned) { chat.warned = true; toast('No pudimos cargar tus mensajes'); }
    if (!$('#view-mensajes').hidden) renderInbox();
  });
}
function stopInbox() {
  if (chat.unsub) chat.unsub();
  Object.assign(chat, { unsub: null, uid: null, list: [], ready: false, warned: false });
}
function resetChat() { leaveChat(); stopInbox(); const b = $('#msgBtn'); if (b) b.classList.remove('has-badge'); updateBell(); }
function updateMsgBadge() {
  if (!ME) return;
  const any = chat.list.some((c) => (c.status === 'accepted' || isPendingForMe(c)) && isUnread(c));
  $('#msgBtn').classList.toggle('has-badge', any);
  updateBell();
}


/* ============================================================
   NOTIFICACIONES (campanita)
   ============================================================ */
const NOTIF = { unsub: null, uid: null, list: [], ready: false, hl: new Set(), marking: false };
const NOTIF_META = {
  follow: ['user-plus', 'empezó a seguirte'],
  like: ['heart', 'le dio like a tu publicación'],
  join: ['users', 'se unió a tu comunidad'],
  clike: ['heart', 'dio apoyo a tu publicación en la comunidad'],
};
const safeId = (s) => (/^[\w-]{1,128}$/.test(String(s || '')) ? s : '');
/* Aviso a otra persona. Si falla (sin permiso, ya existía) no afecta la acción principal. */
async function notify(toUid, type, extra = {}, id) {
  if (!ME || !toUid || toUid === ME.uid) return;
  try {
    const payload = { type, fromUid: ME.uid, fromName: String(ME.name || 'Alguien').slice(0, 60), fromAvatar: cleanUrl(ME.avatar) || '', read: false, at: serverTimestamp() };
    if (extra.targetId) payload.targetId = String(extra.targetId).slice(0, 128);
    if (extra.targetName) payload.targetName = String(extra.targetName).slice(0, 80);
    await setDoc(doc(db, 'users', toUid, 'notifications', id), payload);
  } catch (e) { console.debug('notify', e && e.code); }
}
function chatCounts() {
  if (!ME) return { unread: 0, requests: 0 };
  return {
    unread: chat.list.filter((c) => (c.status === 'accepted' || isPendingForMe(c)) && isUnread(c)).length,
    requests: chat.list.filter(isPendingForMe).length,
  };
}
function updateBell() {
  const b = $('#bellBtn'); if (!b) return;
  const n = ME ? NOTIF.list.filter((x) => !x.read).length : 0;
  const any = !!ME && (n > 0 || chatCounts().unread > 0);
  b.classList.toggle('has-badge', any);
  b.setAttribute('aria-label', any ? 'Notificaciones (tienes nuevas)' : 'Notificaciones');
}
function startNotifs() {
  if (!ME || (NOTIF.unsub && NOTIF.uid === ME.uid)) return;
  stopNotifs();
  NOTIF.uid = ME.uid;
  const q = query(collection(db, 'users', ME.uid, 'notifications'), orderBy('at', 'desc'), limit(50));
  NOTIF.unsub = onSnapshot(q, (snap) => {
    NOTIF.list = snap.docs.map(readData);
    NOTIF.ready = true;
    updateBell();
    if (!$('#view-notificaciones').hidden) { renderNotifs(); markNotifsRead(); }
    ensureUsers(NOTIF.list.map((x) => x.fromUid)).then((ch) => { if (ch && !$('#view-notificaciones').hidden) renderNotifs(); });
  }, (err) => { console.error(err); NOTIF.ready = true; if (!$('#view-notificaciones').hidden) renderNotifs(); });
}
function stopNotifs() {
  if (NOTIF.unsub) NOTIF.unsub();
  Object.assign(NOTIF, { unsub: null, uid: null, list: [], ready: false, marking: false });
  NOTIF.hl.clear();
  updateBell();
}
async function markNotifsRead() {
  if (!ME || NOTIF.marking) return;
  const unread = NOTIF.list.filter((x) => !x.read);
  if (!unread.length) return;
  unread.forEach((x) => NOTIF.hl.add(x.id));
  NOTIF.marking = true;
  try {
    const b = writeBatch(db);
    unread.forEach((x) => b.update(doc(db, 'users', ME.uid, 'notifications', x.id), { read: true }));
    await b.commit();
  } catch (e) { console.error(e); }
  NOTIF.marking = false;
}
function notifHref(n) {
  if (n.type === 'join' || n.type === 'clike') { const id = safeId(n.targetId); return id ? `#comunidad/${id}` : '#comunidad'; }
  const id = safeId(n.fromUid); return id ? `#u/${id}` : '#inicio';
}
function renderNotifs() {
  const box = $('#notifList'); if (!box || !ME) return;
  const cc = chatCounts();
  let html = '';
  if (cc.unread || cc.requests) {
    const bits = [];
    if (cc.unread) bits.push(`${cc.unread} ${cc.unread === 1 ? 'chat con mensajes sin leer' : 'chats con mensajes sin leer'}`);
    if (cc.requests) bits.push(`${cc.requests} ${cc.requests === 1 ? 'solicitud de mensaje' : 'solicitudes de mensaje'}`);
    html += `<a class="card chat-row ${cc.unread ? 'notif-new' : ''}" href="#mensajes">
      <span class="notif-ic"><i data-lucide="message-circle"></i></span>
      <div class="chat-main"><div class="notif-txt"><strong>Mensajes</strong><br>${esc(bits.join(' · '))}</div></div></a>`;
  }
  if (!NOTIF.ready && !html) { box.innerHTML = '<div class="loading">Cargando…</div>'; return; }
  html += NOTIF.list.map((n) => {
    const meta = NOTIF_META[n.type]; if (!meta) return '';
    const lv = liveUser(n.fromUid, { name: n.fromName, avatar: n.fromAvatar });
    const name = lv.name || n.fromName || 'Alguien';
    const isNew = !n.read || NOTIF.hl.has(n.id);
    const where = n.targetName ? ` · <em>${esc(n.targetName)}</em>` : '';
    return `<a class="card chat-row ${isNew ? 'notif-new' : ''}" href="${esc(notifHref(n))}">
      <span class="notif-ic">${avatarHTML(name, 'md', lv.avatar || n.fromAvatar, lv.avatar ? lv.avatarPos : null)}<span class="mini"><i data-lucide="${meta[0]}"></i></span></span>
      <div class="chat-main"><div class="chat-top"><span class="notif-txt"><strong>${esc(name)}</strong>${vbadge(lv)} ${meta[1]}${where}</span><time>${n.at ? timeAgo(n.at) : ''}</time></div></div>
      ${isNew ? '<span class="unread-dot" aria-label="Nueva"></span>' : ''}</a>`;
  }).join('');
  box.innerHTML = html || '<div class="empty">Todo al día. Aquí verás cuando alguien te siga, dé like o se una a tu comunidad.</div>';
  icons();
}
function showNotifs() { renderNotifs(); markNotifsRead(); }

/* ---- Bandeja ---- */
function showMensajes() {
  $$('#msgTabs .tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === state.msgTab));
  renderInbox();
}
function renderInbox() {
  const box = $('#chatList');
  const reqs = chat.list.filter(isPendingForMe);
  $('#reqCount').hidden = !reqs.length;
  $('#reqCount').textContent = reqs.length;
  if (!chat.ready) { box.innerHTML = '<div class="loading">Cargando mensajes…</div>'; return; }
  const chats = chat.list.filter((c) => c.status === 'accepted' || (c.status !== 'accepted' && !isPendingForMe(c) && c.requesterUid === ME.uid));
  const list = state.msgTab === 'solicitudes' ? reqs : chats;
  if (!list.length) {
    box.innerHTML = state.msgTab === 'solicitudes'
      ? '<div class="empty">No tienes solicitudes de mensaje.</div>'
      : '<div class="empty">Aún no tienes conversaciones.<br>Entra a Explorar y escríbele a un emprendimiento.<br><a class="btn btn-primary" href="#explorar">Explorar</a></div>';
    icons(); return;
  }
  ensureUsers(list.map((c) => otherOf(c).uid)).then((ch) => { if (ch && !$('#view-mensajes').hidden) renderInbox(); });
  box.innerHTML = list.map((c) => {
    const o = otherOf(c), unread = isUnread(c);
    const waiting = c.status !== 'accepted' && c.requesterUid === ME.uid;
    return `<a class="card chat-row ${unread ? 'unread' : ''}" href="#chat/${esc(c.id)}">
      ${avatarHTML(o.name, 'md', o.avatar, o.avatarPos)}
      <div class="chat-main">
        <div class="chat-top"><strong>${esc(o.name)}</strong>${vbadge(o)}<time>${c.lastAt ? timeAgo(c.lastAt) : ''}</time></div>
        <div class="chat-txt"><span class="chat-prev">${c.lastSender === ME.uid ? 'Tú: ' : ''}${esc(c.lastText || '')}</span>
          ${waiting ? '<span class="chat-req">Solicitud enviada</span>' : ''}${unread ? '<span class="unread-dot" aria-label="Sin leer"></span>' : ''}</div>
      </div></a>`;
  }).join('');
  icons();
}
$('#msgTabs').addEventListener('click', (e) => {
  const t = e.target.closest('[data-tab]'); if (!t) return;
  state.msgTab = t.dataset.tab; showMensajes();
});

/* ---- Conversación ---- */
function leaveChat() {
  const c = chat.ctx; if (!c) return;
  c.unsubChat && c.unsubChat(); c.unsubMsgs && c.unsubMsgs();
  chat.ctx = null;
  $('#chatMenu').hidden = true;
}
async function showChat(id) {
  const parts = String(id || '').split('_');
  if (parts.length !== 2 || !parts.includes(ME.uid) || parts[0] === parts[1]) { location.replace('#mensajes'); return; }
  if (chat.ctx && chat.ctx.id === id) { renderChat(); return; }
  leaveChat();
  const otherUid = parts.find((p) => p !== ME.uid);
  const ctx = { id, other: null, chat: null, msgs: [], theyFollowMe: false, loaded: false, sending: false, marking: false, first: true };
  chat.ctx = ctx;
  $('#chatWho').innerHTML = '<span class="muted">Cargando…</span>';
  $('#chatMsgs').innerHTML = ''; $('#chatBanner').innerHTML = ''; $('#chatInput').value = '';
  try {
    const [u, f] = await Promise.all([
      getDoc(doc(db, 'users', otherUid)),
      getDoc(doc(db, 'users', otherUid, 'following', ME.uid)).catch(() => null),
    ]);
    if (chat.ctx !== ctx) return;
    if (!u.exists()) { toast('No encontramos a esta persona'); location.replace('#mensajes'); return; }
    ctx.other = { uid: otherUid, ...pinfo(u.data()), avatarPos: u.data().avatarPos };
    ctx.theyFollowMe = !!(f && f.exists());
  } catch (e) {
    console.error(e); toast(authError(e)); location.replace('#mensajes'); return;
  }
  ctx.unsubChat = onSnapshot(doc(db, 'chats', id), (s) => {
    ctx.chat = s.exists() ? readData(s) : null;
    ctx.loaded = true;
    renderChat(); markRead();
  }, (e) => { console.error(e); ctx.loaded = true; renderChat(); });
  ctx.unsubMsgs = onSnapshot(
    query(collection(db, 'chats', id, 'messages'), orderBy('createdAt', 'asc'), limitToLast(60)),
    (s) => { ctx.msgs = s.docs.map(readData); renderChat(); markRead(); },
    (e) => console.error(e));
  renderChat();
}
async function markRead() {
  const ctx = chat.ctx;
  if (!ctx || !ctx.chat || ctx.marking || !isUnread(ctx.chat) || document.hidden) return;
  ctx.marking = true;
  try { await updateDoc(doc(db, 'chats', ctx.id), { ['reads.' + ME.uid]: serverTimestamp() }); }
  catch (e) { console.error(e); }
  ctx.marking = false;
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) markRead(); });

const dayLabel = (ms) => {
  const d = new Date(ms), t = new Date();
  const same = (a, b) => a.toDateString() === b.toDateString();
  if (same(d, t)) return 'Hoy';
  if (same(d, new Date(t - 864e5))) return 'Ayer';
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'long' });
};
const hourLabel = (ms) => new Date(ms).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

function renderChat() {
  const ctx = chat.ctx; if (!ctx || !ctx.other) return;
  const o = ctx.other, c = ctx.chat;
  $('#chatWho').dataset.user = o.uid;
  $('#chatWho').innerHTML = `${avatarHTML(o.name, 'sm', o.avatar, o.avatarPos)}<div style="min-width:0"><strong>${esc(o.name)}</strong>${vbadge(o)}${o.handle ? `<small>@${esc(o.handle)}</small>` : ''}</div>`;
  const blocked = state.blocked.has(o.uid);
  $('#chatBlock').textContent = blocked ? 'Desbloquear' : 'Bloquear';

  // Estado: qué puede hacer cada persona
  let banner = '', canWrite = false;
  const iFollow = state.following.has(o.uid);
  if (blocked) {
    banner = `<p>Bloqueaste a ${esc(o.name)}. No recibirás sus mensajes.</p><div class="row"><button class="btn btn-outline btn-sm" data-chat="unblock" type="button">Desbloquear</button></div>`;
  } else if (!c) {
    canWrite = true;
    if (!(iFollow && ctx.theyFollowMe)) banner = `<p>Aún no se siguen. Tu primer mensaje se enviará como <strong>solicitud</strong>; podrán conversar cuando ${esc(o.name)} la acepte.</p>`;
  } else if (c.status === 'accepted') {
    canWrite = true;
  } else if (isPendingForMe(c)) {
    banner = `<p>${esc(o.name)} quiere escribirte. Si aceptas, podrán conversar.</p><div class="row"><button class="btn btn-primary btn-sm" data-chat="accept" type="button">Aceptar</button><button class="btn btn-outline btn-sm" data-chat="decline" type="button">Rechazar</button></div>`;
  } else if (c.status === 'declined' && c.requesterUid !== ME.uid) {
    banner = `<p>Rechazaste esta solicitud.</p><div class="row"><button class="btn btn-outline btn-sm" data-chat="accept" type="button">Aceptar de todos modos</button></div>`;
  } else {
    banner = '<p>Solicitud enviada. Podrás seguir la conversación cuando la acepten.</p>';
  }
  $('#chatBanner').innerHTML = banner ? `<div class="chat-banner">${banner}</div>` : '';
  $('#chatForm').hidden = !canWrite;

  const box = $('#chatMsgs');
  const nearBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 140;
  if (!ctx.msgs.length) {
    box.innerHTML = `<div class="chat-empty">${ctx.loaded ? `Escribe tu primer mensaje a ${esc(o.name)}.` : 'Cargando…'}</div>`;
  } else {
    let lastDay = '', html = '';
    for (const m of ctx.msgs) {
      const ms = m.createdAt ? toMs(m.createdAt) : Date.now();
      const day = dayLabel(ms);
      if (day !== lastDay) { html += `<div class="day-sep">${esc(day)}</div>`; lastDay = day; }
      html += `<div class="bubble ${m.senderUid === ME.uid ? 'me' : 'them'}">${esc(m.text)}<time>${hourLabel(ms)}</time></div>`;
    }
    box.innerHTML = html;
  }
  icons();
  if (ctx.first || nearBottom) { window.scrollTo(0, document.documentElement.scrollHeight); if (ctx.loaded) ctx.first = false; }
}

async function sendMessage() {
  const ctx = chat.ctx;
  if (!ctx || !ctx.other || ctx.sending) return;
  const input = $('#chatInput');
  const text = input.value.trim();
  if (!text) return;
  if (state.blocked.has(ctx.other.uid)) { toast('Desbloquea a esta persona para escribirle'); return; }
  ctx.sending = true; $('#chatSend').disabled = true;
  try {
    const b = writeBatch(db);
    const chatRef = doc(db, 'chats', ctx.id);
    const msgs = collection(db, 'chats', ctx.id, 'messages');
    const preview = text.slice(0, 120);
    if (!ctx.chat) {
      const mutual = state.following.has(ctx.other.uid) && ctx.theyFollowMe;
      b.set(chatRef, {
        members: [ME.uid, ctx.other.uid].sort(),
        people: { [ME.uid]: pinfo(ME), [ctx.other.uid]: pinfo(ctx.other) },
        requesterUid: ME.uid, status: mutual ? 'accepted' : 'pending',
        lastText: preview, lastAt: serverTimestamp(), lastSender: ME.uid,
        reads: { [ME.uid]: serverTimestamp() }, createdAt: serverTimestamp(),
      });
      b.set(mutual ? doc(msgs) : doc(msgs, 'first'), { senderUid: ME.uid, text, createdAt: serverTimestamp() });
    } else {
      b.update(chatRef, { lastText: preview, lastAt: serverTimestamp(), lastSender: ME.uid, ['reads.' + ME.uid]: serverTimestamp() });
      b.set(doc(msgs), { senderUid: ME.uid, text, createdAt: serverTimestamp() });
    }
    await b.commit();
    input.value = ''; input.style.height = '';
    ctx.first = true;
  } catch (e) {
    console.error(e);
    toast(e && e.code === 'permission-denied' ? 'Firebase no permitió enviar este mensaje (permisos). Si pasa con todas las personas, falta publicar las reglas de Firestore más recientes.' : authError(e));
  }
  ctx.sending = false; $('#chatSend').disabled = false;
  if (chat.ctx === ctx) input.focus();
}

$('#chatForm').addEventListener('submit', (e) => { e.preventDefault(); sendMessage(); });
$('#chatInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); sendMessage(); }
});
$('#chatInput').addEventListener('input', (e) => {
  const t = e.target; t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 120) + 'px';
});

async function setChatStatus(status) {
  const ctx = chat.ctx; if (!ctx || !ctx.chat) return;
  try {
    await updateDoc(doc(db, 'chats', ctx.id), { status });
    toast(status === 'accepted' ? 'Solicitud aceptada' : 'Solicitud rechazada');
  } catch (e) { console.error(e); toast(authError(e)); }
}
async function setBlocked(on) {
  const ctx = chat.ctx; if (!ctx || !ctx.other) return;
  const ref = doc(db, 'users', ME.uid, 'blocked', ctx.other.uid);
  try {
    if (on) { await setDoc(ref, { at: serverTimestamp() }); state.blocked.add(ctx.other.uid); toast(`Bloqueaste a ${ctx.other.name}`); }
    else { await deleteDoc(ref); state.blocked.delete(ctx.other.uid); toast('Desbloqueado'); }
    renderChat();
  } catch (e) { console.error(e); toast(authError(e)); }
}
$('#chatBanner').addEventListener('click', (e) => {
  const b = e.target.closest('[data-chat]'); if (!b) return;
  const a = b.dataset.chat;
  if (a === 'accept') setChatStatus('accepted');
  else if (a === 'decline') setChatStatus('declined');
  else if (a === 'unblock') setBlocked(false);
});
$('#chatMenuBtn').addEventListener('click', (e) => { e.stopPropagation(); const m = $('#chatMenu'); m.hidden = !m.hidden; });
document.addEventListener('click', (e) => { if (!e.target.closest('.chat-menu-wrap')) $('#chatMenu').hidden = true; });
$('#chatBlock').addEventListener('click', () => {
  $('#chatMenu').hidden = true;
  const ctx = chat.ctx; if (!ctx || !ctx.other) return;
  if (state.blocked.has(ctx.other.uid)) { setBlocked(false); return; }
  if (window.confirm(`¿Bloquear a ${ctx.other.name}? Ya no podrá enviarte mensajes.`)) setBlocked(true);
});
$('#chatReport').addEventListener('click', () => {
  $('#chatMenu').hidden = true;
  $('#rpDetails').value = ''; $('#reportError').hidden = true;
  openModal($('#reportSheet'), '#rpReason');
});
$('#reportClose').addEventListener('click', () => closeModal($('#reportSheet')));
$('#reportSheet').addEventListener('click', (e) => { if (e.target.id === 'reportSheet') closeModal($('#reportSheet')); });
$('#rpSend').addEventListener('click', async () => {
  const ctx = chat.ctx; if (!ctx || !ctx.other) return;
  const btn = $('#rpSend'); btn.disabled = true;
  try {
    await addDoc(collection(db, 'reports'), {
      reporterUid: ME.uid, reportedUid: ctx.other.uid, chatId: ctx.id,
      reason: $('#rpReason').value, details: $('#rpDetails').value.trim().slice(0, 300), createdAt: serverTimestamp(),
    });
    closeModal($('#reportSheet'));
    toast('Reporte enviado. Gracias por avisarnos.');
  } catch (e) {
    console.error(e);
    const er = $('#reportError'); er.textContent = authError(e); er.hidden = false;
  }
  btn.disabled = false;
});

/* ---------- Tema ---------- */
function applyTheme(t) {
  document.documentElement.dataset.theme = t;
  $('#themeBtn').innerHTML = `<i data-lucide="${t === 'dark' ? 'sun' : 'moon'}"></i>`;
  icons();
}
$('#themeBtn').addEventListener('click', () => {
  const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  store.set('brivian.theme', t); applyTheme(t);
});

/* ============================================================
   Autenticación (Firebase Auth)
   ============================================================ */
const WORDMARK = 'BRIVI<svg class="lam" viewBox="0 0 10 10" aria-hidden="true"><path d="M1 10 5 1.2 9 10" fill="none" stroke="currentColor" stroke-width="2.3"/></svg>N';
$$('[data-wordmark]').forEach((el) => { el.classList.add('brand-name'); el.innerHTML = WORDMARK; });

/* Mostrar / ocultar contraseña */
$$('[data-toggle-pass]').forEach((btn) => btn.addEventListener('click', () => {
  const input = btn.parentElement.querySelector('input');
  const show = input.type === 'password';
  input.type = show ? 'text' : 'password';
  btn.setAttribute('aria-label', show ? 'Ocultar contraseña' : 'Mostrar contraseña');
  btn.innerHTML = `<i data-lucide="${show ? 'eye-off' : 'eye'}"></i>`;
  icons();
}));

/* ----- Inicio de sesión ----- */
$('#loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = $('#lError');
  const fail = (m) => { err.textContent = m; err.hidden = false; };
  err.hidden = true;
  const email = $('#lEmail').value.trim().toLowerCase();
  const pass = $('#lPass').value;
  if (!/^\S+@\S+\.\S+$/.test(email)) return fail('Escribe un correo válido.');
  if (!pass) return fail('Escribe tu contraseña.');
  const btn = $('#loginForm button[type="submit"]'); btn.disabled = true;
  try {
    const cred = await signInWithEmailAndPassword(auth, email, pass);
    const ok = await loadSession(cred.user);
    if (!ok) {
      await signOut(auth);
      return fail('No encontramos tu perfil. Escríbenos a hola@brivian.com.');
    }
    e.target.reset();
    applyMe();
    toast(`Bienvenido, ${ME.name}`);
    location.hash = 'inicio';
  } catch (ex) { console.error(ex); fail(authError(ex)); }
  finally { btn.disabled = false; }
});
$('#forgotBtn').addEventListener('click', async () => {
  const err = $('#lError');
  const email = $('#lEmail').value.trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) { err.textContent = 'Escribe tu correo arriba y vuelve a tocar "¿Olvidaste tu contraseña?".'; err.hidden = false; return; }
  err.hidden = true;
  try {
    await sendPasswordResetEmail(auth, email);
    toast('Si el correo está registrado, te enviamos un enlace para cambiar tu contraseña.');
  } catch (ex) { console.error(ex); err.textContent = authError(ex); err.hidden = false; }
});

/* ============================================================
   MENÚ DE CUENTA (⋮): verificar correo, contraseña, ayuda,
   términos, eliminar cuenta y cerrar sesión
   ============================================================ */
const ACCT_SHEETS = ['menuSheet', 'emailSheet', 'verifySheet', 'helpSheet', 'legalSheet', 'delSheet'];
const closeAcct = () => ACCT_SHEETS.forEach((id) => { const m = $('#' + id); if (!m.hidden) closeModal(m); });
const openAcct = (id, focus) => { closeAcct(); openModal($('#' + id), focus); };
ACCT_SHEETS.forEach((id) => {
  const m = $('#' + id);
  m.addEventListener('click', (e) => { if (e.target === m) closeModal(m); });
});
[['menuClose', 'menuSheet'], ['emailClose', 'emailSheet'], ['verifyClose', 'verifySheet'], ['helpClose', 'helpSheet'], ['legalClose', 'legalSheet'], ['delClose', 'delSheet']]
  .forEach(([b, s]) => $('#' + b).addEventListener('click', () => closeModal($('#' + s))));
const mailVerified = () => !!(auth.currentUser && auth.currentUser.emailVerified);
function paintMenu() {
  const u = auth.currentUser;
  $('#menuEmail').textContent = u && u.email ? u.email : '';
  const tag = $('#mVerifyTag'), ok = mailVerified();
  tag.textContent = ok ? 'Verificado' : 'Pendiente';
  tag.className = 'menu-tag ' + (ok ? 'good' : 'warn');
}
$('#profMenuBtn').addEventListener('click', () => { paintMenu(); openAcct('menuSheet', '#menuClose'); icons(); });

/* ---- Verificación de correo ---- */
function paintVerify(sent) {
  const u = auth.currentUser, ok = mailVerified();
  $('#verifyError').hidden = true;
  $('#verifyText').textContent = ok
    ? `Tu correo ${u ? u.email : ''} está verificado. ✓`
    : sent
      ? `Te enviamos un enlace a ${u ? u.email : 'tu correo'}. Ábrelo (revisa también spam) y luego toca “Ya verifiqué mi correo”.`
      : `Verifica ${u ? u.email : 'tu correo'} para proteger tu cuenta y poder recuperarla si olvidas tu contraseña.`;
  $('#verifySend').hidden = ok;
  $('#verifySend').textContent = sent ? 'Reenviar correo' : 'Enviar correo de verificación';
  $('#verifyCheck').hidden = ok || !sent;
}
$('#mVerify').addEventListener('click', () => { paintVerify(false); openAcct('verifySheet', '#verifyClose'); });
$('#verifySend').addEventListener('click', async () => {
  const btn = $('#verifySend'); btn.disabled = true;
  try { await sendEmailVerification(auth.currentUser); paintVerify(true); toast('Correo enviado'); }
  catch (e) { console.error(e); const er = $('#verifyError'); er.textContent = authError(e); er.hidden = false; }
  btn.disabled = false;
});
$('#verifyCheck').addEventListener('click', async () => {
  const btn = $('#verifyCheck'); btn.disabled = true;
  try {
    await auth.currentUser.reload();
    if (mailVerified()) { paintVerify(false); await syncVerified(); renderProfile(); toast('¡Correo verificado!'); }
    else { const er = $('#verifyError'); er.textContent = 'Todavía no aparece como verificado. Abre el enlace del correo y vuelve a intentarlo.'; er.hidden = false; }
  } catch (e) { console.error(e); const er = $('#verifyError'); er.textContent = authError(e); er.hidden = false; }
  btn.disabled = false;
});

/* ---- Cambiar correo electrónico ---- */
$('#mEmail').addEventListener('click', () => {
  const u = auth.currentUser; if (!u) return;
  $('#emailNow').textContent = u.email || '';
  $('#newEmail').value = ''; $('#emailPass').value = ''; $('#emailError').hidden = true;
  $('#emailForm').hidden = false; $('#emailDone').hidden = true;
  openAcct('emailSheet', '#newEmail');
});
$('#emailOk').addEventListener('click', () => closeAcct());
$('#emailGo').addEventListener('click', async () => {
  const u = auth.currentUser, err = $('#emailError');
  const next = $('#newEmail').value.trim().toLowerCase(), pass = $('#emailPass').value;
  const fail = (m) => { err.textContent = m; err.hidden = false; };
  err.hidden = true;
  if (!u) return;
  if (!/^\S+@\S+\.\S+$/.test(next)) return fail('Escribe un correo nuevo válido.');
  if (next === String(u.email || '').toLowerCase()) return fail('Ese ya es tu correo actual.');
  if (!pass) return fail('Escribe tu contraseña actual para confirmar.');
  const btn = $('#emailGo'); btn.disabled = true;
  try {
    await reauthenticateWithCredential(u, EmailAuthProvider.credential(u.email, pass));
    await verifyBeforeUpdateEmail(u, next);
    $('#emailSentTo').textContent = next;
    $('#emailForm').hidden = true; $('#emailDone').hidden = false;
  } catch (e) {
    console.error(e);
    fail(['auth/wrong-password', 'auth/invalid-credential'].includes(e.code) ? 'Contraseña incorrecta.' : authError(e));
  }
  btn.disabled = false;
});

/* ---- Cambiar contraseña (por correo) ---- */
$('#mPass').addEventListener('click', async () => {
  const u = auth.currentUser; if (!u || !u.email) return;
  if (!window.confirm(`Te enviaremos un correo a ${u.email} para que cambies tu contraseña. ¿Continuar?`)) return;
  try { await sendPasswordResetEmail(auth, u.email); closeAcct(); toast('Te enviamos el correo para cambiar tu contraseña'); }
  catch (e) { console.error(e); toast(authError(e)); }
});

/* ---- Ayuda y reportar un problema ---- */
$('#mHelp').addEventListener('click', () => { $('#hpText').value = ''; $('#helpError').hidden = true; openAcct('helpSheet', '#helpClose'); });
$('#hpSend').addEventListener('click', async () => {
  const text = $('#hpText').value.trim(), err = $('#helpError');
  if (text.length < 5) { err.textContent = 'Cuéntanos un poco más (mínimo 5 letras).'; err.hidden = false; return; }
  const btn = $('#hpSend'); btn.disabled = true; err.hidden = true;
  try {
    await addDoc(collection(db, 'feedback'), {
      uid: ME.uid, kind: $('#hpKind').value, text: text.slice(0, 1000),
      page: String(location.hash || '#').slice(0, 100), ua: String(navigator.userAgent || '').slice(0, 300),
      createdAt: serverTimestamp(),
    });
    closeModal($('#helpSheet')); toast('¡Gracias! Recibimos tu mensaje');
  } catch (e) { console.error(e); err.textContent = authError(e); err.hidden = false; }
  btn.disabled = false;
});

/* ---- Términos y privacidad ---- */
$('#mLegal').addEventListener('click', () => openAcct('legalSheet', '#legalClose'));
document.addEventListener('click', (e) => {
  const l = e.target.closest('[data-legal]'); if (!l) return;
  e.preventDefault(); openAcct('legalSheet', '#legalClose');
});

/* ---- Cerrar sesión ---- */
$('#logoutBtn').addEventListener('click', async () => {
  closeAcct();
  location.hash = 'landing';
  try { await signOut(auth); toast('Sesión cerrada'); } catch (e) { console.error(e); toast(authError(e)); }
});

/* ---- Eliminar cuenta ---- */
$('#mDelete').addEventListener('click', () => { $('#delPass').value = ''; $('#delError').hidden = true; openAcct('delSheet', '#delPass'); });
const chunk = (arr, n) => { const out = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out; };
async function eraseMyData(uid, handle) {
  const step = async (fn) => { try { await fn(); } catch (e) { console.error('eliminar cuenta:', e); } };
  const sub = (name) => getDocs(collection(db, 'users', uid, name)).then((s) => s.docs);
  // comunidades que creé (se borran) y a las que me uní (salgo)
  const owned = new Set();
  await step(async () => {
    const s = await getDocs(query(collection(db, 'communities'), where('ownerUid', '==', uid)));
    for (const d of s.docs) { owned.add(d.id); await deleteDoc(d.ref).catch((e) => console.error(e)); }
  });
  await step(async () => {
    for (const d of await sub('joined')) {
      if (owned.has(d.id)) { await deleteDoc(d.ref).catch(() => {}); continue; }
      try {
        const b = writeBatch(db);
        b.delete(doc(db, 'communities', d.id, 'members', uid)); b.delete(d.ref);
        b.update(doc(db, 'communities', d.id), { membersCount: increment(-1) });
        await b.commit();
      } catch (e) { await deleteDoc(d.ref).catch(() => {}); }   // la comunidad ya no existe
    }
  });
  // dejar de seguir a todos (baja el contador de cada persona)
  await step(async () => {
    for (const d of await sub('following')) {
      try {
        const b = writeBatch(db);
        b.delete(d.ref); b.update(doc(db, 'users', d.id), { followersCount: increment(-1) });
        await b.commit();
      } catch (e) { await deleteDoc(d.ref).catch(() => {}); }
    }
  });
  // mis publicaciones
  await step(async () => {
    const s = await getDocs(query(collection(db, 'posts'), where('authorUid', '==', uid)));
    for (const part of chunk(s.docs, 400)) { const b = writeBatch(db); part.forEach((d) => b.delete(d.ref)); await b.commit(); }
  });
  // datos privados
  for (const name of ['saved', 'likedPosts', 'notifications', 'blocked']) {
    await step(async () => { for (const part of chunk(await sub(name), 400)) { const b = writeBatch(db); part.forEach((d) => b.delete(d.ref)); await b.commit(); } });
  }
  await step(() => deleteDoc(doc(db, 'handles', handle)));
}
$('#delGo').addEventListener('click', async () => {
  const pass = $('#delPass').value, err = $('#delError'), u = auth.currentUser;
  if (!u || !ME) return;
  if (!pass) { err.textContent = 'Escribe tu contraseña.'; err.hidden = false; return; }
  const btn = $('#delGo'); btn.disabled = true; err.hidden = true;
  try {
    try { await reauthenticateWithCredential(u, EmailAuthProvider.credential(u.email, pass)); }
    catch (e) {
      console.error(e);
      err.textContent = ['auth/wrong-password', 'auth/invalid-credential'].includes(e.code) ? 'Contraseña incorrecta.' : authError(e);
      err.hidden = false; btn.disabled = false; return;
    }
    const uid = ME.uid, handle = ME.handle;
    btn.textContent = 'Eliminando…';
    stopNotifs(); stopInbox();
    await eraseMyData(uid, handle);
    await deleteDoc(doc(db, 'users', uid));          // si falla, la cuenta sigue intacta y se puede reintentar
    await deleteUser(u);
    closeAcct();
    location.hash = 'landing';
    toast('Tu cuenta fue eliminada');
  } catch (e) {
    console.error(e);
    err.textContent = e.code === 'permission-denied' ? 'No pudimos borrar tu perfil. Revisa que publicaste las reglas de Firestore nuevas.' : authError(e);
    err.hidden = false;
    if (ME) { startInbox(); startNotifs(); }
  }
  btn.disabled = false; btn.innerHTML = '<i data-lucide="trash-2"></i> Eliminar para siempre'; icons();
});

/* ----- Crear cuenta (4 pasos) ----- */
const REG_TOTAL = 4;
const REG = { step: 1, handleTouched: false, social: createSocialEditor($('#regSocials')) };
const slug = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 20);

function previewPick(box, url, pos) {
  const u = cleanUrl(url);
  let im = box.querySelector('.pick-img');
  if (!u) { if (im) im.remove(); box.classList.remove('has-img'); return; }
  if (!im) { im = document.createElement('img'); im.className = 'pick-img'; im.alt = ''; im.referrerPolicy = 'no-referrer'; box.prepend(im); }
  if (im.getAttribute('src') !== u) im.src = u;
  im.style.cssText = posCss(pos);
  box.classList.add('has-img');
}
function showStep(n) {
  REG.step = n;
  $$('.reg-step').forEach((s) => (s.hidden = Number(s.dataset.step) !== n));
  $('#stepLabel').textContent = `Paso ${n} de ${REG_TOTAL}`;
  $('#regProgress').style.width = `${(n / REG_TOTAL) * 100}%`;
  $('#regNext').innerHTML = n === REG_TOTAL ? '<i data-lucide="check"></i> Crear mi perfil' : 'Continuar <i data-lucide="arrow-right"></i>';
  $('#regError').hidden = true;
  if (n === REG_TOTAL) {
    $('#prevName').textContent = $('#rName').value.trim();
    $('#prevHandle').textContent = `@${$('#rHandle').value.trim().toLowerCase()}`;
  }
  icons();
  window.scrollTo(0, 0);
}
async function validateStep(n) {
  if (n === 1) {
    if (!/^\S+@\S+\.\S+$/.test($('#rEmail').value.trim())) return 'Escribe un correo válido.';
    if ($('#rPass').value.length < 8) return 'La contraseña debe tener al menos 8 caracteres.';
    if (!$('#rTerms').checked) return 'Acepta los términos para continuar.';
  }
  if (n === 2) {
    if ($('#rName').value.trim().length < 2) return 'Escribe el nombre de tu emprendimiento.';
    const h = $('#rHandle').value.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,20}$/.test(h)) return 'El usuario debe tener de 3 a 20 letras, números o guion bajo.';
    try {
      if ((await getDoc(doc(db, 'handles', h))).exists()) return 'Ese usuario ya está en uso. Prueba con otro.';
    } catch (e) { console.error(e); return 'No pudimos verificar el usuario. Revisa tu conexión y las reglas de Firestore.'; }
  }
  if (n === 3) return REG.social.validate().error;
  if (n === 4) {
    const pErr = placeError(readPlace('r')); if (pErr) return pErr;
    const imgErr = (await imageProblem($('#rAvatarUrl').value, 'la foto de perfil')) || (await imageProblem($('#rCoverUrl').value, 'la portada'));
    if (imgErr) return imgErr;
  }
  return '';
}
$('#rName').addEventListener('input', (e) => { if (!REG.handleTouched) $('#rHandle').value = slug(e.target.value); });
$('#rHandle').addEventListener('input', (e) => { REG.handleTouched = true; e.target.value = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''); });
const regImg = { avatar: { url: '', pos: null }, cover: { url: '', pos: null } };
const regAvatarWatch = watchImageInput($('#rAvatarUrl'), $('#rAvatarStatus'), (u) => { regImg.avatar.url = u; previewPick($('#avatarPick'), u, regImg.avatar.pos); });
const regCoverWatch = watchImageInput($('#rCoverUrl'), $('#rCoverStatus'), (u) => { regImg.cover.url = u; previewPick($('#coverPick'), u, regImg.cover.pos); });
const regAvatarAdj = wireAdjust({ input: $('#rAvatarUrl'), btn: $('#rAvatarAdj'), kind: 'round', get: () => regImg.avatar.pos, set: (p) => { regImg.avatar.pos = p; previewPick($('#avatarPick'), regImg.avatar.url, p); } });
const regCoverAdj = wireAdjust({ input: $('#rCoverUrl'), btn: $('#rCoverAdj'), kind: 'wide', get: () => regImg.cover.pos, set: (p) => { regImg.cover.pos = p; previewPick($('#coverPick'), regImg.cover.url, p); } });
$('#regBack').addEventListener('click', () => (REG.step > 1 ? showStep(REG.step - 1) : (location.hash = 'landing')));
$('#skipSocials').addEventListener('click', () => { REG.social.reset({}); showStep(4); });

function resetRegForm() {
  $('#regForm').reset();
  REG.handleTouched = false;
  REG.social.reset({});
  previewPick($('#avatarPick'), ''); previewPick($('#coverPick'), '');
  regImg.avatar = { url: '', pos: null }; regImg.cover = { url: '', pos: null };
  regAvatarAdj.sync(); regCoverAdj.sync();
  regAvatarWatch.clear(); regCoverWatch.clear();
  showStep(1);
}
$('#regForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = $('#regError');
  const next = $('#regNext');
  if (next.disabled) return;
  next.disabled = true;
  try {
    const msg = await validateStep(REG.step);
    if (msg) { err.textContent = msg; err.hidden = false; return; }
    if (REG.step < REG_TOTAL) { showStep(REG.step + 1); return; }

    const email = $('#rEmail').value.trim().toLowerCase();
    const handle = $('#rHandle').value.trim().toLowerCase();
    const place = readPlace('r');
    const avatarUrl = (await resolveImage($('#rAvatarUrl').value)).url, coverUrl = (await resolveImage($('#rCoverUrl').value)).url;
    const profile = {
      name: $('#rName').value.trim(), handle,
      category: $('#rCat').value, role: $('#rRole').value, bio: $('#rBio').value.trim(),
      ...place,
      since: new Date().getFullYear(),
      avatar: avatarUrl, cover: coverUrl,
      ...(avatarUrl && regImg.avatar.pos ? { avatarPos: regImg.avatar.pos } : {}),
      ...(coverUrl && regImg.cover.pos ? { coverPos: regImg.cover.pos } : {}),
      socials: REG.social.validate().values, followersCount: 0,
    };

    registering = true;
    let cred;
    try {
      cred = await createUserWithEmailAndPassword(auth, email, $('#rPass').value);
    } catch (ex) {
      console.error(ex);
      err.textContent = authError(ex); err.hidden = false;
      if (ex.code === 'auth/email-already-in-use' || ex.code === 'auth/invalid-email' || ex.code === 'auth/weak-password') showStep(1);
      err.hidden = false;
      return;
    }
    try {
      await runTransaction(db, async (tx) => {
        const hRef = doc(db, 'handles', handle);
        if ((await tx.get(hRef)).exists()) { const t = new Error('handle-taken'); t.code = 'app/handle-taken'; throw t; }
        tx.set(hRef, { uid: cred.user.uid });
        tx.set(doc(db, 'users', cred.user.uid), { ...profile, createdAt: serverTimestamp() });
      });
    } catch (ex) {
      console.error(ex);
      await deleteUser(cred.user).catch(() => {});   // no dejar una cuenta sin perfil
      showStep(ex.code === 'app/handle-taken' ? 2 : REG_TOTAL);
      err.textContent = authError(ex); err.hidden = false;
      return;
    }
    await loadSession(cred.user, true);
    applyMe();
    resetRegForm();
    toast(`¡Bienvenido a BRIVIAN, ${profile.name}!`);
    registering = false;
    location.hash = 'inicio';
  } finally {
    registering = false;
    next.disabled = false;
  }
});
showStep(1);

/* ---------- Splash al abrir (logo + nombre, como app) ---------- */
function showSplash() {
  const el = $('#splash');
  if (!el) return;
  const minTime = new Promise((r) => setTimeout(r, 1700));
  Promise.all([minTime, authReadyPromise]).then(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 600);
  });
}

/* ---------- Arranque ---------- */
(function init() {
  $('#year').textContent = new Date().getFullYear();
  applyTheme(store.get('brivian.theme', null) || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
  fillSelects();
  renderLandingCategories();
  loadLandingCommunities();
  renderTypeChips();
  showSplash();

  // Firebase avisa del estado de la sesión al abrir la página y cada vez que cambia
  onAuthStateChanged(auth, async (user) => {
    if (registering) return;           // el registro maneja su propia sesión
    try {
      if (user) {
        const ok = await loadSession(user);
        if (!ok) { clearSession(); await signOut(auth).catch(() => {}); toast('No encontramos tu perfil. Escríbenos a hola@brivian.com.'); }
      } else clearSession();
    } catch (e) {
      console.error(e); clearSession(); toast(authError(e));
    }
    if (!authReady) { authReady = true; resolveAuthReady(); }
    route();
  });

  window.__bvReady = true;   // avisa a la red de seguridad del index.html que la app sí arrancó
  // Si Firebase no responde (sin internet, bloqueado), no dejar la pantalla congelada
  setTimeout(() => {
    if (authReady) return;
    console.warn('Firebase no respondió a tiempo; se continúa sin sesión.');
    clearSession();
    authReady = true; resolveAuthReady();
    toast('No pudimos conectar con el servidor. Revisa tu internet.');
    route();
  }, 6000);
})();