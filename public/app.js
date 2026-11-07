(function (root) {
  'use strict';

  const STORAGE_KEY = 'entrotopia.leads.v1';
  const STATUSES = {
    new: 'Neu', callback: 'Rückruf', quote: 'Angebot', won: 'Auftrag', done: 'Abgeschlossen', lost: 'Abgesagt'
  };
  const CLOSED = new Set(['done', 'lost']);

  function cleanText(value, max) { return String(value ?? '').trim().slice(0, max); }
  function cleanMoney(value) {
    const number = Number(String(value ?? '').replace(',', '.'));
    return Number.isFinite(number) && number >= 0 ? Math.min(number, 99999999) : 0;
  }
  function makeId() {
    return globalThis.crypto?.randomUUID?.() || `lead-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
  function normalizeLead(input) {
    const now = new Date().toISOString();
    const status = Object.hasOwn(STATUSES, input?.status) ? input.status : 'new';
    return {
      id: cleanText(input?.id, 100) || makeId(),
      name: cleanText(input?.name, 100),
      channel: cleanText(input?.channel, 40) || 'Telefon',
      contact: cleanText(input?.contact, 140),
      status,
      followUp: /^\d{4}-\d{2}-\d{2}$/.test(input?.followUp || '') ? input.followUp : '',
      value: cleanMoney(input?.value),
      note: cleanText(input?.note, 1000),
      lastActionAt: cleanText(input?.lastActionAt, 40),
      activityCount: Math.max(0, Math.floor(Number(input?.activityCount) || 0)),
      createdAt: cleanText(input?.createdAt, 40) || now,
      updatedAt: cleanText(input?.updatedAt, 40) || now
    };
  }
  function todayLocal(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  function dayNumber(value) {
    const [year, month, day] = String(value).split('-').map(Number);
    return Number.isFinite(year + month + day) ? Date.UTC(year, month - 1, day) / 86400000 : 0;
  }
  function addDaysLocal(value, days) {
    const [year, month, day] = String(value).split('-').map(Number);
    const date = new Date(year, month - 1, day + days);
    return todayLocal(date);
  }
  function snoozeLead(item, today = todayLocal(), days = 3, now = new Date().toISOString()) {
    return normalizeLead({ ...item, followUp: addDaysLocal(today, days), lastActionAt: now, activityCount: (item.activityCount || 0) + 1, updatedAt: now });
  }
  function riskFor(item, today = todayLocal()) {
    if (!['new', 'callback', 'quote'].includes(item.status)) return { score: 0, level: 'none', reason: '', action: '' };
    let score = 0;
    const reasons = [];
    if (!item.followUp) {
      score += 25; reasons.push('Keine Wiedervorlage gesetzt');
    } else {
      const overdue = dayNumber(today) - dayNumber(item.followUp);
      if (overdue > 0) { score += 50 + Math.min(20, overdue * 4); reasons.push(overdue === 1 ? 'Seit gestern überfällig' : `Seit ${overdue} Tagen überfällig`); }
      else if (overdue === 0) { score += 40; reasons.push('Heute fällig'); }
      else if (overdue >= -2) { score += 15; reasons.push('In Kürze fällig'); }
    }
    if (item.status === 'quote') { score += 25; reasons.push('Offenes Angebot'); }
    if (item.status === 'callback') { score += 15; reasons.push('Rückruf offen'); }
    if (item.status === 'new') score += 5;
    if (item.value >= 1000) score += 10;
    if (item.value >= 5000) score += 10;
    score = Math.min(100, score);
    const action = item.status === 'quote' ? 'Angebot nachfassen' : item.status === 'callback' ? 'Rückruf erledigen' : 'Erstkontakt aufnehmen';
    return { score, level: score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low', reason: reasons.slice(0, 2).join(' · '), action };
  }
  function prioritizeRisks(leads, today = todayLocal()) {
    return leads.map(item => ({ item, risk: riskFor(item, today) }))
      .filter(entry => entry.risk.score >= 40)
      .sort((a, b) => b.risk.score - a.risk.score || b.item.value - a.item.value);
  }
  function followUpMessage(item) {
    if (item.status === 'quote') return 'Guten Tag, ich wollte kurz nachfragen, ob zu unserem Angebot noch Fragen offen sind. Gerne klären wir die nächsten Schritte.';
    if (item.status === 'callback') return 'Guten Tag, ich melde mich wie besprochen zu Ihrer Anfrage. Wann passt Ihnen ein kurzer Rückruf?';
    if (item.status === 'won') return 'Guten Tag, vielen Dank für Ihren Auftrag. Wir melden uns zur Abstimmung des nächsten Termins.';
    return 'Guten Tag, vielen Dank für Ihre Anfrage. Wir prüfen Ihr Anliegen und melden uns zeitnah bei Ihnen.';
  }
  function stats(leads, today = todayLocal()) {
    const open = leads.filter(item => !CLOSED.has(item.status));
    return {
      open: open.length,
      due: open.filter(item => item.followUp && item.followUp <= today).length,
      value: leads.filter(item => ['new', 'callback', 'quote'].includes(item.status)).reduce((sum, item) => sum + cleanMoney(item.value), 0),
      won: leads.filter(item => item.status === 'won').reduce((sum, item) => sum + cleanMoney(item.value), 0)
    };
  }
  function filterLeads(leads, query, status, today = todayLocal()) {
    const needle = cleanText(query, 200).toLocaleLowerCase('de');
    return leads.filter(item => {
      const text = `${item.name} ${item.channel} ${item.contact} ${item.note}`.toLocaleLowerCase('de');
      if (needle && !text.includes(needle)) return false;
      if (status === 'all') return true;
      if (status === 'risk') return riskFor(item, today).score >= 40;
      if (status === 'open') return !CLOSED.has(item.status);
      if (status === 'due') return !CLOSED.has(item.status) && item.followUp && item.followUp <= today;
      return item.status === status;
    });
  }
  function sortLeads(leads, mode) {
    const result = [...leads];
    if (mode === 'risk') return result.sort((a, b) => riskFor(b).score - riskFor(a).score || b.value - a.value);
    if (mode === 'followUp') return result.sort((a, b) => (a.followUp || '9999').localeCompare(b.followUp || '9999'));
    if (mode === 'value') return result.sort((a, b) => b.value - a.value);
    if (mode === 'name') return result.sort((a, b) => a.name.localeCompare(b.name, 'de'));
    return result.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  function csvCell(value) { return `"${String(value ?? '').replaceAll('"', '""')}"`; }
  function toCsv(leads) {
    const headings = ['ID', 'Name/Firma', 'Kontaktkanal', 'Kontakt', 'Status', 'Wiedervorlage', 'Wert EUR', 'Notiz', 'Nachfassaktionen', 'Letzte Aktion', 'Erstellt', 'Geändert'];
    const rows = leads.map(item => [item.id, item.name, item.channel, item.contact, STATUSES[item.status], item.followUp, item.value.toFixed(2), item.note, item.activityCount, item.lastActionAt, item.createdAt, item.updatedAt]);
    return '\ufeff' + [headings, ...rows].map(row => row.map(csvCell).join(';')).join('\r\n');
  }

  const api = { normalizeLead, todayLocal, stats, filterLeads, sortLeads, csvCell, toCsv, riskFor, prioritizeRisks, followUpMessage, snoozeLead, STATUSES };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof document === 'undefined') return;

  const el = id => document.getElementById(id);
  const money = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
  const dateFormat = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  let leads = load();
  let toastTimer;
  let installPrompt = null;

  function load() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(parsed) ? parsed.map(normalizeLead).filter(item => item.name) : [];
    } catch { return []; }
  }
  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(leads));
    render();
  }
  function toast(message, error = false) {
    clearTimeout(toastTimer); el('toast').textContent = message; el('toast').className = `toast show${error ? ' error' : ''}`;
    toastTimer = setTimeout(() => { el('toast').className = 'toast'; }, 2800);
  }
  function safeDate(value) {
    if (!value) return '';
    const [y, m, d] = value.split('-').map(Number);
    return dateFormat.format(new Date(y, m - 1, d));
  }
  function render() {
    const totals = stats(leads);
    el('metric-open').textContent = totals.open;
    el('metric-due').textContent = totals.due;
    el('metric-value').textContent = money.format(totals.value);
    el('metric-won').textContent = money.format(totals.won);
    renderRisks();
    const visible = sortLeads(filterLeads(leads, el('search').value, el('filter-status').value), el('sort').value);
    el('result-count').textContent = `${visible.length} ${visible.length === 1 ? 'Eintrag' : 'Einträge'}`;
    el('lead-list').replaceChildren(...visible.map(card));
    el('empty-state').classList.toggle('hidden', leads.length !== 0 || visible.length !== 0);
    if (leads.length && !visible.length) {
      const empty = document.createElement('div'); empty.className = 'empty'; empty.innerHTML = '<strong>Keine Treffer.</strong><p>Ändere Suche oder Filter.</p>'; el('lead-list').append(empty);
    }
  }
  function renderRisks() {
    const entries = prioritizeRisks(leads);
    const endangered = entries.reduce((sum, entry) => sum + entry.item.value, 0);
    el('risk-value').textContent = money.format(endangered);
    el('risk-summary').textContent = entries.length ? `${entries.length} ${entries.length === 1 ? 'Vorgang braucht' : 'Vorgänge brauchen'} jetzt Aufmerksamkeit.` : 'Noch keine gefährdeten Vorgänge.';
    el('risk-list').replaceChildren(...entries.slice(0, 3).map(riskCard));
    el('risk-empty').classList.toggle('hidden', entries.length !== 0);
  }
  function riskCard({ item, risk }) {
    const article = document.createElement('article'); article.className = 'risk-item';
    const top = document.createElement('div'); top.className = 'risk-top';
    const name = document.createElement('strong'); name.textContent = item.name;
    const level = document.createElement('span'); level.className = `risk-level ${risk.level}`; level.textContent = risk.level === 'high' ? 'HOCH' : 'ACHTUNG';
    top.append(name, level);
    const reason = document.createElement('p'); reason.className = 'risk-reason'; reason.textContent = `${risk.reason}${item.value ? ` · ${money.format(item.value)}` : ''}`;
    const action = document.createElement('p'); action.className = 'risk-action'; action.textContent = `Nächster Schritt: ${risk.action}`;
    const buttons = document.createElement('div'); buttons.className = 'risk-buttons';
    const copy = document.createElement('button'); copy.type = 'button'; copy.textContent = 'Text kopieren'; copy.addEventListener('click', () => copyFollowUp(item));
    const done = document.createElement('button'); done.type = 'button'; done.className = 'done-action'; done.textContent = 'Nachgefasst · +3 Tage'; done.addEventListener('click', () => recordFollowUp(item));
    const open = document.createElement('button'); open.type = 'button'; open.textContent = 'Öffnen'; open.addEventListener('click', () => beginEdit(item));
    buttons.append(copy, done, open); article.append(top, reason, action, buttons); return article;
  }
  function card(item) {
    const article = document.createElement('article'); article.className = 'lead-card';
    const main = document.createElement('div'); main.className = 'lead-main';
    const top = document.createElement('div'); top.className = 'lead-top';
    const title = document.createElement('h3'); title.textContent = item.name;
    const pill = document.createElement('span'); pill.className = `status-pill ${item.status}`; pill.textContent = STATUSES[item.status];
    top.append(title, pill);
    const risk = riskFor(item);
    if (risk.score >= 40) { const warning = document.createElement('span'); warning.className = `risk-badge ${risk.level}`; warning.textContent = `Risiko ${risk.score}`; top.append(warning); }
    main.append(top);
    if (item.contact || item.channel) { const contact = document.createElement('p'); contact.className = 'lead-contact'; contact.textContent = [item.channel, item.contact].filter(Boolean).join(' · '); main.append(contact); }
    if (item.note) { const note = document.createElement('p'); note.className = 'lead-note'; note.textContent = item.note; main.append(note); }
    const meta = document.createElement('div'); meta.className = 'lead-meta';
    if (item.followUp) { const due = document.createElement('span'); const today = todayLocal(); due.className = item.followUp < today && !CLOSED.has(item.status) ? 'overdue' : item.followUp === today && !CLOSED.has(item.status) ? 'due' : ''; due.textContent = `Wiedervorlage: ${safeDate(item.followUp)}`; meta.append(due); }
    if (item.value) { const value = document.createElement('span'); value.textContent = `Wert: ${money.format(item.value)}`; meta.append(value); }
    if (item.activityCount) { const activity = document.createElement('span'); activity.textContent = `Nachgefasst: ${item.activityCount}×`; meta.append(activity); }
    main.append(meta);
    const actions = document.createElement('div'); actions.className = 'card-actions';
    const edit = document.createElement('button'); edit.className = 'icon-button'; edit.type = 'button'; edit.textContent = 'Bearbeiten'; edit.addEventListener('click', () => beginEdit(item));
    const remove = document.createElement('button'); remove.className = 'icon-button danger'; remove.type = 'button'; remove.textContent = 'Löschen'; remove.setAttribute('aria-label', `${item.name} löschen`); remove.addEventListener('click', () => deleteLead(item));
    actions.append(edit, remove); article.append(main, actions); return article;
  }
  function beginEdit(item) {
    el('lead-id').value = item.id; el('name').value = item.name; el('channel').value = item.channel; el('contact').value = item.contact; el('status').value = item.status; el('follow-up').value = item.followUp; el('value').value = item.value || ''; el('note').value = item.note;
    el('form-title').textContent = 'Vorgang bearbeiten'; el('save-button').textContent = 'Änderungen speichern'; el('cancel-edit').classList.remove('hidden'); updateNoteCount(); el('editor').scrollIntoView({ behavior: 'smooth', block: 'start' }); el('name').focus({ preventScroll: true });
  }
  function resetForm() {
    el('lead-form').reset(); el('lead-id').value = ''; el('form-title').textContent = 'Interessent anlegen'; el('save-button').textContent = 'Interessent speichern'; el('cancel-edit').classList.add('hidden'); updateNoteCount();
  }
  function deleteLead(item) {
    if (!confirm(`„${item.name}“ wirklich löschen?`)) return;
    leads = leads.filter(entry => entry.id !== item.id); save(); toast('Eintrag gelöscht.');
  }
  function download(name, contents, type) {
    const url = URL.createObjectURL(new Blob([contents], { type })); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function copyFollowUp(item) {
    const text = followUpMessage(item);
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
      else {
        const area = document.createElement('textarea'); area.value = text; area.style.position = 'fixed'; area.style.opacity = '0'; document.body.append(area); area.select(); document.execCommand('copy'); area.remove();
      }
      toast('Nachfass-Text wurde kopiert.');
    } catch { toast('Text konnte nicht kopiert werden.', true); }
  }
  function recordFollowUp(item) {
    const updated = snoozeLead(item);
    leads = leads.map(entry => entry.id === item.id ? updated : entry);
    save();
    toast(`Nachfassen verbucht. Neue Wiedervorlage: ${safeDate(updated.followUp)}.`);
  }
  function backupName(extension) { return `entrotopia-anfragen-${todayLocal()}.${extension}`; }
  function updateNoteCount() { el('note-count').textContent = el('note').value.length; }
  function updateConnection() {
    const online = navigator.onLine;
    el('connection-state').textContent = online ? 'Online' : 'Offline';
    el('connection-state').className = `connection ${online ? 'online' : 'offline'}`;
  }

  el('lead-form').addEventListener('submit', event => {
    event.preventDefault();
    const id = el('lead-id').value; const existing = leads.find(item => item.id === id); const now = new Date().toISOString();
    const item = normalizeLead({ id, name: el('name').value, channel: el('channel').value, contact: el('contact').value, status: el('status').value, followUp: el('follow-up').value, value: el('value').value, note: el('note').value, lastActionAt: existing?.lastActionAt, activityCount: existing?.activityCount, createdAt: existing?.createdAt || now, updatedAt: now });
    if (!item.name) { toast('Bitte Name oder Firma eintragen.', true); return; }
    if (existing) leads = leads.map(entry => entry.id === id ? item : entry); else leads.unshift(item);
    save(); resetForm(); toast(existing ? 'Änderungen gespeichert.' : 'Interessent angelegt.');
  });
  el('cancel-edit').addEventListener('click', resetForm); el('note').addEventListener('input', updateNoteCount);
  ['search', 'filter-status', 'sort'].forEach(id => el(id).addEventListener(id === 'search' ? 'input' : 'change', render));
  el('export-csv').addEventListener('click', () => { if (!leads.length) return toast('Es gibt noch keine Daten zum Exportieren.', true); download(backupName('csv'), toCsv(leads), 'text/csv;charset=utf-8'); toast('CSV wurde erstellt.'); });
  el('export-json').addEventListener('click', () => { if (!leads.length) return toast('Es gibt noch keine Daten zum Sichern.', true); download(backupName('json'), JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), leads }, null, 2), 'application/json'); toast('Sicherung wurde erstellt.'); });
  el('import-json').addEventListener('change', async event => {
    const file = event.target.files[0]; event.target.value = ''; if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()); const rows = Array.isArray(parsed) ? parsed : parsed.leads;
      if (!Array.isArray(rows)) throw new Error('format');
      const imported = rows.map(normalizeLead).filter(item => item.name);
      if (!imported.length) throw new Error('empty');
      if (leads.length && !confirm(`${imported.length} Einträge einlesen und die aktuellen Daten ersetzen?`)) return;
      leads = imported; save(); resetForm(); toast(`${imported.length} Einträge eingelesen.`);
    } catch { toast('Diese Datei ist keine gültige ENTROTOPIA-Sicherung.', true); }
  });
  el('load-demo').addEventListener('click', () => {
    const today = new Date(); const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
    leads = [normalizeLead({ name: 'Beispiel Schreinerei', channel: 'Telefon', contact: '0123 456789', status: 'callback', followUp: todayLocal(), value: 850, note: 'Rückruf wegen Einbauschrank. Maße und Termin klären.' }), normalizeLead({ name: 'Muster Hausverwaltung', channel: 'E-Mail', contact: 'beispiel@example.invalid', status: 'quote', followUp: todayLocal(yesterday), value: 2400, note: 'Angebot für Reparatur versandt. Nur Beispieldaten.' })];
    save(); toast('Zwei Beispieldatensätze wurden geladen.');
  });
  window.addEventListener('online', updateConnection);
  window.addEventListener('offline', updateConnection);
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault(); installPrompt = event; el('install-app').classList.remove('hidden');
  });
  el('install-app').addEventListener('click', async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    installPrompt = null; el('install-app').classList.add('hidden');
    if (choice.outcome === 'accepted') toast('ENTROTOPIA wird installiert.');
  });
  window.addEventListener('appinstalled', () => { installPrompt = null; el('install-app').classList.add('hidden'); toast('ENTROTOPIA wurde installiert.'); });
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => toast('Offline-Modus konnte nicht aktiviert werden.', true));
  render(); updateNoteCount(); updateConnection();
})(typeof globalThis !== 'undefined' ? globalThis : this);
