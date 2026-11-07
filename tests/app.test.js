'use strict';
const assert = require('node:assert/strict');
const { normalizeLead, stats, filterLeads, sortLeads, toCsv, riskFor, prioritizeRisks, followUpMessage, snoozeLead, extractLead } = require('../public/app.js');

const leads = [
  normalizeLead({ id: '1', name: 'Alpha', status: 'new', followUp: '2026-11-07', value: '1250,50', note: 'Fenster' }),
  normalizeLead({ id: '2', name: 'Beta', status: 'won', followUp: '2026-11-08', value: 3000, note: 'Dach' }),
  normalizeLead({ id: '3', name: 'Gamma', status: 'lost', followUp: '2026-11-06', value: 500 })
];

assert.equal(leads[0].value, 1250.5);
assert.deepEqual(stats(leads, '2026-11-07'), { open: 2, due: 1, value: 1250.5, won: 3000 });
assert.deepEqual(filterLeads(leads, 'fenster', 'all').map(item => item.id), ['1']);
assert.deepEqual(filterLeads(leads, '', 'due', '2026-11-07').map(item => item.id), ['1']);
assert.deepEqual(filterLeads(leads, '', 'risk', '2026-11-07').map(item => item.id), ['1']);
assert.deepEqual(sortLeads(leads, 'value').map(item => item.id), ['2', '1', '3']);
assert.deepEqual(riskFor(leads[0], '2026-11-07'), { score: 55, level: 'medium', reason: 'Heute fällig', action: 'Erstkontakt aufnehmen' });
const riskyQuote = normalizeLead({ id: '4', name: 'Delta', status: 'quote', followUp: '2026-11-06', value: 2400 });
assert.deepEqual(riskFor(riskyQuote, '2026-11-07'), { score: 89, level: 'high', reason: 'Seit gestern überfällig · Offenes Angebot', action: 'Angebot nachfassen' });
assert.deepEqual(prioritizeRisks([...leads, riskyQuote], '2026-11-07').map(entry => entry.item.id), ['4', '1']);
assert.match(followUpMessage(riskyQuote), /Angebot/);
const snoozed = snoozeLead(riskyQuote, '2026-11-07', 3, '2026-11-07T12:00:00.000Z');
assert.equal(snoozed.followUp, '2026-11-10');
assert.equal(snoozed.activityCount, 1);
assert.equal(snoozed.lastActionAt, '2026-11-07T12:00:00.000Z');
assert.equal(riskFor(snoozed, '2026-11-07').score, 35);
const captured = extractLead('Hallo, ich bin Max Mustermann. Bitte Angebot über 1.500 €. E-Mail: max@example.de, Telefon 0123 456789.', '2026-11-07');
assert.equal(captured.name, 'Max Mustermann');
assert.equal(captured.channel, 'E-Mail');
assert.equal(captured.contact, 'max@example.de');
assert.equal(captured.value, 1500);
assert.equal(captured.followUp, '2026-11-07');
assert.match(captured.note, /Bitte Angebot/);
assert.match(toCsv(leads), /"Alpha"/);
assert.match(toCsv([normalizeLead({ name: 'A;B', note: 'Er sagt "ja"' })]), /"Er sagt ""ja"""/);
console.log('app tests: ok');
