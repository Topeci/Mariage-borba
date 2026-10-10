/**
 * API du mariage de Jean-Louis & Prunelle — version 2
 * — enregistre les réponses des invités (RSVP)
 * — gère le plan de table et le plan de la salle de l'Espace mariés
 * — permet aux invités de retrouver leur table sur le plan
 *
 * Mise à jour : collez ce code à la place de l'ancien, remettez votre code secret,
 * puis Déployer > Gérer les déploiements > crayon > Version : Nouvelle version > Déployer.
 */

const ADMIN_CODE = 'JP2027'; // ← votre code secret de l'Espace mariés

const SS = SpreadsheetApp.getActiveSpreadsheet();
const HEADERS = {
  Reponses:  ['id', 'date', 'nom', 'presence', 'nb', 'allergies', 'chanson', 'message'],
  Personnes: ['id', 'reponseId', 'nom', 'table', 'siege'],
  Tables:    ['id', 'nom', 'sieges', 'forme', 'x', 'y', 'rot'],
  Salle:     ['cle', 'valeur']
};
const FORMES = ['ronde', 'rect', 'honneur'];

/* ---------- Outils feuilles ---------- */
function sheet_(name) {
  let sh = SS.getSheetByName(name);
  const h = HEADERS[name];
  if (!sh) {
    sh = SS.insertSheet(name);
    sh.appendRow(h);
    sh.setFrozenRows(1);
  } else if (sh.getLastColumn() < h.length) {
    sh.getRange(1, 1, 1, h.length).setValues([h]); // ajoute les nouvelles colonnes
  }
  sh.getRange(1, 1, 1, h.length).setFontWeight('bold');
  return sh;
}
function rows_(name) {
  const sh = sheet_(name), h = HEADERS[name];
  const last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, h.length).getValues()
    .filter(r => r[0] !== '')
    .map(r => Object.fromEntries(h.map((k, i) => [k, r[i] instanceof Date ? r[i].toISOString() : r[i]])));
}
function writeAll_(name, list) {
  const sh = sheet_(name), h = HEADERS[name];
  const last = sh.getLastRow();
  if (last > 1) sh.getRange(2, 1, last - 1, h.length).clearContent();
  if (list.length) sh.getRange(2, 1, list.length, h.length).setValues(list.map(o => h.map(k => o[k] === undefined || o[k] === null ? '' : o[k])));
}
function clean_(v, max) {
  let s = String(v === undefined || v === null ? '' : v).trim().slice(0, max || 200);
  if (/^[=+\-@]/.test(s)) s = "'" + s; // évite les formules dans le Sheet
  return s;
}
function num_(v, min, max, def) { const n = Number(v); return isFinite(n) && v !== '' && v !== null ? Math.max(min, Math.min(max, Math.round(n))) : def; }
function uid_() { return Utilities.getUuid().slice(0, 8); }
function norm_(s) { return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim(); }
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

/* Plan de la salle (décor + dessins), stocké en JSON découpé */
function readSalle_() {
  const txt = rows_('Salle').sort((a, b) => String(a.cle).localeCompare(String(b.cle), 'en', { numeric: true })).map(r => String(r.valeur)).join('');
  try { const s = JSON.parse(txt || '{}'); return { decor: s.decor || [], strokes: s.strokes || [] }; } catch (e) { return { decor: [], strokes: [] }; }
}
function writeSalle_(salle) {
  const decor = (salle && Array.isArray(salle.decor) ? salle.decor : []).slice(0, 80).map(d => ({
    id: String(d.id || uid_()).slice(0, 20), type: String(d.type || 'texte').slice(0, 20), label: String(d.label || '').slice(0, 60),
    x: num_(d.x, -500, 3000, 100), y: num_(d.y, -500, 3000, 100), w: num_(d.w, 10, 1600, 120), h: num_(d.h, 10, 1600, 60), rot: num_(d.rot, -360, 360, 0)
  }));
  const strokes = (salle && Array.isArray(salle.strokes) ? salle.strokes : []).slice(0, 300).map(s => ({
    c: /^#[0-9a-f]{3,8}$/i.test(s.c) ? s.c : '#6b4a33', w: num_(s.w, 1, 30, 4),
    p: (Array.isArray(s.p) ? s.p : []).slice(0, 2000).map(n => num_(n, -500, 3000, 0))
  }));
  const txt = JSON.stringify({ decor, strokes });
  const parts = [];
  for (let i = 0; i < txt.length; i += 40000) parts.push({ cle: 'salle_' + parts.length, valeur: txt.slice(i, i + 40000) });
  writeAll_('Salle', parts);
}
function saveTables_(list) {
  const tables = (list || []).slice(0, 200).map(t => ({
    id: clean_(t.id, 20) || uid_(), nom: clean_(t.nom, 60) || 'Table',
    sieges: num_(t.sieges, 1, 60, 8), forme: FORMES.indexOf(t.forme) >= 0 ? t.forme : 'ronde',
    x: t.x === '' || t.x === null || t.x === undefined ? '' : num_(t.x, -500, 3000, 0),
    y: t.y === '' || t.y === null || t.y === undefined ? '' : num_(t.y, -500, 3000, 0),
    rot: num_(t.rot, -360, 360, 0)
  }));
  writeAll_('Tables', tables);
  const byId = new Map(tables.map(t => [t.id, t]));
  writeAll_('Personnes', rows_('Personnes').map(p => {
    const t = byId.get(p.table);
    if (!t || Number(p.siege) > t.sieges) { p.table = ''; p.siege = ''; }
    return p;
  }));
}
function state_() {
  return { ok: true, version: 2, reponses: rows_('Reponses'), personnes: rows_('Personnes'), tables: rows_('Tables'), salle: readSalle_() };
}

/* Lancez cette fonction une fois pour créer ou mettre à jour les onglets */
function setup() { Object.keys(HEADERS).forEach(sheet_); }

/* ---------- Lecture ---------- */
function doGet(e) {
  const p = e.parameter || {};
  try {
    if (p.action === 'find') { // « Trouver ma table » côté invités
      const q = norm_(p.nom || '');
      if (q.length < 3) return out_({ ok: true, res: [] });
      const tables = rows_('Tables');
      const res = rows_('Personnes')
        .filter(x => norm_(x.nom).includes(q))
        .slice(0, 6)
        .map(x => {
          const t = tables.find(t => t.id === x.table);
          return { nom: x.nom, table: t ? t.nom : '', siege: t ? x.siege : '', tableId: t ? t.id : '' };
        });
      const plan = res.some(r => r.tableId)
        ? { tables: tables.map(t => ({ id: t.id, nom: t.nom, sieges: t.sieges, forme: t.forme, x: t.x, y: t.y, rot: t.rot })), salle: readSalle_() }
        : null;
      return out_({ ok: true, res, plan });
    }
    if (p.action === 'data') {
      if (p.code !== ADMIN_CODE) return out_({ ok: false, error: 'code' });
      return out_(state_());
    }
    return out_({ ok: true, version: 2, message: 'API du mariage en ligne' });
  } catch (err) {
    return out_({ ok: false, error: String(err) });
  }
}

/* ---------- Écriture ---------- */
function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const b = JSON.parse(e.postData.contents);

    // Réponse d'un invité (public)
    if (b.action === 'rsvp') {
      const nom = clean_(b.nom, 120);
      if (!nom) return out_({ ok: false, error: 'nom' });
      const oui = b.presence === 'oui';
      const noms = (Array.isArray(b.personnes) ? b.personnes : []).map(n => clean_(n, 120)).filter(Boolean).slice(0, 10);
      if (oui && !noms.length) noms.push(nom);
      const id = uid_();
      sheet_('Reponses').appendRow([id, new Date(), nom, oui ? 'oui' : 'non', oui ? noms.length : 0,
        clean_(b.allergies, 300), clean_(b.chanson, 200), clean_(b.message, 1000)]);
      if (oui) {
        const sh = sheet_('Personnes');
        noms.forEach(n => sh.appendRow([uid_(), id, n, '', '']));
      }
      return out_({ ok: true });
    }

    // Tout le reste est réservé aux mariés
    if (b.code !== ADMIN_CODE) return out_({ ok: false, error: 'code' });

    if (b.action === 'saveTables') saveTables_(b.tables);

    if (b.action === 'saveLayout') {
      saveTables_(b.tables);
      writeSalle_(b.salle);
    }

    if (b.action === 'place') { // b.moves = [{id, table, siege}]
      const ps = rows_('Personnes');
      const byId = new Map(ps.map(p => [p.id, p]));
      (b.moves || []).forEach(m => {
        const p = byId.get(m.id);
        if (p) { p.table = m.table || ''; p.siege = m.table ? Number(m.siege) || '' : ''; }
      });
      writeAll_('Personnes', ps);
    }

    if (b.action === 'addPerson') {
      const nom = clean_(b.nom, 120);
      if (nom) sheet_('Personnes').appendRow([uid_(), 'ajout-manuel', nom, '', '']);
    }

    if (b.action === 'deletePerson') {
      writeAll_('Personnes', rows_('Personnes').filter(p => p.id !== b.id));
    }

    return out_(state_());
  } catch (err) {
    return out_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}
