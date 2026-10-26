// Sunrise / sunset for the B&B (Via Sorgimpiano, Maratea) and the "light of the day" the hero is graded with.
// NOAA low-precision formulas: good to a couple of minutes, plenty for choosing a sky.
export const MARATEA = { lat: 40.0032, lon: 15.7221 };
const RAD = Math.PI / 180;

// sunTimes(date) -> { rise, set } as epoch ms (UTC instants)
export function sunTimes(date = new Date(), { lat, lon } = MARATEA) {
  const y = date.getUTCFullYear(), m = date.getUTCMonth(), d = date.getUTCDate();
  const midnight = Date.UTC(y, m, d);
  const day = (midnight - Date.UTC(y, 0, 0)) / 864e5;
  const g = (2 * Math.PI / 365) * (day - 1);
  const eqt = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g)
    + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  const ha = Math.acos(Math.cos(90.833 * RAD) / (Math.cos(lat * RAD) * Math.cos(decl)) - Math.tan(lat * RAD) * Math.tan(decl)) / RAD;
  return {
    rise: midnight + (720 - 4 * (lon + ha) - eqt) * 60000,
    set: midnight + (720 - 4 * (lon - ha) - eqt) * 60000,
  };
}

// The four lights of the hero, in shader order: night, dawn, day, dusk.
export const LIGHTS = ['notte', 'alba', 'giorno', 'tramonto'];

// Which light the gulf has at `now`: dawn and dusk last about an hour around the sun's edge.
export function lightAt(now = Date.now()) {
  const { rise, set } = sunTimes(new Date(now));
  const H = 3600000;
  if (now < rise - 0.6 * H || now > set + 0.75 * H) return 'notte';
  if (now < rise + 0.75 * H) return 'alba';
  if (now > set - 0.9 * H) return 'tramonto';
  return 'giorno';
}

const clock = new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit' });
export const romeTime = (ms) => clock.format(ms);
