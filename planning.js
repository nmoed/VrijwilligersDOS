'use strict';

/* ============================================================
   GEDEELDE CONSTANTEN (zelfde als app.js)
   ============================================================ */

const OPSLAG_SLEUTEL  = 'dos_vrijwilligers_v1';   // ← zelfde key = zelfde data
const BARDIENST_BONUS = 30;

const TAAK_TYPES = {
  bardienst:  { label: 'Bardienst',              kleur: '#2980b9', max: 2  },
  schoonmaak: { label: 'Grote schoonmaak',        kleur: '#8e44ad', max: 20 },
  opbouw:     { label: 'Op-/afbouw zaal',         kleur: '#e67e22', max: 10 },
  medailles:  { label: 'Medailles uitreiken',     kleur: '#c0392b', max: 5  },
  muziek:     { label: 'Muziek draaien',          kleur: '#16a085', max: 2  },
  omroeper:   { label: 'Spreker / omroeper',      kleur: '#d35400', max: 2  },
  intekenen:  { label: 'Intekenen deelnemers',    kleur: '#27ae60', max: 5  },
  scores:     { label: 'Scores en diploma\'s',    kleur: '#2c3e50', max: 5  },
};

/* ============================================================
   DATA (gedeeld via localStorage met de beheerder-app)
   ============================================================ */

function laadData() {
  try {
    const raw = localStorage.getItem(OPSLAG_SLEUTEL);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* corrupt */ }
  return { leden: [], taken: [] };
}

function slaData(data) {
  try {
    localStorage.setItem(OPSLAG_SLEUTEL, JSON.stringify(data));
  } catch (e) {
    toonMelding('Opslaan mislukt – controleer je browserinstellingen.', 'fout');
  }
}

/* ============================================================
   HULPFUNCTIES
   ============================================================ */

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function datum(str) {
  if (!str) return '—';
  try { return new Date(str + 'T00:00:00').toLocaleDateString('nl-NL'); }
  catch { return str; }
}

function getLid(id, leden) {
  return leden?.find(l => l.id === id);
}

function vandaag() {
  return new Date().toISOString().slice(0, 10);
}

/* ============================================================
   PLANNING RENDEREN (ledenweergave)
   ============================================================ */

function renderPlanning() {
  const { leden, taken } = laadData();
  const container = document.getElementById('planning-inhoud');
  const nu = new Date(); nu.setHours(0, 0, 0, 0);

  if (leden.length === 0 && taken.length === 0) {
    container.innerHTML = `
      <div id="geen-data">
        <div class="leeg-icoon">📋</div>
        <h3>Nog geen taken beschikbaar</h3>
        <p>De beheerder heeft nog geen taken aangemaakt.<br>Kom later terug!</p>
      </div>`;
    return;
  }

  // Alleen toekomstige + vandaag (voor leden verborgen wij verleden standaard)
  // Maar wel optie om alles te zien
  const urlParams      = new URLSearchParams(window.location.search);
  const toonVerleden   = urlParams.get('verleden') === '1';

  const gefilterdeT = taken.filter(t =>
    toonVerleden || !t.datum || new Date(t.datum + 'T00:00:00') >= nu
  ).sort((a, b) => {
    if (!a.datum && !b.datum) return 0;
    if (!a.datum) return 1;
    if (!b.datum) return -1;
    return new Date(a.datum) - new Date(b.datum);
  });

  const totaalOpenPlekken = gefilterdeT.reduce((s, t) => {
    const max = t.maxDeelnemers || TAAK_TYPES[t.type]?.max || 2;
    return s + Math.max(0, max - (t.deelnemers || []).length);
  }, 0);
  const takenMetPlek = gefilterdeT.filter(t => {
    const max = t.maxDeelnemers || TAAK_TYPES[t.type]?.max || 2;
    return (t.deelnemers || []).length < max;
  }).length;

  // Groepeer op datum
  const groepen = new Map();
  gefilterdeT.forEach(taak => {
    const sleutel = taak.datum || '__geen_datum__';
    if (!groepen.has(sleutel)) groepen.set(sleutel, []);
    groepen.get(sleutel).push(taak);
  });

  let groepenHTML = '';
  groepen.forEach((taakLijst, sleutel) => {
    const isGeenDatum = sleutel === '__geen_datum__';
    const taakDatum   = isGeenDatum ? null : new Date(sleutel + 'T00:00:00');
    const isVandaag   = !isGeenDatum && taakDatum.toDateString() === nu.toDateString();
    const isBinnenkort = !isGeenDatum && !isVandaag &&
                         (taakDatum - nu) / 86400000 <= 14;

    let pill = '';
    if (isVandaag)     pill = '<span class="plan-datum-pill vandaag">Vandaag</span>';
    else if (isBinnenkort) pill = '<span class="plan-datum-pill binnenkort">Binnenkort</span>';

    const datumTekst = isGeenDatum
      ? 'Datum nog niet bekend'
      : new Date(sleutel + 'T00:00:00').toLocaleDateString('nl-NL', {
          weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
        });

    groepenHTML += `
    <div class="plan-datum-groep">
      <div class="plan-datum-header">
        <span class="plan-datum-label">${datumTekst}</span>
        ${pill}
      </div>
      <div class="plan-grid">
        ${taakLijst.map(t => renderLidPlanKaart(t, leden)).join('')}
      </div>
    </div>`;
  });

  const oudeLinkTekst = toonVerleden
    ? `<a href="planning.html" style="font-size:.83rem;color:var(--tekst-zacht)">
         ← Verberg verleden taken
       </a>`
    : `<a href="planning.html?verleden=1" style="font-size:.83rem;color:var(--tekst-zacht)">
         Toon ook verleden taken
       </a>`;

  container.innerHTML = `
    <div class="welkom-kaart">
      <h2>👋 Welkom bij D.O.S. vrijwilligerstaken!</h2>
      <p>Ieder lid vervult per seizoen <strong>1 clubtaak</strong>.
         Schrijf jezelf (of je kind) hieronder in voor een beschikbare taak.</p>
      <div class="welkom-regel">📌 Wie niet helpt, betaalt €30 per seizoen.</div>
      <div class="welkom-regel">🍺 Extra bardiensten leveren €30 terug op.</div>
    </div>

    <div class="lid-koptekst">
      <div>
        ${totaalOpenPlekken > 0
          ? `<div class="alert info" style="margin-bottom:0">
               Er zijn nog <strong>${totaalOpenPlekken} open plekken</strong>
               verspreid over <strong>${takenMetPlek} taken</strong>.
             </div>`
          : `<div class="alert succes" style="margin-bottom:0">
               ✅ Alle taken zijn op dit moment vol.
             </div>`}
      </div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        ${oudeLinkTekst}
        <button class="knop klein secundair" onclick="renderPlanning()">↻ Ververs</button>
      </div>
    </div>

    ${gefilterdeT.length === 0 ? `
    <div class="leeg-staat">
      <div class="leeg-icoon">🗓️</div>
      <h3>Geen aankomende taken</h3>
      <p>Er zijn op dit moment geen openstaande taken.<br>Kom later terug!</p>
    </div>
    ` : groepenHTML}
  `;
}

function renderLidPlanKaart(taak, leden) {
  const type       = TAAK_TYPES[taak.type] || { label: taak.type, kleur: '#666', max: 99 };
  const max        = taak.maxDeelnemers || type.max;
  const deelnemers = (taak.deelnemers || []).map(id => getLid(id, leden)).filter(Boolean);
  const n          = deelnemers.length;
  const vol        = n >= max;
  const openPlekken = Math.max(0, max - n);
  const pct        = max > 0 ? Math.min(100, Math.round(n / max * 100)) : 0;

  const openPlekHTML = Array.from({ length: openPlekken }, () =>
    `<li class="plan-open-plek">Open plek…</li>`
  ).join('');

  return `
  <div class="plan-kaart ${vol ? 'vol' : ''}">
    <div class="plan-kaart-koptekst">
      <div>
        <span class="type-badge" style="background:${type.kleur}">${type.label}</span>
        <h3 class="plan-taak-naam">${esc(taak.naam || type.label)}</h3>
      </div>
      ${taak.datum
        ? `<button class="knop klein secundair" onclick="downloadICS('${taak.id}')"
                   title="Voeg toe aan agenda">📅 Agenda</button>`
        : ''}
    </div>

    <div class="plan-bezet">
      <div class="voortgang-balk" style="flex:1;margin:0">
        <div class="voortgang-balk-vulling${vol ? ' vol' : pct >= 80 ? ' bijna' : ''}"
             style="width:${pct}%"></div>
      </div>
      <strong>${n}</strong>&nbsp;/&nbsp;${max} plaatsen bezet
    </div>

    ${taak.beschrijving ? `<p class="taak-beschrijving">${esc(taak.beschrijving)}</p>` : ''}

    ${n > 0 || openPlekken > 0 ? `
    <ul class="plan-deelnemers-lijst">
      ${deelnemers.map(lid => `
      <li class="plan-deelnemer-item">
        <span>✓ ${esc(lid.naam)}</span>
        <button class="plan-uitschrijven-knop"
                onclick="uitschrijvenLidBevestig('${taak.id}','${lid.id}')"
                title="Uitschrijven">✕ Uitschrijven</button>
      </li>`).join('')}
      ${openPlekHTML}
    </ul>
    ` : `<p class="plan-geen-deelnemers">Nog niemand ingeschreven</p>`}

    <div>
      ${vol
        ? `<span class="plan-vol-label">🔒 Vol (${n}/${max})</span>`
        : `<button class="knop primair klein" onclick="toonInschrijfVenster('${taak.id}')">
             + Inschrijven
           </button>`}
    </div>
  </div>`;
}

/* ============================================================
   INSCHRIJVEN (met autocomplete)
   ============================================================ */

function toonInschrijfVenster(taakId) {
  const { leden, taken } = laadData();
  const taak = taken.find(t => t.id === taakId);
  if (!taak) return;

  const type = TAAK_TYPES[taak.type] || { label: taak.type, max: 99 };
  const max  = taak.maxDeelnemers || type.max;
  const n    = (taak.deelnemers || []).length;

  if (n >= max) { toonMelding('Deze taak is al vol', 'waarschuwing'); return; }

  const html = `
    <p class="inschrijf-uitleg">
      Zoek het lid van D.O.S. voor wie je je inschrijft (dit kan ook je kind zijn)
    </p>
    <div class="formulier-veld" style="margin-bottom:4px">
      <input type="search" id="lid-zoek" class="zoek-invoer" style="width:100%"
             placeholder="Begin met typen om een lid te zoeken..."
             oninput="updateLidSuggesties('${taakId}', this.value)"
             autocomplete="off" spellcheck="false">
    </div>
    <div id="lid-suggesties">
      <div class="suggestie-hint">Typ minimaal 1 letter om leden te zoeken</div>
    </div>
  `;

  toonModal(
    `Inschrijven: ${esc(taak.naam || type.label)}`,
    html,
    [{ label: 'Annuleren', klasse: 'secundair', actie: 'sluitModal()' }]
  );

  setTimeout(() => document.getElementById('lid-zoek')?.focus(), 80);
}

function updateLidSuggesties(taakId, zoek) {
  const { leden, taken } = laadData();
  const taak = taken.find(t => t.id === taakId);
  if (!taak) return;

  const al   = taak.deelnemers || [];
  const cont = document.getElementById('lid-suggesties');
  if (!cont) return;

  const q = zoek.trim();
  if (!q) {
    cont.innerHTML = '<div class="suggestie-hint">Typ minimaal 1 letter om leden te zoeken</div>';
    return;
  }

  const matches = leden
    .filter(l => !al.includes(l.id) && l.naam.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => {
      const aS = a.naam.toLowerCase().startsWith(q.toLowerCase());
      const bS = b.naam.toLowerCase().startsWith(q.toLowerCase());
      if (aS && !bS) return -1;
      if (!aS && bS) return  1;
      return a.naam.localeCompare(b.naam);
    })
    .slice(0, 10);

  if (matches.length === 0) {
    cont.innerHTML = `<div class="suggestie-leeg">
      Geen leden gevonden voor "<strong>${esc(q)}</strong>".<br>
      <small>Controleer de spelling of vraag de beheerder om je toe te voegen.</small>
    </div>`;
    return;
  }

  cont.innerHTML = `
    <div class="suggesties-lijst">
      ${matches.map(l => `
      <div class="suggestie-item" tabindex="0"
           onclick="inschrijvenLid('${taakId}','${l.id}')"
           onkeydown="if(event.key==='Enter')inschrijvenLid('${taakId}','${l.id}')">
        <span class="suggestie-naam">${esc(l.naam)}</span>
        ${l.email ? `<span class="suggestie-email">${esc(l.email)}</span>` : ''}
      </div>`).join('')}
    </div>
    ${leden.filter(l => !al.includes(l.id)).length > matches.length
      ? `<div class="suggestie-hint">Typ meer letters om verder te verfijnen</div>` : ''}
  `;
}

function inschrijvenLid(taakId, lidId) {
  const data = laadData();
  const taak = data.taken.find(t => t.id === taakId);
  const lid  = data.leden.find(l => l.id === lidId);
  if (!taak || !lid) return;

  const max = taak.maxDeelnemers || TAAK_TYPES[taak.type]?.max || 2;
  if ((taak.deelnemers || []).includes(lidId)) {
    toonMelding(`${lid.naam} staat al ingeschreven`, 'info'); return;
  }
  if ((taak.deelnemers || []).length >= max) {
    toonMelding('Deze taak is helaas al vol', 'waarschuwing'); return;
  }

  if (!taak.deelnemers) taak.deelnemers = [];
  taak.deelnemers.push(lidId);

  slaData(data);
  sluitModal();
  toonMelding(`✓ ${lid.naam} is ingeschreven!`, 'succes');
  renderPlanning();
}

function uitschrijvenLid(taakId, lidId) {
  const data = laadData();
  const taak = data.taken.find(t => t.id === taakId);
  const lid  = data.leden.find(l => l.id === lidId);
  if (!taak) return;

  taak.deelnemers = (taak.deelnemers || []).filter(d => d !== lidId);
  slaData(data);
  toonMelding(`${lid ? lid.naam : 'Lid'} is uitgeschreven`, 'info');
  renderPlanning();
}

function uitschrijvenLidBevestig(taakId, lidId) {
  const { leden } = laadData();
  const lid = leden.find(l => l.id === lidId);
  bevestigVerwijder(
    'Uitschrijven',
    `Wil je <strong>${esc(lid?.naam || 'dit lid')}</strong> uitschrijven voor deze taak?`,
    () => uitschrijvenLid(taakId, lidId),
    'Uitschrijven'
  );
}

/* ============================================================
   ICS AGENDA-BESTAND
   ============================================================ */

function downloadICS(taakId) {
  const { taken } = laadData();
  const taak = taken.find(t => t.id === taakId);
  if (!taak) return;

  const type    = TAAK_TYPES[taak.type] || { label: taak.type };
  const naam    = taak.naam || type.label;
  const dtstamp = new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z';

  let dtStart, dtEnd;
  if (taak.datum) {
    const d     = taak.datum.replace(/-/g, '');
    const einde = new Date(taak.datum + 'T00:00:00');
    einde.setDate(einde.getDate() + 1);
    const dEnd  = einde.toISOString().slice(0, 10).replace(/-/g, '');
    dtStart = `DTSTART;VALUE=DATE:${d}`;
    dtEnd   = `DTEND;VALUE=DATE:${dEnd}`;
  } else {
    const morgen = new Date(); morgen.setDate(morgen.getDate() + 1);
    const d    = morgen.toISOString().slice(0, 10).replace(/-/g, '');
    const d1   = new Date(morgen); d1.setDate(d1.getDate() + 1);
    const dEnd = d1.toISOString().slice(0, 10).replace(/-/g, '');
    dtStart = `DTSTART;VALUE=DATE:${d}`;
    dtEnd   = `DTEND;VALUE=DATE:${dEnd}`;
  }

  const beschr = `Vrijwilligerstaak bij turnclub D.O.S.\\nTaak: ${naam}\\nType: ${type.label}`
    + (taak.beschrijving ? `\\n${taak.beschrijving}` : '');

  const icsInhoud = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//D.O.S. Vrijwilligersbeheer//NL',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:dos-${taak.id}@dos-vrijwilligers.nl`,
    `DTSTAMP:${dtstamp}`,
    dtStart,
    dtEnd,
    `SUMMARY:D.O.S. \u2013 ${naam}`,
    `DESCRIPTION:${beschr}`,
    'LOCATION:D.O.S. sporthal',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  const blob = new Blob([icsInhoud], { type: 'text/calendar;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `dos-${naam.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${taak.datum || 'nvt'}.ics`;
  a.click();
  URL.revokeObjectURL(url);
  toonMelding('📅 Agenda-bestand gedownload!', 'succes');
}

/* ============================================================
   MODAL
   ============================================================ */

function toonModal(titel, inhoud, knoppen) {
  document.getElementById('modal-titel').textContent = titel;
  document.getElementById('modal-inhoud').innerHTML  = inhoud;

  const footer = document.getElementById('modal-voettekst');
  footer.innerHTML = knoppen.map(k =>
    `<button class="knop ${k.klasse || 'primair'}" onclick="${k.actie}">${k.label}</button>`
  ).join('');

  document.getElementById('modal-overlay').classList.remove('verborgen');
  setTimeout(() => {
    const first = document.querySelector('#modal-inhoud input:not([type=checkbox])');
    if (first) first.focus();
  }, 80);
}

function sluitModal() {
  document.getElementById('modal-overlay').classList.add('verborgen');
}

function sluitModalOpOverlay(e) {
  if (e.target === document.getElementById('modal-overlay')) sluitModal();
}

/* ============================================================
   BEVESTIGINGSDIALOOG
   ============================================================ */

let _bevestigCallback = null;

function bevestigVerwijder(titel, tekst, callback, knopLabel) {
  _bevestigCallback = callback;
  document.getElementById('bevestig-titel').textContent = titel;
  document.getElementById('bevestig-tekst').innerHTML   = tekst;
  const knop = document.getElementById('bevestig-knop');
  knop.textContent = knopLabel || 'Bevestigen';
  knop.className   = 'knop gevaar';
  document.getElementById('bevestig-overlay').classList.remove('verborgen');
}

function bevestigOK() {
  document.getElementById('bevestig-overlay').classList.add('verborgen');
  if (_bevestigCallback) { _bevestigCallback(); _bevestigCallback = null; }
}

function bevestigAnnuleer() {
  document.getElementById('bevestig-overlay').classList.add('verborgen');
  _bevestigCallback = null;
}

/* ============================================================
   TOAST MELDINGEN
   ============================================================ */

function toonMelding(bericht, type) {
  type = type || 'info';
  const icons = { succes: '✅', fout: '❌', waarschuwing: '⚠️', info: 'ℹ️' };
  const container = document.getElementById('toast-container');
  const toast     = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${bericht}</span>`;
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('zichtbaar'));
  setTimeout(() => {
    toast.classList.remove('zichtbaar');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

/* ============================================================
   AUTO-VERVERS (als beheerder iets wijzigt in een ander tabblad)
   ============================================================ */

window.addEventListener('storage', e => {
  if (e.key === OPSLAG_SLEUTEL) {
    renderPlanning();
    toonMelding('Planning bijgewerkt', 'info');
  }
});

/* ============================================================
   TOETSENBORD
   ============================================================ */

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { sluitModal(); bevestigAnnuleer(); }
});

/* ============================================================
   INITIALISATIE
   ============================================================ */

document.getElementById('bevestig-knop').addEventListener('click', bevestigOK);

document.addEventListener('DOMContentLoaded', () => {
  renderPlanning();
});
