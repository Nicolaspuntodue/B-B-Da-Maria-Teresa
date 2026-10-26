// node src/sun.test.js
import assert from 'node:assert/strict';
import { sunTimes, lightAt, romeTime } from './sun.js';

const hm = (ms) => romeTime(ms);
const between = (ms, a, b) => assert.ok(hm(ms) >= a && hm(ms) <= b, `${hm(ms)} not in ${a}–${b}`);

// Maratea, summer solstice (CEST): sunrise ~05:30, sunset ~20:25
const june = sunTimes(new Date(Date.UTC(2026, 5, 21, 12)));
between(june.rise, '05:20', '05:40');
between(june.set, '20:15', '20:35');
// winter solstice (CET): sunrise ~07:20, sunset ~16:40
const dec = sunTimes(new Date(Date.UTC(2026, 11, 21, 12)));
between(dec.rise, '07:10', '07:30');
between(dec.set, '16:30', '16:50');

assert.equal(lightAt(Date.UTC(2026, 5, 21, 10)), 'giorno');   // 12:00 in Rome
assert.equal(lightAt(Date.UTC(2026, 5, 21, 23)), 'notte');    // 01:00
assert.equal(lightAt(Date.UTC(2026, 5, 21, 3, 40)), 'alba'); // 05:40
assert.equal(lightAt(Date.UTC(2026, 5, 21, 17, 55)), 'tramonto'); // 19:55
console.log('sun ok');
