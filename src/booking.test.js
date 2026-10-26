// node src/booking.test.js
import assert from 'node:assert/strict';
import { quote } from './booking.js';

assert.deepEqual(quote('2026-11-12', '2026-11-14'), { nights: 2, perNight: [70, 70], total: 140 });
// crosses into August: 31 Jul + 1 Aug, both high season
assert.equal(quote('2026-07-31', '2026-08-02').total, 220);
// 30 Jun (90) + 1 Jul (110)
assert.equal(quote('2026-06-30', '2026-07-02').total, 200);
// DST change in late March must not change the night count
assert.equal(quote('2027-03-27', '2027-03-29').nights, 2);
assert.ok(quote('2026-11-14', '2026-11-14').error);
assert.ok(quote('2026-11-14', '2026-11-12').error);
assert.ok(quote('2026-11-12', '2026-11-14', 3).error);
assert.ok(quote('', '2026-11-14').error);
console.log('booking ok');
