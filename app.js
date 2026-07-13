/* Turni III — PWA frontend.
 * Parla con l'API Apps Script (WebApi.js) via GET semplici (nessun header
 * custom → nessun preflight CORS). L'accesso è protetto dal codice condiviso:
 * l'URL da solo non basta a leggere i dati. */

// URL /exec della web app (deployment anonimo protetto dal codice condiviso).
var API_BASE = 'https://script.google.com/macros/s/AKfycbzj4wCgMtsKajOdXttH7ghkXfQkSjAgjfvkPaNbkUcX29oMZ35Md_u0OZsgy4LlPo7B/exec';

var K_CODE = 'turni3_code';
var K_NOME = 'turni3_nome';
var K_REP = 'turni3_rep'; // codice rappresentante salvato (per approvare i cambi)
var lastTurni = []; // ultimi turni caricati, per pre-riempire il cambio

function el(id){ return document.getElementById(id); }
function show(id, on){ el(id).hidden = !on; }
function esc(s){ return String(s==null?'':s).replace(/[&<>]/g, function(c){
  return {'&':'&amp;','<':'&lt;','>':'&gt;'}[c]; }); }

// Chiamata all'API: ritorna l'oggetto JSON (o lancia un errore leggibile).
function api(action, params){
  var q = 'action=' + encodeURIComponent(action) +
          '&codice=' + encodeURIComponent(localStorage.getItem(K_CODE) || '');
  Object.keys(params || {}).forEach(function(k){
    if (params[k] != null) q += '&' + k + '=' + encodeURIComponent(params[k]);
  });
  return fetch(API_BASE + '?' + q, { method:'GET' })
    .then(function(r){ return r.json(); })
    .then(function(d){
      if (d && d.ok === false && d.errore === 'CODICE'){
        localStorage.removeItem(K_CODE);
        throw { codice:true, messaggio: d.messaggio || 'Codice errato.' };
      }
      return d;
    });
}

// Scrittura: POST con corpo-stringa e nessun header custom = richiesta
// "semplice", niente preflight CORS verso Apps Script.
function apiPost(action, payload){
  var body = Object.assign({ action: action, codice: localStorage.getItem(K_CODE) || '' }, payload || {});
  return fetch(API_BASE, { method:'POST', body: JSON.stringify(body) })
    .then(function(r){ return r.json(); })
    .then(function(d){
      if (d && d.ok === false && d.errore === 'CODICE'){
        localStorage.removeItem(K_CODE);
        throw { codice:true, messaggio: d.messaggio || 'Codice errato.' };
      }
      return d;
    });
}

/* ---- Avvio ---- */
function boot(){
  if (!localStorage.getItem(K_CODE)){ vaiACodice(); return; }
  // Valida il codice caricando l'elenco nomi.
  api('elenco', {}).then(function(d){
    if (!d || d.ok === false) throw (d && d.messaggio) || 'Errore';
    popolaNomi(d.nomi || []);
    mostraApp();
  }).catch(function(e){
    if (e && e.codice){ vaiACodice(e.messaggio); }
    else { erroreBoot(e && e.messaggio ? e.messaggio : e); }
  });
}

function vaiACodice(msg){
  show('boot', false); show('scrApp', false); show('menuBtn', false);
  show('scrCode', true);
  var box = el('codeErr');
  if (msg){ box.textContent = msg; box.hidden = false; } else { box.hidden = true; }
  el('code').focus();
}

function salvaCodice(){
  var v = (el('code').value || '').trim();
  if (!v){ return; }
  localStorage.setItem(K_CODE, v);
  el('code').value = '';
  show('scrCode', false);
  show('boot', true);
  boot();
}

function mostraApp(){
  show('boot', false); show('scrCode', false);
  show('scrApp', true); show('menuBtn', true);
}

function erroreBoot(m){
  show('boot', true);
  el('boot').innerHTML = '<div class="err">Errore di collegamento: ' + esc(m) +
    '<br><span class="muted">Controlla la connessione o riprova.</span></div>';
}

function apraImpostazioni(){
  if (confirm('Vuoi reinserire il codice d\'accesso?')){
    localStorage.removeItem(K_CODE);
    vaiACodice();
  }
}

/* ---- Nomi ---- */
function popolaNomi(nomi){
  var sel = el('nome');
  sel.innerHTML = '<option value="">— scegli il tuo nome —</option>' +
    nomi.map(function(n){ return '<option>' + esc(n) + '</option>'; }).join('');
  var saved = localStorage.getItem(K_NOME);
  if (saved && nomi.indexOf(saved) >= 0){ sel.value = saved; carica(); }
}

/* ---- Dashboard ---- */
function carica(){
  var nome = el('nome').value;
  if (!nome){ return; }
  localStorage.setItem(K_NOME, nome);
  el('content').innerHTML = '<div class="card"><div class="muted">' +
    '<span class="spin"></span> Carico i dati…</div></div>';
  api('dashboard', { nome: nome, giorni: 21 }).then(function(d){
    if (!d || d.ok === false) throw (d && d.messaggio) || 'Errore';
    render(d);
  }).catch(function(e){
    if (e && e.codice){ vaiACodice(e.messaggio); return; }
    el('content').innerHTML = '<div class="card"><div class="err">Errore: ' +
      esc(e && e.messaggio ? e.messaggio : e) + '</div></div>';
  });
}

function render(d){
  var html = '';

  var fe = (d.ferieOggi && d.ferieOggi.inFerie) || [];
  html += '<div class="card"><h2 class="section">In ferie oggi</h2>';
  html += fe.length ? fe.map(function(n){ return '<span class="chip">' + esc(n) + '</span>'; }).join('')
                    : '<div class="muted">Nessuno in ferie oggi.</div>';
  html += '</div>';

  var t = (d.turni && d.turni.turni) || [];
  lastTurni = t;
  html += '<div class="card"><h2 class="section">I tuoi prossimi turni</h2>';
  if (t.length){
    html += t.map(function(x){
      return '<div class="row"><div class="day">' + esc(x.etichetta) + '</div>' +
        '<div class="slot">' + esc(x.sala) + ' · ' + esc(x.turno) +
        (x.weekend ? '<span class="tag">weekend</span>' : '') + '</div></div>';
    }).join('');
  } else {
    html += '<div class="muted">Nessun turno nei prossimi giorni.</div>';
  }
  html += '</div>';

  var a = (d.anomalie && d.anomalie.anomalie) || [];
  html += '<div class="card"><h2 class="section">Le tue anomalie</h2>';
  if (a.length){
    html += a.map(function(x){
      return '<div class="anom"><div class="t"><span class="dot ' + esc(x.gravita) + '"></span>' +
        esc(x.tipo) + (x.data ? ' · ' + esc(x.data) : '') + '</div>' +
        '<div class="d">' + esc(x.dettaglio) + '</div></div>';
    }).join('');
  } else {
    html += '<div class="muted">Nessuna anomalia. ✅</div>';
  }
  html += '</div>';

  el('content').innerHTML = html;
  aggiornaBadgeCambi(d.cambiPendenti || 0);
  aggiornaBadgeFerie(d.feriePendenti || 0);
  var st = d.stato || {};
  el('foot').textContent = 'Periodo ' + (st.periodo ? st.periodo.inizio + ' → ' + st.periodo.fine : '') +
    (st.ultimoAggiornamento ? ' · agg. ' + st.ultimoAggiornamento : '');
}

/* ---- Cambi 1-1 ---- */
function aggiornaBadgeCambi(n){
  var b = el('tabBtnCambi');
  b.innerHTML = 'Cambi' + (n > 0 ? ' <span class="pill">' + n + '</span>' : '');
}

function aggiornaBadgeFerie(n){
  var b = el('tabBtnFerie');
  b.innerHTML = 'Ferie' + (n > 0 ? ' <span class="pill">' + n + '</span>' : '');
}

function cap(s){ return s.charAt(0).toUpperCase() + s.slice(1); }

function tab(which){
  ['home', 'cambi', 'ferie'].forEach(function(t){
    show('tab' + cap(t), t === which);
    el('tabBtn' + cap(t)).classList.toggle('active', t === which);
  });
  if (which === 'cambi'){ popolaCede(); renderRepBar(); caricaCambi(); }
  if (which === 'ferie'){ renderRepBar(); caricaFerie(); }
}

/* ---- Modalità rappresentante (approvazione cambi e ferie) ---- */
function isRep(){ return !!localStorage.getItem(K_REP); }

function renderRepBar(){
  var html = isRep()
    ? '<span class="muted">✅ Modalità rappresentante attiva — puoi approvare</span>' +
      ' <button class="link" onclick="esciRep()">esci</button>'
    : '<button class="link" onclick="entraRep()">🔑 Sono un rappresentante (per approvare)</button>';
  ['repBar', 'repBarFerie'].forEach(function(id){ var b = el(id); if (b){ b.innerHTML = html; } });
  renderFerieAdmin();
}

// Bottone rep-only: genera il mese successivo nel foglio ferie ufficiale.
function renderFerieAdmin(){
  var a = el('ferieAdmin'); if (!a){ return; }
  a.innerHTML = isRep()
    ? '<button class="mini" onclick="generaMese()">➕ Genera mese successivo (foglio ferie)</button>'
    : '';
}

function generaMese(){
  if (!confirm('Generare il mese successivo nel foglio ferie ufficiale? (copia dal mese più recente, ferie vuote)')){ return; }
  apiPost('generaMeseFerie', { repCode: localStorage.getItem(K_REP) || '' }).then(function(d){
    alert((d && d.messaggio) || 'Fatto.');
  }).catch(function(e){
    if (e && e.codice){ vaiACodice(e.messaggio); return; }
    alert('Errore di collegamento.');
  });
}

function entraRep(){
  var c = prompt('Codice rappresentante:');
  if (!c){ return; }
  api('verificaRep', { repCode: c }).then(function(d){
    if (d && d.rappresentante){
      localStorage.setItem(K_REP, c);
      renderRepBar(); caricaCambi(); caricaFerie();
    } else {
      alert('Codice rappresentante errato.');
    }
  }).catch(function(e){
    if (e && e.codice){ vaiACodice(e.messaggio); return; }
    alert('Errore di collegamento.');
  });
}

function esciRep(){
  localStorage.removeItem(K_REP);
  renderRepBar(); caricaCambi(); caricaFerie();
}

function segnaFatto(riga, fatto){
  apiPost('segnaCambio', { riga: riga, fatto: fatto, repCode: localStorage.getItem(K_REP) || '' })
    .then(function(d){
      if (!d || d.ok === false){ alert((d && d.messaggio) || 'Errore'); return; }
      caricaCambi();
    }).catch(function(e){
      if (e && e.codice){ vaiACodice(e.messaggio); return; }
      alert('Errore di collegamento.');
    });
}

function popolaCede(){
  var sel = el('cedePick');
  sel.innerHTML = '<option value="">— pesca dai tuoi turni —</option>' +
    lastTurni.map(function(x, i){
      return '<option value="' + i + '">' + esc(x.etichetta + ' · ' + x.sala + ' / ' + x.turno) + '</option>';
    }).join('');
}

// Selezionando un tuo turno riempio calendario + turno (e la sala nella nota).
function pescaCede(i){
  var x = lastTurni[i];
  if (!x){ return; }
  el('cedeDate').value = x.data; // formato YYYY-MM-DD = valore dell'input date
  el('cedeTurno').value = turnoLabel(x.turno);
  if (!el('nota').value && x.sala){ el('nota').value = x.sala; }
}

function turnoLabel(t){
  t = String(t || '').toUpperCase();
  return t === 'MATTINA' ? 'Mattina' : t === 'POMERIGGIO' ? 'Pomeriggio' : t === 'NOTTE' ? 'Notte' : '';
}

// "2026-08-09" -> "09/08/2026"
function itDate(s){
  var p = String(s || '').split('-');
  return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : (s || '');
}

function composeShift(dateVal, turnoVal){
  var parts = [];
  if (dateVal) { parts.push(itDate(dateVal)); }
  if (turnoVal) { parts.push(turnoVal); }
  return parts.join(' · ');
}

function msgCambio(t, ok){
  var m = el('cambioMsg'); m.textContent = t; m.hidden = false;
  m.className = 'msg ' + (ok ? 'ok' : 'bad');
}

function inviaCambio(){
  var richiedente = el('nome').value;
  if (!richiedente){ msgCambio('Scegli prima il tuo nome nella scheda Home.', false); return; }
  var payload = {
    richiedente: richiedente,
    conChi: el('conChi').value.trim(),
    cede: composeShift(el('cedeDate').value, el('cedeTurno').value),
    riceve: composeShift(el('riceveDate').value, el('riceveTurno').value),
    nota: el('nota').value.trim()
  };
  if (!payload.conChi){ msgCambio('Indica con chi fai il cambio.', false); return; }
  if (!payload.cede && !payload.riceve){ msgCambio('Indica almeno un turno (giorno + turno): quello che cedi o quello che ricevi.', false); return; }
  msgCambio('Invio…', true);
  apiPost('registraCambio', payload).then(function(d){
    if (!d || d.ok === false){ msgCambio((d && d.messaggio) || 'Errore', false); return; }
    msgCambio(d.messaggio || 'Richiesta registrata.', true);
    el('conChi').value = ''; el('cedeDate').value = ''; el('cedeTurno').value = '';
    el('riceveDate').value = ''; el('riceveTurno').value = ''; el('nota').value = ''; el('cedePick').value = '';
    caricaCambi();
  }).catch(function(e){
    if (e && e.codice){ vaiACodice(e.messaggio); return; }
    msgCambio('Errore: ' + (e && e.messaggio ? e.messaggio : e), false);
  });
}

function caricaCambi(){
  el('cambiList').innerHTML = '<div class="muted"><span class="spin"></span> Carico…</div>';
  api('cambi', {}).then(function(d){
    var list = (d && d.cambi) || [];
    aggiornaBadgeCambi(list.filter(function(c){ return !c.fatto; }).length);
    if (!list.length){ el('cambiList').innerHTML = '<div class="muted">Nessuna richiesta ancora.</div>'; return; }
    el('cambiList').innerHTML = list.map(function(c){
      var badge = c.fatto ? '<span class="badge done">✅ Fatto</span>'
                          : '<span class="badge todo">⏳ Da fare</span>';
      var sw = (c.cede ? esc(c.cede) : '—') + '  →  ' + (c.riceve ? esc(c.riceve) : '—');
      var azione = isRep()
        ? '<button class="mini ' + (c.fatto ? '' : 'primary') + '" onclick="segnaFatto(' + c.riga + ',' + (c.fatto ? 'false' : 'true') + ')">' +
            (c.fatto ? '↩︎ Segna da fare' : '✓ Segna fatto') + '</button>'
        : '';
      return '<div class="camb"><div class="h">' + esc(c.richiedente) + ' ↔ ' + esc(c.conChi) +
        badge + '</div><div class="sw">' + sw + '</div>' +
        (c.nota ? '<div class="meta">📝 ' + esc(c.nota) + '</div>' : '') +
        '<div class="meta">' + esc(c.data) + '</div>' + azione + '</div>';
    }).join('');
  }).catch(function(e){
    if (e && e.codice){ vaiACodice(e.messaggio); return; }
    el('cambiList').innerHTML = '<div class="msg bad">Errore nel caricare le richieste.</div>';
  });
}

/* ---- Ferie ---- */
function ferieMsg(t, ok){
  var m = el('ferieMsg'); m.textContent = t; m.hidden = false;
  m.className = 'msg ' + (ok ? 'ok' : 'bad');
}

function inviaFerie(){
  var richiedente = el('nome').value;
  if (!richiedente){ ferieMsg('Scegli prima il tuo nome nella scheda Home.', false); return; }
  var dal = el('ferieDal').value, al = el('ferieAl').value;
  if (!dal || !al){ ferieMsg('Scegli le date Dal e Al dal calendario.', false); return; }
  ferieMsg('Invio…', true);
  apiPost('richiediFerie', { richiedente: richiedente, dal: dal, al: al, nota: el('ferieNota').value.trim() })
    .then(function(d){
      if (!d || d.ok === false){ ferieMsg((d && d.messaggio) || 'Errore', false); return; }
      ferieMsg(d.messaggio || 'Richiesta inviata.', true);
      el('ferieDal').value = ''; el('ferieAl').value = ''; el('ferieNota').value = '';
      caricaFerie();
    }).catch(function(e){
      if (e && e.codice){ vaiACodice(e.messaggio); return; }
      ferieMsg('Errore: ' + (e && e.messaggio ? e.messaggio : e), false);
    });
}

function caricaFerie(){
  el('ferieList').innerHTML = '<div class="muted"><span class="spin"></span> Carico…</div>';
  api('ferieRichieste', {}).then(function(d){
    var list = (d && d.richieste) || [];
    aggiornaBadgeFerie(list.filter(function(x){ return String(x.stato || '').toUpperCase().indexOf('ATTESA') >= 0; }).length);
    if (!list.length){ el('ferieList').innerHTML = '<div class="muted">Nessuna richiesta ancora.</div>'; return; }
    el('ferieList').innerHTML = list.map(function(x){
      var st = String(x.stato || '').toUpperCase();
      var badge = st.indexOf('APPROV') >= 0 ? '<span class="badge done">✅ Approvata</span>'
                : st.indexOf('RIFIUT') >= 0 ? '<span class="badge todo">✖︎ Rifiutata</span>'
                                            : '<span class="badge todo">⏳ In attesa</span>';
      var azioni = (isRep() && st.indexOf('ATTESA') >= 0)
        ? '<div class="two"><button class="mini primary" onclick="approvaFerie(' + x.riga + ')">✓ Approva</button>' +
          '<button class="mini" onclick="rifiutaFerie(' + x.riga + ')">✖︎ Rifiuta</button></div>'
        : '';
      return '<div class="camb"><div class="h">' + esc(x.richiedente) + badge + '</div>' +
        '<div class="sw">' + esc(x.dal) + ' → ' + esc(x.al) + ' · ' + esc(String(x.giorni)) + ' gg</div>' +
        (x.nota ? '<div class="meta">📝 ' + esc(x.nota) + '</div>' : '') +
        (x.esito ? '<div class="meta">' + esc(x.esito) + '</div>' : '') +
        '<div class="meta">' + esc(x.data) + '</div>' + azioni + '</div>';
    }).join('');
  }).catch(function(e){
    if (e && e.codice){ vaiACodice(e.messaggio); return; }
    el('ferieList').innerHTML = '<div class="msg bad">Errore nel caricare le richieste.</div>';
  });
}

function approvaFerie(riga){
  if (!confirm('Approvare e scrivere le ferie nel foglio ufficiale?')){ return; }
  apiPost('approvaFerie', { riga: riga, repCode: localStorage.getItem(K_REP) || '' }).then(function(d){
    if (!d || d.ok === false){ alert((d && d.messaggio) || 'Errore'); return; }
    alert(d.messaggio || 'Approvata.'); caricaFerie();
  }).catch(function(e){
    if (e && e.codice){ vaiACodice(e.messaggio); return; }
    alert('Errore di collegamento.');
  });
}

function rifiutaFerie(riga){
  if (!confirm('Rifiutare la richiesta? (nessuna scrittura sul foglio ferie)')){ return; }
  apiPost('rifiutaFerie', { riga: riga, repCode: localStorage.getItem(K_REP) || '' }).then(function(d){
    if (!d || d.ok === false){ alert((d && d.messaggio) || 'Errore'); return; }
    caricaFerie();
  }).catch(function(e){
    if (e && e.codice){ vaiACodice(e.messaggio); return; }
    alert('Errore di collegamento.');
  });
}

/* ---- Service worker + avvio ---- */
if ('serviceWorker' in navigator){
  window.addEventListener('load', function(){
    navigator.serviceWorker.register('sw.js').catch(function(){});
  });
}
boot();
