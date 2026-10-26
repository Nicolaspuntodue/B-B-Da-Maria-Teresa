// Direct-booking rates for the double room (EUR per night). Single place to edit prices.
// ponytail: sample seasonal table (to confirm with the family), swap for a booking engine / Stripe checkout when it goes live.
export const RATES = {
  byMonth: [70, 70, 70, 80, 80, 90, 110, 110, 90, 80, 70, 70], // Jan..Dec
  maxGuests: 2,
  minNights: 1,
};

const DAY = 86400000;
const toUTC = (iso) => { const [y, m, d] = iso.split('-').map(Number); return Date.UTC(y, m - 1, d); };

export const rateFor = (utc) => RATES.byMonth[new Date(utc).getUTCMonth()];

// quote('2026-11-12', '2026-11-14') -> { nights: 2, total: 140, perNight: [70, 70] } or { error }
export function quote(checkin, checkout, guests = 2) {
  if (!checkin || !checkout) return { error: 'Scegliete le date' };
  const a = toUTC(checkin), b = toUTC(checkout);
  const nights = Math.round((b - a) / DAY);
  if (!(nights >= RATES.minNights)) return { error: 'Il check-out deve essere dopo il check-in' };
  if (guests < 1 || guests > RATES.maxGuests) return { error: `Massimo ${RATES.maxGuests} ospiti per camera` };
  const perNight = Array.from({ length: nights }, (_, i) => rateFor(a + i * DAY));
  return { nights, perNight, total: perNight.reduce((s, r) => s + r, 0) };
}
