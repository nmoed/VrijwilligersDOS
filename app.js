'use strict';

/* ============================================================
   CONFIGURATIE
   ============================================================ */

const OPSLAG_SLEUTEL   = 'dos_vrijwilligers_v1';
const BOETE            = 30;
const BARDIENST_BONUS  = 30;

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
   DATA OPSLAG
   ============================================================ */

function laadData() {
  try {
    const raw = localStorage.getItem(OPSLAG_SLEUTEL);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* corrupt data */ }
  return { leden: [], taken: [] };
}

function slaData(data) {
  try {
    localStorage.setItem(OPSLAG_SLEUTEL, JSON.stringify(data));
  } catch (e) {
    toonMelding('Fout bij opslaan! Controleer je browserinstellingen.', 'fout');
  }
}

function nieuwId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/* ============================================================
   BEREKENINGEN
   ============================================================ */

/**
 * Geeft de status en bardienstinfo van een lid terug.
 * - heeftTaak  : heeft minstens 1 voltooide taak (inclusief bardienst)
 * - bars       : aantal voltooide bardiensten
 * - extra      : bars - 1  (eerste is verplicht, de rest levert €30 op)
 * - teOntvangen: netto nog niet uitbetaald bedrag
 * - status     : 'taak' | 'betaald' | 'niets'
 */
function getLidStatus(lid, taken) {
  const gedaan    = taken.filter(t => t.uitgevoerd && (t.deelnemers || []).includes(lid.id));
  const bars      = gedaan.filter(t => t.type === 'bardienst').length;
  const heeftTaak = gedaan.length > 0;
  const extra     = Math.max(0, bars - 1);
  const teOntvangen = Math.max(0, extra * BARDIENST_BONUS - (lid.uitbetaald || 0) * BARDIENST_BONUS);

  let status;
  if (heeftTaak)      status = 'taak';
  else if (lid.betaald) status = 'betaald';
  else                  status = 'niets';

  return { heeftTaak, bars, extra, teOntvangen, status };
}

function getDashboardStats() {
  const { leden, taken } = laadData();
  let taak = 0, betaald = 0, niets = 0, extraTotaal = 0, uitTeKeren = 0;

  leden.forEach(l => {
    const s = getLidStatus(l, taken);
    if      (s.status === 'taak')    taak++;
    else if (s.status === 'betaald') betaald++;
    else                             niets++;
    extraTotaal += s.extra;
    uitTeKeren  += s.teOntvangen;
  });

  return {
    totaal: leden.length,
    taak, betaald, niets,
    opbrengst: betaald * BOETE,
    extraTotaal, uitTeKeren,
  };
}

/* ============================================================
   HULPFUNCTIES
   ============================================================ */

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function datum(str) {
  if (!str) return '—';
  try { return new Date(str + 'T00:00:00').toLocaleDateString('nl-NL'); }
  catch { return str; }
}

function euro(bedrag) {
  return '€\u202F' + Number(bedrag).toFixed(0);
}

function vandaag() {
  return new Date().toISOString().slice(0, 10);
}

function getLid(id, leden) {
  return leden?.find(l => l.id === id);
}

function statusLabel(s) {
  return { taak: 'Taak gedaan', betaald: 'Heeft betaald', niets: 'Nog niets' }[s] || s;
}

/* ============================================================
   NAVIGATIE
   ============================================================ */

let huidigePagina = 'dashboard';

function naarPagina(pagina) {
  document.querySelectorAll('.pagina').forEach(p => p.classList.add('verborgen'));
  document.querySelectorAll('.nav-knop').forEach(b => b.classList.remove('actief'));

  const el  = document.getElementById('pagina-' + pagina);
  const btn = document.querySelector(`.nav-knop[data-pagina="${pagina}"]`);
  if (el)  el.classList.remove('verborgen');
  if (btn) btn.classList.add('actief');

  huidigePagina = pagina;
  document.getElementById('nav').classList.remove('open');
  renderPagina(pagina);
}

function renderPagina(pagina) {
  const renders = {
    dashboard: renderDashboard,
    leden:     renderLeden,
    taken:     renderTaken,
    bardienst: renderBardienst,
    maillijst: renderMaillijst,
    export:    renderExport,
  };
  if (renders[pagina]) renders[pagina]();
}

/* ============================================================
   DASHBOARD
   ============================================================ */

function renderDashboard() {
  const s  = getDashboardStats();
  const el = document.getElementById('pagina-dashboard');
  const procTaak    = s.totaal ? Math.round(s.taak    / s.totaal * 100) : 0;
  const procBetaald = s.totaal ? Math.round(s.betaald / s.totaal * 100) : 0;

  el.innerHTML = `
    <div class="pagina-koptekst">
      <div>
        <h2>📊 Dashboard</h2>
        <p>Live overzicht vrijwilligerswerk seizoen D.O.S.</p>
      </div>
    </div>

    <div class="stat-grid">
      <div class="stat-kaart">
        <div class="stat-getal">${s.totaal}</div>
        <div class="stat-label">Totaal leden</div>
      </div>
      <div class="stat-kaart taak">
        <div class="stat-getal">${s.taak}</div>
        <div class="stat-label">Taak gedaan</div>
      </div>
      <div class="stat-kaart betaald">
        <div class="stat-getal">${s.betaald}</div>
        <div class="stat-label">Heeft €${BOETE} betaald</div>
      </div>
      <div class="stat-kaart niets">
        <div class="stat-getal">${s.niets}</div>
        <div class="stat-label">Nog niets gedaan</div>
      </div>
      <div class="stat-kaart opbrengst">
        <div class="stat-getal">${euro(s.opbrengst)}</div>
        <div class="stat-label">Opbrengst vrijwilligersbijdragen</div>
      </div>
      <div class="stat-kaart bardienst">
        <div class="stat-getal">${s.extraTotaal}</div>
        <div class="stat-label">Extra bardiensten totaal</div>
      </div>
      <div class="stat-kaart uitbetalen">
        <div class="stat-getal">${euro(s.uitTeKeren)}</div>
        <div class="stat-label">Nog uit te keren aan leden</div>
      </div>
    </div>

    ${s.totaal > 0 ? `
    <div class="kaart" style="margin-bottom:16px">
      <div class="kaart-koptekst"><h3>Voortgang seizoen</h3></div>
      <div class="kaart-inhoud">
        <div style="margin-bottom:10px">
          <div style="display:flex;justify-content:space-between;font-size:.85rem;margin-bottom:4px">
            <span>Taak gedaan <strong>${s.taak}</strong></span><span>${procTaak}%</span>
          </div>
          <div class="voortgang-balk">
            <div class="voortgang-balk-vulling${procTaak >= 80 ? '' : procTaak >= 50 ? ' bijna' : ''}"
              style="width:${procTaak}%"></div>
          </div>
        </div>
        <div>
          <div style="display:flex;justify-content:space-between;font-size:.85rem;margin-bottom:4px">
            <span>Bijdrage betaald <strong>${s.betaald}</strong></span><span>${procBetaald}%</span>
          </div>
          <div class="voortgang-balk">
            <div class="voortgang-balk-vulling bijna" style="width:${procBetaald}%"></div>
          </div>
        </div>
      </div>
    </div>
    ` : ''}

    ${s.niets > 0 ? `
    <div class="alert waarschuwing">
      <strong>⚠️ ${s.niets} ${s.niets === 1 ? 'lid heeft' : 'leden hebben'}</strong>
      nog geen taak gedaan én nog niet €${BOETE} betaald.
      <button class="knop klein secundair" onclick="naarPagina('maillijst')" style="margin-left:8px">
        Bekijk maillijst →
      </button>
    </div>
    ` : s.totaal > 0 ? `
    <div class="alert succes">
      ✅ <strong>Alle leden</strong> hebben meegedaan of betaald. Goed bezig!
    </div>
    ` : ''}

    ${s.totaal === 0 ? `
    <div class="leeg-staat">
      <div class="leeg-icoon">👥</div>
      <h3>Welkom bij D.O.S. Vrijwilligersbeheer</h3>
      <p>Voeg leden toe of importeer een CSV-bestand om te beginnen.</p>
      <div class="knop-rij" style="justify-content:center">
        <button class="knop primair" onclick="naarPagina('leden')">Ga naar Leden</button>
        <button class="knop secundair" onclick="laadVoorbeeldData()">Demo data laden</button>
      </div>
    </div>
    ` : ''}
  `;
}

/* ============================================================
   LEDEN
   ============================================================ */

let ledenZoek   = '';
let ledenSorteer = 'naam';

function renderLeden() {
  const { leden, taken } = laadData();
  const el = document.getElementById('pagina-leden');

  let lijst = leden.filter(l =>
    !ledenZoek ||
    l.naam.toLowerCase().includes(ledenZoek.toLowerCase()) ||
    (l.email || '').toLowerCase().includes(ledenZoek.toLowerCase())
  );

  lijst.sort((a, b) => {
    if (ledenSorteer === 'naam')   return a.naam.localeCompare(b.naam);
    if (ledenSorteer === 'status') {
      const orde = { taak: 0, betaald: 1, niets: 2 };
      return (orde[getLidStatus(a, taken).status] ?? 9) - (orde[getLidStatus(b, taken).status] ?? 9);
    }
    return 0;
  });

  el.innerHTML = `
    <div class="pagina-koptekst">
      <div>
        <h2>👥 Leden <span class="badge">${leden.length}</span></h2>
      </div>
      <div class="koptekst-acties">
        <button class="knop primair" onclick="toonLidForm()">+ Lid toevoegen</button>
        <button class="knop secundair" onclick="document.getElementById('csv-invoer').click()">
          ↑ CSV importeren
        </button>
        <input type="file" id="csv-invoer" accept=".csv,.txt" style="display:none"
               onchange="importeerCSV(this)">
      </div>
    </div>

    <div class="import-hulp">
      💡 <strong>CSV importeren:</strong> gebruik kolommen
      <code>naam</code>, <code>email</code>, <code>telefoon</code>
      (comma of puntkomma als scheidingsteken).
    </div>

    <div class="filter-balk">
      <input type="search" class="zoek-invoer" placeholder="Zoek op naam of e-mail…"
             value="${esc(ledenZoek)}"
             oninput="ledenZoek=this.value; renderLeden()">
      <select class="sorteer-keuze" onchange="ledenSorteer=this.value; renderLeden()">
        <option value="naam"   ${ledenSorteer==='naam'  ?'selected':''}>Sorteren op naam</option>
        <option value="status" ${ledenSorteer==='status'?'selected':''}>Sorteren op status</option>
      </select>
    </div>

    ${lijst.length === 0 ? `
    <div class="leeg-staat">
      <div class="leeg-icoon">${leden.length === 0 ? '👥' : '🔍'}</div>
      <h3>${leden.length === 0 ? 'Nog geen leden' : 'Geen resultaten'}</h3>
      <p>${leden.length === 0
          ? 'Voeg leden toe of importeer een CSV-bestand.'
          : 'Probeer een andere zoekterm.'}</p>
    </div>
    ` : `
    <div class="tabel-container">
      <table class="tabel">
        <thead>
          <tr>
            <th>Naam</th>
            <th class="verberg-mobiel">E-mail</th>
            <th class="verberg-mobiel">Telefoon</th>
            <th>Status</th>
            <th class="verberg-mobiel">Bardiensten</th>
            <th style="text-align:right">Acties</th>
          </tr>
        </thead>
        <tbody>
          ${lijst.map(lid => {
            const s = getLidStatus(lid, taken);
            return `
            <tr>
              <td><strong>${esc(lid.naam)}</strong></td>
              <td class="verberg-mobiel" style="font-size:.85rem;color:var(--tekst-zacht)">
                ${lid.email ? `<a href="mailto:${esc(lid.email)}">${esc(lid.email)}</a>` : '—'}
              </td>
              <td class="verberg-mobiel" style="font-size:.85rem;color:var(--tekst-zacht)">
                ${esc(lid.telefoon || '—')}
              </td>
              <td><span class="status-badge ${s.status}">${statusLabel(s.status)}</span></td>
              <td class="verberg-mobiel" style="font-size:.85rem">
                ${s.bars > 0 ? `${s.bars}× totaal${s.extra > 0
                  ? ` <span class="badge-klein groen">${s.extra}× extra</span>` : ''}` : '—'}
              </td>
              <td class="acties-cel">
                <button class="knop-icoon" onclick="toonLidForm('${lid.id}')"
                        title="Bewerken">✏️</button>
                <button class="knop-icoon gevaar" onclick="verwijderLidBevestig('${lid.id}')"
                        title="Verwijderen">🗑️</button>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
    `}
  `;
}

function toonLidForm(id) {
  const { leden } = laadData();
  const lid = id ? leden.find(l => l.id === id) : null;

  const html = `
    <form id="lid-form" onsubmit="slaLidOp(event, '${id || ''}')">
      <div class="formulier-veld">
        <label>Naam *</label>
        <input type="text" name="naam" value="${esc(lid?.naam || '')}"
               required placeholder="Voor- en achternaam" autocomplete="off">
      </div>
      <div class="formulier-rij">
        <div class="formulier-veld">
          <label>E-mailadres</label>
          <input type="email" name="email" value="${esc(lid?.email || '')}"
                 placeholder="naam@voorbeeld.nl">
        </div>
        <div class="formulier-veld">
          <label>Telefoon</label>
          <input type="tel" name="telefoon" value="${esc(lid?.telefoon || '')}"
                 placeholder="06-12345678">
        </div>
      </div>
      <div class="formulier-veld checkbox-veld">
        <label>
          <input type="checkbox" name="betaald" ${lid?.betaald ? 'checked' : ''}>
          Heeft €${BOETE} vrijwilligersbijdrage betaald
        </label>
      </div>
      ${id ? `
      <div class="formulier-veld">
        <label>Uitbetaalde extra bardiensten</label>
        <input type="number" name="uitbetaald" value="${lid?.uitbetaald || 0}" min="0" step="1">
        <small>Aantal extra bardiensten waarvoor al €${BARDIENST_BONUS} is terugbetaald</small>
      </div>
      ` : ''}
    </form>
  `;

  toonModal(
    lid ? `✏️ ${lid.naam} bewerken` : '+ Nieuw lid toevoegen',
    html,
    [
      { label: 'Annuleren', klasse: 'secundair', actie: 'sluitModal()' },
      { label: lid ? 'Opslaan' : 'Toevoegen', klasse: 'primair',
        actie: "document.getElementById('lid-form').requestSubmit()" },
    ]
  );
}

function slaLidOp(event, id) {
  event.preventDefault();
  const form = event.target;
  const naam = form.naam.value.trim();
  if (!naam) return;

  const data = laadData();
  const nieuw = {
    naam,
    email:     form.email.value.trim(),
    telefoon:  form.telefoon.value.trim(),
    betaald:   form.betaald.checked,
    uitbetaald: parseInt(form.uitbetaald?.value || '0') || 0,
  };

  if (id) {
    const idx = data.leden.findIndex(l => l.id === id);
    if (idx >= 0) data.leden[idx] = { ...data.leden[idx], ...nieuw };
  } else {
    data.leden.push({ id: nieuwId(), ...nieuw });
  }

  slaData(data);
  sluitModal();
  toonMelding(id ? `${naam} bijgewerkt` : `${naam} toegevoegd`, 'succes');
  renderLeden();
  if (huidigePagina === 'dashboard') renderDashboard();
}

function verwijderLid(id) {
  const data = laadData();
  const lid  = data.leden.find(l => l.id === id);
  if (!lid) return;

  data.leden = data.leden.filter(l => l.id !== id);
  data.taken.forEach(t => {
    t.deelnemers = (t.deelnemers || []).filter(d => d !== id);
    if (t.coordinator === id) t.coordinator = null;
  });

  slaData(data);
  toonMelding(`${lid.naam} verwijderd`, 'info');
  renderLeden();
}

/* ============================================================
   CSV IMPORT
   ============================================================ */

function importeerCSV(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => { verwerkCSV(e.target.result); input.value = ''; };
  reader.readAsText(file, 'UTF-8');
}

function verwerkCSV(tekst) {
  const regels = tekst.trim().split(/\r?\n/).filter(r => r.trim());
  if (regels.length < 2) { toonMelding('CSV-bestand is leeg of ongeldig', 'fout'); return; }

  const sep    = regels[0].includes(';') ? ';' : ',';
  const header = regels[0].split(sep).map(k =>
    k.trim().toLowerCase().replace(/^["']|["']$/g, '').replace(/\s+/g, '')
  );

  const kolNaam  = header.findIndex(k => ['naam','name','voornaam','volledigeNaam'].includes(k));
  const kolEmail = header.findIndex(k => ['email','e-mail','emailadres','mail'].includes(k));
  const kolTel   = header.findIndex(k => ['telefoon','tel','phone','mobiel','gsm'].includes(k));

  const naamKol = kolNaam >= 0 ? kolNaam : 0;

  const data = laadData();
  let toegevoegd = 0, overgeslagen = 0;

  for (let i = 1; i < regels.length; i++) {
    const velden  = parseCSVRegel(regels[i], sep);
    const naam    = (velden[naamKol]   || '').trim().replace(/^["']|["']$/g, '');
    if (!naam) continue;
    const email   = kolEmail >= 0 ? (velden[kolEmail] || '').trim().replace(/^["']|["']$/g, '') : '';
    const tel     = kolTel   >= 0 ? (velden[kolTel]   || '').trim().replace(/^["']|["']$/g, '') : '';

    const bestaatAl = data.leden.some(l =>
      l.naam.toLowerCase() === naam.toLowerCase() &&
      (email === '' || (l.email || '').toLowerCase() === email.toLowerCase())
    );

    if (bestaatAl) { overgeslagen++; continue; }
    data.leden.push({ id: nieuwId(), naam, email, telefoon: tel, betaald: false, uitbetaald: 0 });
    toegevoegd++;
  }

  slaData(data);
  toonMelding(
    `${toegevoegd} leden geïmporteerd${overgeslagen ? `, ${overgeslagen} overgeslagen` : ''}`,
    toegevoegd > 0 ? 'succes' : 'waarschuwing'
  );
  renderLeden();
}

function parseCSVRegel(regel, sep) {
  const velden = [];
  let huidig = '', inQuotes = false;
  for (const c of regel) {
    if (c === '"' || c === "'") { inQuotes = !inQuotes; }
    else if (c === sep && !inQuotes) { velden.push(huidig); huidig = ''; }
    else { huidig += c; }
  }
  velden.push(huidig);
  return velden;
}

/* ============================================================
   TAKEN
   ============================================================ */

let takenStatusFilter = 'alle';
let takenTypeFilter   = 'alle';

function renderTaken() {
  const { leden, taken } = laadData();
  const el = document.getElementById('pagina-taken');

  let lijst = [...taken];
  if (takenStatusFilter === 'gepland')    lijst = lijst.filter(t => !t.uitgevoerd);
  if (takenStatusFilter === 'uitgevoerd') lijst = lijst.filter(t =>  t.uitgevoerd);
  if (takenTypeFilter !== 'alle')         lijst = lijst.filter(t => t.type === takenTypeFilter);

  lijst.sort((a, b) => {
    if (!a.datum && !b.datum) return 0;
    if (!a.datum) return 1;
    if (!b.datum) return -1;
    return new Date(a.datum) - new Date(b.datum);
  });

  el.innerHTML = `
    <div class="pagina-koptekst">
      <div>
        <h2>📋 Taken <span class="badge">${taken.length}</span></h2>
      </div>
      <div class="koptekst-acties">
        <button class="knop primair" onclick="toonTaakForm()">+ Nieuwe taak</button>
      </div>
    </div>

    <div class="filter-balk">
      <div class="filter-tabs">
        <button class="filter-tab ${takenStatusFilter==='alle'     ?'actief':''}"
                onclick="takenStatusFilter='alle'; renderTaken()">Alle</button>
        <button class="filter-tab ${takenStatusFilter==='gepland'  ?'actief':''}"
                onclick="takenStatusFilter='gepland'; renderTaken()">Gepland</button>
        <button class="filter-tab ${takenStatusFilter==='uitgevoerd'?'actief':''}"
                onclick="takenStatusFilter='uitgevoerd'; renderTaken()">Uitgevoerd</button>
      </div>
      <select class="sorteer-keuze" onchange="takenTypeFilter=this.value; renderTaken()">
        <option value="alle">Alle types</option>
        ${Object.entries(TAAK_TYPES).map(([k, v]) =>
          `<option value="${k}" ${takenTypeFilter===k?'selected':''}>${v.label}</option>`
        ).join('')}
      </select>
    </div>

    ${lijst.length === 0 ? `
    <div class="leeg-staat">
      <div class="leeg-icoon">📋</div>
      <h3>${taken.length === 0 ? 'Nog geen taken aangemaakt' : 'Geen taken voor dit filter'}</h3>
      <p>${taken.length === 0 ? 'Maak de eerste taak aan om te beginnen.' : 'Pas het filter aan om meer taken te zien.'}</p>
    </div>
    ` : `
    <div class="taak-grid">
      ${lijst.map(t => renderTaakKaart(t, leden)).join('')}
    </div>
    `}
  `;
}

function renderTaakKaart(taak, leden) {
  const type  = TAAK_TYPES[taak.type] || { label: taak.type, kleur: '#666', max: 99 };
  const coord = taak.coordinator ? getLid(taak.coordinator, leden) : null;
  const n     = (taak.deelnemers || []).length;
  const max   = taak.maxDeelnemers || type.max;
  const vol   = n >= max;
  const pct   = max > 0 ? Math.min(100, Math.round(n / max * 100)) : 0;

  return `
  <div class="taak-kaart ${taak.uitgevoerd ? 'uitgevoerd' : ''}">
    <div class="taak-kaart-koptekst">
      <span class="type-badge" style="background:${type.kleur}">${type.label}</span>
      ${taak.uitgevoerd ? '<span class="badge-klein groen">✓ Uitgevoerd</span>' : ''}
    </div>
    <h3 class="taak-naam">${esc(taak.naam || type.label)}</h3>
    <div class="taak-details">
      <div class="taak-detail">📅 ${datum(taak.datum)}</div>
      ${coord ? `<div class="taak-detail">👤 ${esc(coord.naam)}</div>` : ''}
      <div class="taak-detail ${vol ? 'vol' : ''}">
        👥 ${n} / ${max} deelnemers
        ${vol ? '<span class="badge-klein rood">Vol</span>' : ''}
      </div>
    </div>
    <div class="voortgang-balk" style="margin-top:4px">
      <div class="voortgang-balk-vulling${vol ? ' vol' : pct >= 80 ? ' bijna' : ''}"
           style="width:${pct}%"></div>
    </div>
    ${taak.beschrijving ? `<p class="taak-beschrijving">${esc(taak.beschrijving)}</p>` : ''}
    <div class="taak-acties">
      <button class="knop klein secundair" onclick="toonDeelnemers('${taak.id}')">
        👥 Deelnemers
      </button>
      <button class="knop klein secundair" onclick="toonTaakForm('${taak.id}')">✏️</button>
      <button class="knop klein gevaar" onclick="verwijderTaakBevestig('${taak.id}')">🗑️</button>
    </div>
  </div>`;
}

function toonTaakForm(id, defaultType) {
  const { leden, taken } = laadData();
  const taak  = id ? taken.find(t => t.id === id) : null;
  const selType = taak?.type || defaultType || 'bardienst';
  const typeInfo = TAAK_TYPES[selType] || TAAK_TYPES.bardienst;

  const ledenOpties = [...leden]
    .sort((a, b) => a.naam.localeCompare(b.naam))
    .map(l => `<option value="${l.id}" ${taak?.coordinator===l.id?'selected':''}>${esc(l.naam)}</option>`)
    .join('');

  const html = `
    <form id="taak-form" onsubmit="slaaTaakOp(event, '${id || ''}')">
      <div class="formulier-veld">
        <label>Type taak *</label>
        <select name="type" id="taak-type-keuze" required onchange="updateMaxDeelnemers(this)">
          ${Object.entries(TAAK_TYPES).map(([k, v]) =>
            `<option value="${k}" ${selType===k?'selected':''}>${v.label}</option>`
          ).join('')}
        </select>
      </div>
      <div class="formulier-veld">
        <label>Naam / omschrijving</label>
        <input type="text" name="naam" value="${esc(taak?.naam || '')}"
               placeholder="Bijv. Bardienst week 12">
      </div>
      <div class="formulier-rij">
        <div class="formulier-veld">
          <label>Datum</label>
          <input type="date" name="datum" value="${taak?.datum || ''}">
        </div>
        <div class="formulier-veld">
          <label>Max. deelnemers</label>
          <input type="number" name="maxDeelnemers" id="taak-max" min="1" step="1"
                 value="${taak?.maxDeelnemers || typeInfo.max}">
        </div>
      </div>
      <div class="formulier-veld">
        <label>Coördinator</label>
        <select name="coordinator">
          <option value="">— Geen coördinator —</option>
          ${ledenOpties}
        </select>
      </div>
      <div class="formulier-veld">
        <label>Beschrijving (optioneel)</label>
        <textarea name="beschrijving" rows="2"
                  placeholder="Extra informatie…">${esc(taak?.beschrijving || '')}</textarea>
      </div>
      <div class="formulier-veld checkbox-veld">
        <label>
          <input type="checkbox" name="uitgevoerd" ${taak?.uitgevoerd ? 'checked' : ''}>
          Taak is uitgevoerd
        </label>
      </div>
    </form>
  `;

  toonModal(
    taak ? '✏️ Taak bewerken' : '+ Nieuwe taak aanmaken',
    html,
    [
      { label: 'Annuleren', klasse: 'secundair', actie: 'sluitModal()' },
      { label: taak ? 'Opslaan' : 'Aanmaken', klasse: 'primair',
        actie: "document.getElementById('taak-form').requestSubmit()" },
    ]
  );
}

function updateMaxDeelnemers(select) {
  const type = TAAK_TYPES[select.value];
  const el   = document.getElementById('taak-max');
  if (type && el) el.value = type.max;
}

function slaaTaakOp(event, id) {
  event.preventDefault();
  const form     = event.target;
  const typeKey  = form.type.value;
  const typeInfo = TAAK_TYPES[typeKey] || { label: typeKey, max: 2 };

  const nieuw = {
    type:          typeKey,
    naam:          form.naam.value.trim() || typeInfo.label,
    datum:         form.datum.value || null,
    maxDeelnemers: parseInt(form.maxDeelnemers.value) || typeInfo.max,
    coordinator:   form.coordinator.value || null,
    beschrijving:  form.beschrijving.value.trim(),
    uitgevoerd:    form.uitgevoerd.checked,
  };

  const data = laadData();
  if (id) {
    const idx = data.taken.findIndex(t => t.id === id);
    if (idx >= 0) data.taken[idx] = { ...data.taken[idx], ...nieuw };
  } else {
    data.taken.push({ id: nieuwId(), deelnemers: [], ...nieuw });
  }

  slaData(data);
  sluitModal();
  toonMelding(id ? 'Taak bijgewerkt' : 'Taak aangemaakt', 'succes');
  renderTaken();
}

function verwijderTaak(id) {
  const data = laadData();
  data.taken = data.taken.filter(t => t.id !== id);
  slaData(data);
  toonMelding('Taak verwijderd', 'info');
  renderTaken();
}

function toonDeelnemers(taakId) {
  const { leden, taken } = laadData();
  const taak = taken.find(t => t.id === taakId);
  if (!taak) return;

  const type  = TAAK_TYPES[taak.type] || { label: taak.type, max: 99 };
  const max   = taak.maxDeelnemers || type.max;
  const gesorteerd = [...leden].sort((a, b) => a.naam.localeCompare(b.naam));

  const html = `
    <div class="deelnemers-info">
      Bezet: <strong id="deelnemers-teller">${(taak.deelnemers||[]).length}</strong>
      van <strong>${max}</strong> plaatsen
    </div>
    <input type="search" class="zoek-invoer" placeholder="Zoek lid…"
           style="width:100%;margin-bottom:12px"
           oninput="filterDeelnemersLijst(this.value)">
    <div id="deelnemers-lijst" class="deelnemers-lijst">
      ${gesorteerd.map(lid => {
        const ingeschreven = (taak.deelnemers || []).includes(lid.id);
        return `
        <label class="deelnemers-item ${ingeschreven ? 'ingeschreven' : ''}" id="di-${lid.id}">
          <input type="checkbox" value="${lid.id}" ${ingeschreven ? 'checked' : ''}
                 onchange="toggleDeelnemer('${taakId}', '${lid.id}', this.checked, ${max}, this)">
          <span>${esc(lid.naam)}</span>
          ${ingeschreven ? `<span class="badge-klein groen" id="badge-${lid.id}">✓</span>` : `<span id="badge-${lid.id}"></span>`}
        </label>`;
      }).join('')}
    </div>
  `;

  toonModal(
    `👥 Deelnemers: ${esc(taak.naam || type.label)}`,
    html,
    [{ label: 'Sluiten', klasse: 'primair', actie: 'sluitModal()' }]
  );
}

function filterDeelnemersLijst(zoek) {
  document.querySelectorAll('.deelnemers-item').forEach(item => {
    const naam = item.querySelector('span')?.textContent?.toLowerCase() || '';
    item.style.display = naam.includes(zoek.toLowerCase()) ? '' : 'none';
  });
}

function toggleDeelnemer(taakId, lidId, inschrijven, max, checkbox) {
  const data = laadData();
  const taak = data.taken.find(t => t.id === taakId);
  if (!taak) return;
  if (!taak.deelnemers) taak.deelnemers = [];

  if (inschrijven) {
    if (taak.deelnemers.length >= max) {
      toonMelding(`Maximum (${max}) deelnemers bereikt`, 'waarschuwing');
      checkbox.checked = false;
      return;
    }
    if (!taak.deelnemers.includes(lidId)) taak.deelnemers.push(lidId);
  } else {
    taak.deelnemers = taak.deelnemers.filter(d => d !== lidId);
  }

  slaData(data);

  // Update teller
  const teller = document.getElementById('deelnemers-teller');
  if (teller) teller.textContent = taak.deelnemers.length;

  // Update stijl rij
  const rij   = document.getElementById('di-' + lidId);
  const badge = document.getElementById('badge-' + lidId);
  if (rij)   rij.classList.toggle('ingeschreven', inschrijven);
  if (badge) badge.innerHTML = inschrijven ? '<span class="badge-klein groen">✓</span>' : '';
}

/* ============================================================
   BARDIENST
   ============================================================ */

function renderBardienst() {
  const { leden, taken } = laadData();
  const el = document.getElementById('pagina-bardienst');

  const bars = taken.filter(t => t.type === 'bardienst')
    .sort((a, b) => (a.datum || '').localeCompare(b.datum || ''));

  const ledenStats = leden
    .map(lid => ({ lid, s: getLidStatus(lid, taken) }))
    .filter(x => x.s.bars > 0 || (x.lid.uitbetaald || 0) > 0)
    .sort((a, b) => b.s.extra - a.s.extra || a.lid.naam.localeCompare(b.lid.naam));

  const totaalExtra    = ledenStats.reduce((sum, x) => sum + x.s.extra, 0);
  const totaalUitKeren = ledenStats.reduce((sum, x) => sum + x.s.teOntvangen, 0);

  el.innerHTML = `
    <div class="pagina-koptekst">
      <div>
        <h2>🍺 Bardienst</h2>
        <p>Overzicht bardiensten en uitbetalingen</p>
      </div>
      <div class="koptekst-acties">
        <button class="knop primair" onclick="toonTaakForm(null,'bardienst')">+ Bardienst plannen</button>
      </div>
    </div>

    <div class="stat-grid compact">
      <div class="stat-kaart">
        <div class="stat-getal">${bars.filter(t => !t.uitgevoerd).length}</div>
        <div class="stat-label">Geplande bardiensten</div>
      </div>
      <div class="stat-kaart taak">
        <div class="stat-getal">${bars.filter(t => t.uitgevoerd).length}</div>
        <div class="stat-label">Uitgevoerd</div>
      </div>
      <div class="stat-kaart bardienst">
        <div class="stat-getal">${totaalExtra}</div>
        <div class="stat-label">Totaal extra bardiensten</div>
      </div>
      <div class="stat-kaart uitbetalen">
        <div class="stat-getal">${euro(totaalUitKeren)}</div>
        <div class="stat-label">Nog uit te keren</div>
      </div>
    </div>

    <h3 style="margin:24px 0 12px;color:var(--primair)">Uitbetalingen per lid</h3>

    ${ledenStats.length === 0 ? `
    <div class="leeg-staat">
      <div class="leeg-icoon">🍺</div>
      <h3>Nog geen bardiensten uitgevoerd</h3>
      <p>Plan bardiensten, schrijf leden in en markeer ze als uitgevoerd.</p>
    </div>
    ` : `
    <div class="tabel-container" style="margin-bottom:28px">
      <table class="tabel">
        <thead>
          <tr>
            <th>Naam</th>
            <th>Bardiensten</th>
            <th>Extra</th>
            <th>Te ontvangen</th>
            <th class="verberg-mobiel">Al uitbetaald</th>
            <th style="text-align:right">Actie</th>
          </tr>
        </thead>
        <tbody>
          ${ledenStats.map(({ lid, s }) => `
          <tr class="${s.teOntvangen > 0 ? 'rij-uitbetalen' : ''}">
            <td><strong>${esc(lid.naam)}</strong></td>
            <td>${s.bars}</td>
            <td>${s.extra > 0 ? `<strong>${s.extra}</strong>` : '0'}</td>
            <td>
              ${s.teOntvangen > 0
                ? `<strong class="kleur-succes">${euro(s.teOntvangen)}</strong>`
                : '—'}
            </td>
            <td class="verberg-mobiel">
              ${(lid.uitbetaald || 0) > 0 ? euro((lid.uitbetaald || 0) * BARDIENST_BONUS) : '—'}
            </td>
            <td class="acties-cel">
              ${s.teOntvangen > 0 ? `
              <button class="knop klein succes" onclick="markeerUitbetaald('${lid.id}')">
                ✓ Uitbetalen
              </button>` : ''}
              <button class="knop-icoon" onclick="toonLidForm('${lid.id}')" title="Bewerken">✏️</button>
            </td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
    `}

    <h3 style="margin:0 0 12px;color:var(--primair)">Bardienstrooster</h3>
    ${bars.length === 0 ? `
    <p class="leeg-tekst">Nog geen bardiensten gepland.
      <button class="knop klein primair" onclick="toonTaakForm(null,'bardienst')"
              style="margin-left:8px">+ Plannen</button>
    </p>
    ` : `
    <div class="taak-grid">
      ${bars.map(t => renderTaakKaart(t, leden)).join('')}
    </div>
    `}
  `;
}

function markeerUitbetaald(lidId) {
  const data = laadData();
  const lid  = data.leden.find(l => l.id === lidId);
  if (!lid) return;

  const s = getLidStatus(lid, data.taken);
  if (s.teOntvangen <= 0) { toonMelding('Niets te betalen', 'info'); return; }

  // Show confirmation in modal
  const extraNog = s.extra - (lid.uitbetaald || 0);
  const html = `
    <p>Markeer <strong>${euro(s.teOntvangen)}</strong> als uitbetaald aan <strong>${esc(lid.naam)}</strong>?</p>
    <p style="font-size:.85rem;color:var(--tekst-zacht);margin-top:8px">
      ${extraNog} extra bardienst${extraNog !== 1 ? 'en' : ''} × €${BARDIENST_BONUS}
    </p>
  `;

  toonModal(
    '💰 Uitbetaling bevestigen',
    html,
    [
      { label: 'Annuleren', klasse: 'secundair', actie: 'sluitModal()' },
      { label: `✓ ${euro(s.teOntvangen)} uitbetaald`, klasse: 'succes',
        actie: `bevestigUitbetaling('${lidId}')` },
    ]
  );
}

function bevestigUitbetaling(lidId) {
  const data = laadData();
  const lid  = data.leden.find(l => l.id === lidId);
  if (!lid) return;

  const s = getLidStatus(lid, data.taken);
  // Markeer alle extra bardiensten als uitbetaald (teOntvangen wordt 0)
  lid.uitbetaald = s.extra;

  slaData(data);
  sluitModal();
  toonMelding(`${euro(s.teOntvangen)} uitbetaald aan ${lid.naam}`, 'succes');
  renderBardienst();
}

/* ============================================================
   MAILLIJST
   ============================================================ */

function renderMaillijst() {
  const { leden, taken } = laadData();
  const el = document.getElementById('pagina-maillijst');

  const achterstand = leden
    .filter(l => getLidStatus(l, taken).status === 'niets')
    .sort((a, b) => a.naam.localeCompare(b.naam));

  const metEmail = achterstand.filter(l => l.email);

  el.innerHTML = `
    <div class="pagina-koptekst">
      <div>
        <h2>📧 Maillijst</h2>
        <p>Leden die nog geen taak hebben gedaan én niet hebben betaald</p>
      </div>
      <div class="koptekst-acties">
        <button class="knop secundair" onclick="renderMaillijst()">↻ Vernieuwen</button>
      </div>
    </div>

    <div class="alert ${achterstand.length === 0 ? 'succes' : 'waarschuwing'}">
      ${achterstand.length === 0
        ? '✅ <strong>Iedereen heeft meegedaan!</strong> Alle leden hebben een taak gedaan of de bijdrage betaald.'
        : `⚠️ <strong>${achterstand.length} ${achterstand.length === 1 ? 'lid heeft' : 'leden hebben'}</strong>
           nog geen taak gedaan én nog niet €${BOETE} betaald.`}
    </div>

    ${achterstand.length === 0 ? '' : `

    <div class="kaart" style="margin-bottom:16px">
      <div class="kaart-koptekst">
        <h3>📋 E-mailadressen voor CC / BCC</h3>
        <button class="knop klein primair" onclick="kopieerTekst('email-blok','E-mailadressen gekopieerd!')">
          📋 Kopieer
        </button>
      </div>
      <div class="kaart-inhoud">
        ${metEmail.length === 0
          ? '<p style="color:var(--tekst-zacht);font-size:.88rem">Geen e-mailadressen bekend voor deze leden.</p>'
          : `<div class="tekst-blok" id="email-blok">${metEmail.map(l => esc(l.email)).join(', ')}</div>`}
        ${metEmail.length < achterstand.length
          ? `<small style="margin-top:8px;display:block">
              ⚠️ ${achterstand.length - metEmail.length} leden hebben geen e-mailadres ingevuld.
             </small>` : ''}
      </div>
    </div>

    <div class="kaart" style="margin-bottom:16px">
      <div class="kaart-koptekst">
        <h3>📝 Volledige lijst (naam + contactinfo)</h3>
        <button class="knop klein primair" onclick="kopieerTekst('naam-blok','Lijst gekopieerd!')">
          📋 Kopieer
        </button>
      </div>
      <div class="kaart-inhoud">
        <div class="tekst-blok" id="naam-blok">${achterstand.map(l =>
          [l.naam, l.email, l.telefoon].filter(Boolean).join('\t')
        ).join('\n')}</div>
      </div>
    </div>

    <div class="knop-rij" style="margin-bottom:24px">
      <button class="knop primair" onclick="exporteerMaillijst()">💾 Exporteer als CSV</button>
    </div>

    <details>
      <summary class="sectie-titel">Leden in deze lijst (${achterstand.length})</summary>
      <div class="tabel-container" style="margin-top:10px">
        <table class="tabel">
          <thead><tr><th>Naam</th><th>E-mail</th><th class="verberg-mobiel">Telefoon</th></tr></thead>
          <tbody>
            ${achterstand.map(l => `
            <tr>
              <td>${esc(l.naam)}</td>
              <td style="font-size:.85rem">
                ${l.email ? `<a href="mailto:${esc(l.email)}">${esc(l.email)}</a>` : '—'}
              </td>
              <td class="verberg-mobiel" style="font-size:.85rem">${esc(l.telefoon||'—')}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </details>
    `}
  `;
}

function kopieerTekst(elementId, bevestiging) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const tekst = el.textContent;

  if (navigator.clipboard) {
    navigator.clipboard.writeText(tekst)
      .then(() => toonMelding(bevestiging || 'Gekopieerd!', 'succes'))
      .catch(() => kopieerFallback(tekst, bevestiging));
  } else {
    kopieerFallback(tekst, bevestiging);
  }
}

function kopieerFallback(tekst, bevestiging) {
  const ta = document.createElement('textarea');
  ta.value = tekst;
  ta.style.position = 'fixed';
  ta.style.opacity  = '0';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); toonMelding(bevestiging || 'Gekopieerd!', 'succes'); }
  catch { toonMelding('Kopiëren mislukt. Selecteer de tekst handmatig.', 'fout'); }
  document.body.removeChild(ta);
}

/* ============================================================
   EXPORT
   ============================================================ */

function renderExport() {
  const el = document.getElementById('pagina-export');
  el.innerHTML = `
    <div class="pagina-koptekst">
      <div><h2>💾 Exporteren</h2></div>
    </div>

    <div class="export-grid">
      <div class="export-kaart">
        <div class="export-icoon">👥</div>
        <h3>Ledenlijst</h3>
        <p>Alle leden met naam, contact, status en bardienstinfo.</p>
        <button class="knop primair" onclick="exporteerLeden()">💾 Download CSV</button>
      </div>
      <div class="export-kaart">
        <div class="export-icoon">📋</div>
        <h3>Taakoverzicht</h3>
        <p>Alle taken met datum, type, coördinator en deelnemers.</p>
        <button class="knop primair" onclick="exporteerTaken()">💾 Download CSV</button>
      </div>
      <div class="export-kaart">
        <div class="export-icoon">📧</div>
        <h3>Maillijst (achterstanders)</h3>
        <p>Leden zonder taak én zonder betaling.</p>
        <button class="knop primair" onclick="exporteerMaillijst()">💾 Download CSV</button>
      </div>
      <div class="export-kaart">
        <div class="export-icoon">🍺</div>
        <h3>Bardienst uitbetalingen</h3>
        <p>Extra bardiensten en te keren bedragen per lid.</p>
        <button class="knop primair" onclick="exporteerBardienst()">💾 Download CSV</button>
      </div>
    </div>

    <div class="kaart">
      <div class="kaart-koptekst"><h3>🔄 Back-up & herstel</h3></div>
      <div class="kaart-inhoud">
        <p style="margin-bottom:14px;font-size:.9rem;color:var(--tekst-zacht)">
          Exporteer alle data als JSON-back-up of herstel een eerder opgeslagen bestand.
        </p>
        <div class="knop-rij">
          <button class="knop secundair" onclick="exporteerBackup()">💾 Back-up exporteren</button>
          <button class="knop secundair"
                  onclick="document.getElementById('backup-invoer').click()">↑ Back-up terugzetten</button>
          <input type="file" id="backup-invoer" accept=".json" style="display:none"
                 onchange="herstelBackup(this)">
        </div>
      </div>
    </div>
  `;
}

/* --- CSV helpers --- */

function csvMaak(rijen) {
  return rijen.map(r =>
    r.map(cel => {
      const s = String(cel ?? '');
      return (s.includes(',') || s.includes('"') || s.includes('\n'))
        ? '"' + s.replace(/"/g, '""') + '"'
        : s;
    }).join(',')
  ).join('\n');
}

function downloadCSV(inhoud, naam) {
  const blob = new Blob(['\uFEFF' + inhoud], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = naam; a.click();
  URL.revokeObjectURL(url);
}

function exporteerLeden() {
  const { leden, taken } = laadData();
  const rijen = [['Naam','E-mail','Telefoon','Status','Heeft betaald','Bardiensten totaal',
                  'Extra bardiensten','Uitbetaald (€)','Te ontvangen (€)']];
  [...leden].sort((a,b) => a.naam.localeCompare(b.naam)).forEach(l => {
    const s = getLidStatus(l, taken);
    rijen.push([l.naam, l.email||'', l.telefoon||'', statusLabel(s.status),
      l.betaald?'Ja':'Nee', s.bars, s.extra,
      (l.uitbetaald||0)*BARDIENST_BONUS, s.teOntvangen]);
  });
  downloadCSV(csvMaak(rijen), `dos-leden-${vandaag()}.csv`);
  toonMelding('Ledenlijst gedownload', 'succes');
}

function exporteerTaken() {
  const { leden, taken } = laadData();
  const rijen = [['Type','Naam','Datum','Coördinator','Deelnemers','Max deelnemers','Uitgevoerd']];
  [...taken].sort((a,b) => (a.datum||'').localeCompare(b.datum||'')).forEach(t => {
    const type  = TAAK_TYPES[t.type] || { label: t.type };
    const coord = t.coordinator ? (getLid(t.coordinator, leden)?.naam || '') : '';
    const deelns = (t.deelnemers||[]).map(id => getLid(id,leden)?.naam||id).join('; ');
    rijen.push([type.label, t.naam||type.label, t.datum||'', coord,
                deelns, t.maxDeelnemers||'', t.uitgevoerd?'Ja':'Nee']);
  });
  downloadCSV(csvMaak(rijen), `dos-taken-${vandaag()}.csv`);
  toonMelding('Taakoverzicht gedownload', 'succes');
}

function exporteerMaillijst() {
  const { leden, taken } = laadData();
  const lijst = leden.filter(l => getLidStatus(l,taken).status==='niets')
    .sort((a,b) => a.naam.localeCompare(b.naam));
  const rijen = [['Naam','E-mail','Telefoon']];
  lijst.forEach(l => rijen.push([l.naam, l.email||'', l.telefoon||'']));
  downloadCSV(csvMaak(rijen), `dos-maillijst-${vandaag()}.csv`);
  toonMelding('Maillijst gedownload', 'succes');
}

function exporteerBardienst() {
  const { leden, taken } = laadData();
  const rijen = [['Naam','Totaal bardiensten','Extra bardiensten','Te ontvangen (€)','Al uitbetaald (€)']];
  leden.filter(l => getLidStatus(l,taken).bars > 0)
    .sort((a,b) => a.naam.localeCompare(b.naam))
    .forEach(l => {
      const s = getLidStatus(l,taken);
      rijen.push([l.naam, s.bars, s.extra, s.teOntvangen, (l.uitbetaald||0)*BARDIENST_BONUS]);
    });
  downloadCSV(csvMaak(rijen), `dos-bardienst-${vandaag()}.csv`);
  toonMelding('Bardienstoverzicht gedownload', 'succes');
}

function exporteerBackup() {
  const data = laadData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `dos-backup-${vandaag()}.json`; a.click();
  URL.revokeObjectURL(url);
  toonMelding('Back-up gedownload', 'succes');
}

function herstelBackup(input) {
  const file = input.files[0];
  if (!file) return;
  input.value = '';

  bevestigVerwijder(
    'Back-up terugzetten',
    'Dit <strong>overschrijft alle huidige data</strong> met de back-up. Doorgaan?',
    () => {
      const reader = new FileReader();
      reader.onload = e => {
        try {
          const data = JSON.parse(e.target.result);
          if (!Array.isArray(data.leden) || !Array.isArray(data.taken))
            throw new Error('Ongeldig formaat');
          slaData(data);
          toonMelding('Back-up hersteld', 'succes');
          renderPagina(huidigePagina);
        } catch {
          toonMelding('Ongeldig back-upbestand', 'fout');
        }
      };
      reader.readAsText(file);
    },
    'Back-up terugzetten'
  );
}

/* ============================================================
   DEMO DATA
   ============================================================ */

function laadVoorbeeldData() {
  if (laadData().leden.length > 0) {
    bevestigVerwijder(
      'Demo data laden',
      'Er zijn al leden aanwezig. Wil je de huidige data vervangen door voorbeelddata?',
      _laadVoorbeeldDataDoen,
      'Vervangen'
    );
  } else {
    _laadVoorbeeldDataDoen();
  }
}

function _laadVoorbeeldDataDoen() {
  const ids = Array.from({ length: 12 }, () => nieuwId());
  const taakIds = Array.from({ length: 8 }, () => nieuwId());

  const leden = [
    { id: ids[0],  naam: 'Anna de Vries',      email: 'anna@voorbeeld.nl',    telefoon: '06-11111111', betaald: false, uitbetaald: 0 },
    { id: ids[1],  naam: 'Bas Janssen',         email: 'bas@voorbeeld.nl',     telefoon: '06-22222222', betaald: true,  uitbetaald: 0 },
    { id: ids[2],  naam: 'Carla Smits',         email: 'carla@voorbeeld.nl',   telefoon: '06-33333333', betaald: false, uitbetaald: 0 },
    { id: ids[3],  naam: 'Daan Bakker',         email: 'daan@voorbeeld.nl',    telefoon: '06-44444444', betaald: false, uitbetaald: 1 },
    { id: ids[4],  naam: 'Eva Mulder',          email: 'eva@voorbeeld.nl',     telefoon: '',            betaald: true,  uitbetaald: 0 },
    { id: ids[5],  naam: 'Frank Peters',        email: '',                     telefoon: '06-55555555', betaald: false, uitbetaald: 0 },
    { id: ids[6],  naam: 'Greet van Dam',       email: 'greet@voorbeeld.nl',   telefoon: '06-66666666', betaald: false, uitbetaald: 0 },
    { id: ids[7],  naam: 'Hans de Groot',       email: 'hans@voorbeeld.nl',    telefoon: '06-77777777', betaald: false, uitbetaald: 0 },
    { id: ids[8],  naam: 'Irene Visser',        email: 'irene@voorbeeld.nl',   telefoon: '06-88888888', betaald: true,  uitbetaald: 0 },
    { id: ids[9],  naam: 'Jan Willems',         email: 'jan@voorbeeld.nl',     telefoon: '',            betaald: false, uitbetaald: 0 },
    { id: ids[10], naam: 'Karin Bosman',        email: 'karin@voorbeeld.nl',   telefoon: '06-99999999', betaald: false, uitbetaald: 0 },
    { id: ids[11], naam: 'Lars Hendriks',       email: 'lars@voorbeeld.nl',    telefoon: '06-10101010', betaald: false, uitbetaald: 0 },
  ];

  const taken = [
    {
      id: taakIds[0], type: 'bardienst', naam: 'Bardienst week 3',
      datum: '2025-01-15', maxDeelnemers: 2, coordinator: ids[0],
      beschrijving: '', uitgevoerd: true,
      deelnemers: [ids[0], ids[2]],
    },
    {
      id: taakIds[1], type: 'bardienst', naam: 'Bardienst week 7',
      datum: '2025-02-12', maxDeelnemers: 2, coordinator: null,
      beschrijving: '', uitgevoerd: true,
      deelnemers: [ids[3], ids[0]],
    },
    {
      id: taakIds[2], type: 'bardienst', naam: 'Bardienst week 11',
      datum: '2025-03-12', maxDeelnemers: 2, coordinator: null,
      beschrijving: '', uitgevoerd: false,
      deelnemers: [ids[6]],
    },
    {
      id: taakIds[3], type: 'schoonmaak', naam: 'Grote schoonmaak 2025',
      datum: '2025-06-07', maxDeelnemers: 20, coordinator: ids[1],
      beschrijving: 'Volledige schoonmaak van de zaal en kleedkamers',
      uitgevoerd: false,
      deelnemers: [ids[1], ids[7], ids[8]],
    },
    {
      id: taakIds[4], type: 'opbouw', naam: 'Op-/afbouw Regiowedstrijd',
      datum: '2025-03-22', maxDeelnemers: 10, coordinator: ids[4],
      beschrijving: '', uitgevoerd: true,
      deelnemers: [ids[4], ids[5], ids[9], ids[10]],
    },
    {
      id: taakIds[5], type: 'medailles', naam: 'Medailles Regiowedstrijd',
      datum: '2025-03-22', maxDeelnemers: 5, coordinator: ids[11],
      beschrijving: '', uitgevoerd: true,
      deelnemers: [ids[11]],
    },
    {
      id: taakIds[6], type: 'intekenen', naam: 'Intekenen Districtkampioenschap',
      datum: '2025-04-19', maxDeelnemers: 5, coordinator: null,
      beschrijving: '', uitgevoerd: false,
      deelnemers: [],
    },
    {
      id: taakIds[7], type: 'muziek', naam: 'Muziek Districtkampioenschap',
      datum: '2025-04-19', maxDeelnemers: 2, coordinator: null,
      beschrijving: '', uitgevoerd: false,
      deelnemers: [],
    },
  ];

  slaData({ leden, taken });
  toonMelding('Voorbeelddata geladen!', 'succes');
  renderPagina(huidigePagina);
}

/* ============================================================
   WRAPPER FUNCTIES (veilige onclick zonder naam-strings)
   ============================================================ */

function verwijderLidBevestig(id) {
  const { leden } = laadData();
  const lid = leden.find(l => l.id === id);
  if (!lid) return;
  bevestigVerwijder(
    'Lid verwijderen',
    `Weet je zeker dat je <strong>${esc(lid.naam)}</strong> wilt verwijderen?
     Dit lid wordt ook uit alle taken verwijderd.`,
    () => verwijderLid(id)
  );
}

function verwijderTaakBevestig(id) {
  const { taken } = laadData();
  const taak = taken.find(t => t.id === id);
  if (!taak) return;
  const type = TAAK_TYPES[taak.type] || { label: taak.type };
  bevestigVerwijder(
    'Taak verwijderen',
    `Weet je zeker dat je <strong>${esc(taak.naam || type.label)}</strong> wilt verwijderen?`,
    () => verwijderTaak(id)
  );
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
    const first = document.querySelector('#modal-inhoud input:not([type=checkbox]), #modal-inhoud select, #modal-inhoud textarea');
    if (first) first.focus();
  }, 50);
}

function sluitModal() {
  document.getElementById('modal-overlay').classList.add('verborgen');
}

function sluitModalOpOverlay(e) {
  if (e.target === document.getElementById('modal-overlay')) sluitModal();
}

/* --- Bevestigingsdialoog --- */

let _bevestigCallback = null;

function bevestigVerwijder(titel, tekst, callback, knopLabel) {
  _bevestigCallback = callback;
  document.getElementById('bevestig-titel').textContent = titel;
  document.getElementById('bevestig-tekst').innerHTML   = tekst;
  const knop = document.getElementById('bevestig-knop');
  knop.textContent = knopLabel || 'Verwijderen';
  knop.className   = (knopLabel && knopLabel !== 'Verwijderen') ? 'knop primair' : 'knop gevaar';
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
   MOBIEL MENU
   ============================================================ */

function toggleMenu() {
  document.getElementById('nav').classList.toggle('open');
}

/* ============================================================
   TOETSENBORD
   ============================================================ */

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    sluitModal();
    bevestigAnnuleer();
  }
});

/* ============================================================
   INITIALISATIE
   ============================================================ */

// Wire up the confirm button
document.getElementById('bevestig-knop').addEventListener('click', bevestigOK);

document.addEventListener('DOMContentLoaded', () => {
  naarPagina('dashboard');
});
