/* Dessin des tables et de la salle — partagé par le site (index.html) et l'Espace mariés (admin.html) */
(function () {
  const C = {
    top: '#efe3d0', ring: '#c8ab86', edge: '#9c7650', chair: '#fdfbf8', chairEdge: '#8a6a4c',
    on: '#7a5a3e', me: '#c9a15c', ink: '#34241a', sub: '#9c7650', plate: '#ffffff', plateEdge: '#d8c8b2'
  };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const f1 = n => Math.round(n * 10) / 10;

  const FORMES = { ronde: 'Ronde', rect: 'Rectangulaire', honneur: "Table d'honneur" };

  function dims(t) {
    const n = Math.max(1, Number(t.sieges) || 1), f = FORMES[t.forme] ? t.forme : 'ronde';
    if (f === 'ronde') { const r = Math.max(36, n * 6.6); return { f, n, r, W: (r + 36) * 2, H: (r + 36) * 2 }; }
    if (f === 'honneur') { const w = Math.max(160, n * 36 + 24), h = 56; return { f, n, w, h, W: w + 16, H: h + 2 * 38 }; }
    const per = Math.ceil(n / 2), w = Math.max(130, per * 36 + 24), h = 70; return { f, n, w, h, W: w + 16, H: h + 2 * 38 };
  }

  function seats(d) {
    const out = [];
    if (d.f === 'ronde') {
      for (let i = 0; i < d.n; i++) {
        const a = -Math.PI / 2 + i / d.n * Math.PI * 2;
        out.push({ x: Math.cos(a) * (d.r + 19), y: Math.sin(a) * (d.r + 19), rot: a * 180 / Math.PI + 90, px: Math.cos(a) * (d.r - 10), py: Math.sin(a) * (d.r - 10) });
      }
    } else {
      const top = d.f === 'honneur' ? d.n : Math.ceil(d.n / 2), bot = d.n - top;
      const st = (d.w - 24) / top;
      for (let i = 0; i < top; i++) { const x = -d.w / 2 + 12 + st * (i + .5); out.push({ x, y: -d.h / 2 - 17, rot: 0, px: x, py: -d.h / 2 + 11 }); }
      const sb = (d.w - 24) / Math.max(1, bot);
      for (let i = 0; i < bot; i++) { const x = -d.w / 2 + 12 + sb * (i + .5); out.push({ x, y: d.h / 2 + 17, rot: 180, px: x, py: d.h / 2 - 11 }); }
    }
    return out;
  }

  /* t : table · o.occ : Map(siège → {ini, state:'on'|'me'}) · o.hl : surbrillance · o.count : texte sous le nom */
  function table(t, o) {
    o = o || {};
    const d = dims(t), occ = o.occ || new Map();
    let s = '';
    if (o.hl) {
      s += d.f === 'ronde'
        ? `<circle class="pd-glow" r="${f1(d.r + 44)}" fill="${C.me}" opacity=".28"/>`
        : `<rect class="pd-glow" x="${f1(-d.w / 2 - 34)}" y="${f1(-d.h / 2 - 44)}" width="${f1(d.w + 68)}" height="${f1(d.h + 88)}" rx="30" fill="${C.me}" opacity=".28"/>`;
    }
    seats(d).forEach((p, i) => {
      const st = occ.get(i + 1), fill = st ? (st.state === 'me' ? C.me : C.on) : C.chair, line = st ? fill : C.chairEdge;
      s += `<g class="pd-ch" data-s="${i + 1}"><g transform="translate(${f1(p.x)} ${f1(p.y)}) rotate(${f1(p.rot)})">` +
        `<path d="M-12 -12 Q0 -21 12 -12" fill="none" stroke="${st ? fill : C.chairEdge}" stroke-width="4.5" stroke-linecap="round"/>` +
        `<rect x="-11" y="-10" width="22" height="20" rx="7" fill="${fill}" stroke="${line}" stroke-width="1.2"/></g>` +
        (st && st.ini ? `<text x="${f1(p.x)}" y="${f1(p.y + 4)}" text-anchor="middle" font-family="Jost,system-ui,sans-serif" font-size="10" font-weight="500" fill="#fff">${esc(st.ini)}</text>` : '') + `</g>`;
    });
    if (d.f === 'ronde') {
      s += `<circle r="${f1(d.r)}" fill="${o.hl ? '#f3dfb0' : C.top}" stroke="${C.edge}" stroke-width="1.6"/><circle r="${f1(d.r - 5)}" fill="none" stroke="${C.ring}" stroke-width=".8"/>`;
    } else {
      s += `<rect x="${f1(-d.w / 2)}" y="${f1(-d.h / 2)}" width="${f1(d.w)}" height="${f1(d.h)}" rx="8" fill="${o.hl ? '#f3dfb0' : C.top}" stroke="${C.edge}" stroke-width="1.6"/>` +
        `<rect x="${f1(-d.w / 2 + 5)}" y="${f1(-d.h / 2 + 5)}" width="${f1(d.w - 10)}" height="${f1(d.h - 10)}" rx="5" fill="none" stroke="${C.ring}" stroke-width=".8"/>`;
    }
    seats(d).forEach(p => { s += `<circle cx="${f1(p.px)}" cy="${f1(p.py)}" r="5.5" fill="${C.plate}" stroke="${C.plateEdge}" stroke-width=".8"/>`; });
    if (o.label !== false) {
      const room = d.f === 'ronde' ? d.r * 1.5 : d.w - 40;
      const fs = Math.max(11, Math.min(20, room / Math.max(4, String(t.nom).length) * 1.7));
      const yy = o.count ? -2 : fs * .35;
      s += `<text y="${f1(yy)}" text-anchor="middle" font-family="'Bodoni Moda',Didot,Georgia,serif" font-size="${f1(fs)}" fill="${C.ink}">${esc(t.nom)}</text>`;
      if (o.count) s += `<text y="${f1(yy + 15)}" text-anchor="middle" font-family="Jost,system-ui,sans-serif" font-size="10" letter-spacing="1.5" fill="${C.sub}">${esc(o.count)}</text>`;
    }
    return { svg: s, W: d.W, H: d.H, d };
  }

  const DECOR = {
    piste: { label: 'Piste de danse', w: 280, h: 200 },
    buffet: { label: 'Buffet', w: 260, h: 60 },
    bar: { label: 'Bar', w: 200, h: 60 },
    dj: { label: 'DJ', w: 120, h: 80 },
    scene: { label: 'Scène', w: 320, h: 110 },
    gateau: { label: 'Gâteau', w: 80, h: 80, round: true },
    photo: { label: 'Photobooth', w: 130, h: 110 },
    entree: { label: 'Entrée', w: 140, h: 26 },
    cadeaux: { label: 'Cadeaux', w: 110, h: 70 },
    texte: { label: 'Texte', w: 160, h: 40, bare: true }
  };
  function decor(dc) {
    const def = DECOR[dc.type] || DECOR.texte, w = Number(dc.w) || def.w, h = Number(dc.h) || def.h;
    let s = '';
    if (def.bare) s += `<rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" fill="transparent"/>`;
    else if (def.round) s += `<circle r="${Math.min(w, h) / 2}" fill="#fdfbf8" stroke="${C.edge}" stroke-width="1.4"/>`;
    else if (dc.type === 'piste') {
      s += `<rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="6" fill="url(#pd-checker)" stroke="${C.edge}" stroke-width="1.4"/>`;
    } else if (dc.type === 'entree') {
      s += `<rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" fill="#fdfbf8" stroke="${C.edge}" stroke-width="1.4" stroke-dasharray="6 4"/>`;
    } else s += `<rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="6" fill="#fdfbf8" stroke="${C.edge}" stroke-width="1.4"/>`;
    const fs = def.bare ? Math.min(28, h * .6) : Math.max(10, Math.min(15, h * .32, w / Math.max(4, String(dc.label || def.label).length) * 1.6));
    s += `<text y="${f1(fs * .35)}" text-anchor="middle" font-family="${def.bare ? "'Mrs Saint Delafield',cursive" : 'Jost,system-ui,sans-serif'}" font-size="${def.bare ? f1(fs * 1.4) : f1(fs)}" ${def.bare ? '' : 'letter-spacing="2"'} font-weight="500" fill="${C.ink}">${esc(def.bare ? (dc.label || def.label) : String(dc.label || def.label).toUpperCase())}</text>`;
    return s;
  }
  const defs = `<defs><pattern id="pd-checker" width="24" height="24" patternUnits="userSpaceOnUse"><rect width="24" height="24" fill="#f6efe4"/><rect width="12" height="12" fill="#e9dcc8"/><rect x="12" y="12" width="12" height="12" fill="#e9dcc8"/></pattern></defs>`;

  function strokePath(st) {
    const p = st.p || []; if (p.length < 2) return '';
    let d = 'M' + p[0] + ' ' + p[1];
    for (let i = 2; i < p.length; i += 2) d += 'L' + p[i] + ' ' + p[i + 1];
    if (p.length === 2) d += 'l.1 0';
    return d;
  }

  /* bornes de tout le plan (pour cadrer la vue des invités) */
  function bounds(tables, salle) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const add = (x, y, w, h) => { x0 = Math.min(x0, x - w / 2); y0 = Math.min(y0, y - h / 2); x1 = Math.max(x1, x + w / 2); y1 = Math.max(y1, y + h / 2); };
    tables.forEach(t => { if (t.x === '' || t.x == null) return; const d = dims(t), m = Math.max(d.W, d.H); add(+t.x, +t.y, m, m); });
    (salle && salle.decor || []).forEach(dc => { const def = DECOR[dc.type] || DECOR.texte; const m = Math.max(+dc.w || def.w, +dc.h || def.h); add(+dc.x, +dc.y, m, m); });
    (salle && salle.strokes || []).forEach(st => { for (let i = 0; i < st.p.length; i += 2) add(st.p[i], st.p[i + 1], 0, 0); });
    return isFinite(x0) ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : null;
  }

  window.PlanDraw = { C, FORMES, DECOR, dims, seats, table, decor, defs, strokePath, bounds, esc };
})();
