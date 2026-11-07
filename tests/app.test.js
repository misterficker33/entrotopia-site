'use strict';
const assert = require('node:assert/strict');
const { normalizeLead, stats, filterLeads, sortLeads, toCsv } = require('../public/app.js');

const leads = [
  normalizeLead({ id: '1', name: 'Alpha', status: 'new', followUp: '2026-11-07', value: '1250,50', note: 'Fenster' }),
  normalizeLead({ id: '2', name: 'Beta', status: 'won', followUp: '2026-11-08', value: 3000, note: 'Dach' }),
  normalizeLead({ id: '3', name: 'Gamma', status: 'lost', followUp: '2026-11-06', value: 500 })
];

assert.equal(leads[0].value, 1250.5);
assert.deepEqual(stats(leads, '2026-11-07'), { open: 2, due: 1, value: 1250.5, won: 3000 });
assert.deepEqual(filterLeads(leads, 'fenster', 'all').map(item => item.id), ['1']);
assert.deepEqual(filterLeads(leads, '', 'due', '2026-11-07').map(item => item.id), ['1']);
assert.deepEqual(sortLeads(leads, 'value').map(item => item.id), ['2', '1', '3']);
assert.match(toCsv(leads), /"Alpha"/);
assert.match(toCsv([normalizeLead({ name: 'A;B', note: 'Er sagt "ja"' })]), /"Er sagt ""ja"""/);
console.log('app tests: ok');
