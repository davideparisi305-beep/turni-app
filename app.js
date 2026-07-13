/* Turni III — PWA frontend.
 * Parla con l'API Apps Script (WebApi.js) via GET semplici (nessun header
 * custom → nessun preflight CORS). L'accesso è protetto dal codice condiviso:
 * l'URL da solo non basta a leggere i dati. */

// URL /exec della web app (deployment anonimo protetto dal codice condiviso).
var API_BASE = 'https://script.google.com/macros/s/AKfycbzj4wCgMtsKajOdXttH7ghkXfQkSjAgjfvkPaNbkUcX29oMZ35Md_u0OZsgy4LlPo7B/exec';

var K_CODE = 'turni3_code';
var K_NOME = 'turni3_nome';
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
  var st = d.stato || {};
  el('foot').textContent = 'Periodo ' + (st.periodo ? st.periodo.inizio + ' → ' + st.periodo.fine : '') +
    (st.ultimoAggiornamento ? ' · agg. ' + st.ultimoAggiornamento : '');
}

/* ---- Cambi 1-1 ---- */
function tab(which){
  var home = which === 'home';
  show('tabHome', home); show('tabCambi', !home);
  el('tabBtnHome').classList.toggle('active', home);
  el('tabBtnCambi').classList.toggle('active', !home);
  if (!home){ popolaCede(); caricaCambi(); }
}

function popolaCede(){
  var sel = el('cedePick');
  sel.innerHTML = '<option value="">— pesca dai tuoi turni —</option>' +
    lastTurni.map(function(x){
      return '<option>' + esc(x.etichetta + ' · ' + x.sala + ' / ' + x.turno) + '</option>';
    }).join('');
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
    cede: el('cede').value.trim(),
    riceve: el('riceve').value.trim(),
    nota: el('nota').value.trim()
  };
  if (!payload.conChi){ msgCambio('Indica con chi fai il cambio.', false); return; }
  if (!payload.cede && !payload.riceve){ msgCambio('Indica almeno un turno (che cedi o che ricevi).', false); return; }
  msgCambio('Invio…', true);
  apiPost('registraCambio', payload).then(function(d){
    if (!d || d.ok === false){ msgCambio((d && d.messaggio) || 'Errore', false); return; }
    msgCambio(d.messaggio || 'Richiesta registrata.', true);
    el('conChi').value = ''; el('cede').value = ''; el('riceve').value = '';
    el('nota').value = ''; el('cedePick').value = '';
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
    if (!list.length){ el('cambiList').innerHTML = '<div class="muted">Nessuna richiesta ancora.</div>'; return; }
    el('cambiList').innerHTML = list.map(function(c){
      var badge = c.fatto ? '<span class="badge done">✅ Fatto</span>'
                          : '<span class="badge todo">⏳ Da fare</span>';
      var sw = (c.cede ? esc(c.cede) : '—') + '  →  ' + (c.riceve ? esc(c.riceve) : '—');
      return '<div class="camb"><div class="h">' + esc(c.richiedente) + ' ↔ ' + esc(c.conChi) +
        badge + '</div><div class="sw">' + sw + '</div>' +
        (c.nota ? '<div class="meta">📝 ' + esc(c.nota) + '</div>' : '') +
        '<div class="meta">' + esc(c.data) + '</div></div>';
    }).join('');
  }).catch(function(e){
    if (e && e.codice){ vaiACodice(e.messaggio); return; }
    el('cambiList').innerHTML = '<div class="msg bad">Errore nel caricare le richieste.</div>';
  });
}

/* ---- Service worker + avvio ---- */
if ('serviceWorker' in navigator){
  window.addEventListener('load', function(){
    navigator.serviceWorker.register('sw.js').catch(function(){});
  });
}
boot();
