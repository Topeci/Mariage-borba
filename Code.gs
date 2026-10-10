/**
 * API du mariage de Jean-Louis & Prunelle
 * — enregistre les réponses des invités (RSVP)
 * — gère le plan de table de l'Espace mariés
 * — permet aux invités de retrouver leur table
 *
 * 1) Collez ce code dans Extensions > Apps Script du Google Sheet
 * 2) Changez le code secret ci-dessous
 * 3) Déployer > Nouveau déploiement > Application Web
 *    Exécuter en tant que : Moi  |  Accès : Tout le monde
 */

const ADMIN_CODE = 'JP2027'; // ← code secret de l'Espace mariés, à changer

const SS = SpreadsheetApp.getActiveSpreadsheet();
const HEADERS = {
  Reponses:  ['id', 'date', 'nom', 'presence', 'nb', 'allergies', 'chanson', 'message'],
  Personnes: ['id', 'reponseId', 'nom', 'table', 'siege'],
  Tables:    ['id', 'nom', 'sieges']
};

/* ---------- Outils feuilles ---------- */
function sheet_(name) {
  let sh = SS.getSheetByName(name);
  if (!sh) {
    sh = SS.insertSheet(name);
    sh.appendRow(HEADERS[name]);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, HEADERS[name].length).setFontWeight('bold');
  }
  return sh;
}
function rows_(name) {
  const values = sheet_(name).getDataRange().getValues();
  const head = values.shift();
  return values
    .filter(r => r[0] !== '')
    .map(r => Object.fromEntries(head.map((k, i) => [k, r[i] instanceof Date ? r[i].toISOString() : r[i]])));
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
function uid_() { return Utilities.getUuid().slice(0, 8); }
function norm_(s) { return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim(); }
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function state_() { return { ok: true, reponses: rows_('Reponses'), personnes: rows_('Personnes'), tables: rows_('Tables') }; }

/* Lancez cette fonction une fois pour créer les onglets */
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
          return { nom: x.nom, table: t ? t.nom : '', siege: t ? x.siege : '' };
        });
      return out_({ ok: true, res });
    }
    if (p.action === 'data') {
      if (p.code !== ADMIN_CODE) return out_({ ok: false, error: 'code' });
      return out_(state_());
    }
    return out_({ ok: true, message: 'API du mariage en ligne' });
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

    if (b.action === 'saveTables') {
      const tables = (b.tables || []).map(t => ({ id: clean_(t.id, 20) || uid_(), nom: clean_(t.nom, 60), sieges: Math.max(1, Math.min(30, Number(t.sieges) || 8)) }));
      writeAll_('Tables', tables);
      const byId = new Map(tables.map(t => [t.id, t]));
      const ps = rows_('Personnes').map(p => {
        const t = byId.get(p.table);
        if (!t || Number(p.siege) > t.sieges) { p.table = ''; p.siege = ''; }
        return p;
      });
      writeAll_('Personnes', ps);
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
