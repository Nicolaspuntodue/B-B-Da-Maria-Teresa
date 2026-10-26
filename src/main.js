import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { quote } from './booking.js';
import { sunTimes, lightAt, romeTime } from './sun.js';

gsap.registerPlugin(ScrollTrigger);
ScrollTrigger.config({ ignoreMobileResize: true });

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
history.scrollRestoration = 'manual';
scrollTo(0, 0);

/* ---------- smooth scroll ---------- */
let lenis;
if (!reduced) {
  lenis = new Lenis({ lerp: 0.1 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  $$('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
    const t = $(a.getAttribute('href'));
    if (t) { e.preventDefault(); lenis.scrollTo(t, { offset: a.getAttribute('href') === '#top' ? 0 : -8 }); }
  }));
}

/* ---------- live Maratea clock + today's sunset ---------- */
const tick = () => {
  const now = Date.now();
  $$('[data-clock]').forEach((el) => { el.textContent = romeTime(now); });
  $('[data-sunset]').textContent = romeTime(sunTimes(new Date(now)).set);
};
tick();
setInterval(tick, 20000);

/* ---------- hero: the persiane open (signature move), scroll walks out of the window ---------- */
const nowLight = lightAt();
const buttons = $$('.lights button');
const press = (name) => {
  buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.light === name)));
  document.documentElement.dataset.light = name; // the title turns pale under an evening or night sky
};
press(nowLight);
// until the shutters open, the name waits behind them (dark ink on dark wood would be lost)
const root = document.documentElement;
if (!reduced) {
  gsap.set('.hero__title .line > span', { yPercent: 105 });
  gsap.set('.hero__line span, .hero__light, .hero__book', { autoAlpha: 0 });
}
const titleIn = () => gsap.timeline()
  .to('.hero__title .line > span', { yPercent: 0, duration: 1.2, stagger: 0.1, ease: 'expo.out' })
  .to('.hero__line span', { autoAlpha: 1, duration: 0.9, stagger: 0.08, ease: 'power2.out' }, 0.35)
  .to('.hero__light, .hero__book', { autoAlpha: 1, duration: 0.8, stagger: 0.08, ease: 'power2.out' }, 0.65);

// no WebGL (or too slow): the photograph and the name, straight away
let settled = false;
const showStatic = () => {
  if (settled) return;
  settled = true;
  root.classList.add('no-gl');
  if (!reduced) titleIn();
};
const slow = setTimeout(showStatic, 4000);

let gl = null;
import('./gl.js').then(({ initHero }) => {
  // the strip of wall between the bottom of the name and the top of the controls (layout boxes, transforms ignored)
  const band = () => {
    const h1 = $('.hero__title'), ctl = $('.hero__light');
    const gap = innerWidth < 820 ? 14 : 22;
    return { top: h1.offsetTop + h1.offsetHeight + gap, bottom: ctl.offsetTop - gap };
  };
  gl = initHero($('.hero__gl'), { src: '/media/hero.webp', mask: '/media/hero-mask.webp', focus: 0.74, light: nowLight, band });
  document.fonts.ready.then(() => gl.relayout());
  if (import.meta.env.DEV) window.__gl = gl;
  return gl.ready;
}).then(() => {
  clearTimeout(slow);
  buttons.forEach((b) => b.addEventListener('click', () => { gl.setLight(b.dataset.light); press(b.dataset.light); }));
  gsap.to(gl.state, {
    scroll: 1, ease: 'none',
    scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom bottom', scrub: true }, // damped again inside the GL loop
  });
  if (reduced || settled) { gl.state.intro = 1; root.classList.remove('no-gl'); root.classList.add('has-gl'); settled = true; return; }
  settled = true;
  root.classList.add('has-gl');
  // the signature move, unhurried: slats, leaves, a step back; the name rises once the sky is in the window
  lenis?.stop();
  gsap.timeline()
    .to(gl.state, { intro: 1, duration: 3.6, ease: 'power1.inOut' })
    .add(titleIn(), 2.1)
    .add(() => lenis?.start(), 2.7);
}).catch((err) => { console.warn('WebGL off, static hero', err); clearTimeout(slow); showStatic(); });

if (!reduced) {
  gsap.timeline({ scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom bottom', scrub: 0.4 } })
    .to('.hero__copy', { yPercent: -30, opacity: 0, ease: 'none', duration: 0.16 }, 0)
    .to('.hero__light, .hero__book', { opacity: 0, duration: 0.15 }, 0)
    .to({}, { duration: 0.5 });
}

/* ---------- nav: solid once past the hero, pale over the dark grounds ---------- */
const nav = $('.nav');
// solid as soon as the walk out of the window starts (the sea is too dark for ink); pale over the dark chapters and the footer
const chapters = $$('.chapter'), prenota = $('.prenota');
const navState = () => {
  nav.classList.toggle('is-solid', scrollY > innerHeight * 0.3);
  const over = (el) => { const r = el.getBoundingClientRect(); return r.top < 40 && r.bottom > 40; };
  nav.classList.toggle('is-dark', chapters.some(over) || prenota.getBoundingClientRect().bottom < 40);
};
ScrollTrigger.create({ start: 0, end: 'max', onUpdate: navState });
navState();

if (!reduced) {
  /* section entrances: parts arrive in reading order, once */
  $$('[data-rise]').forEach((el) => gsap.from(el, {
    y: 24, opacity: 0, duration: 1, ease: 'power3.out', delay: el.previousElementSibling?.hasAttribute('data-rise') ? 0.08 : 0,
    scrollTrigger: { trigger: el, start: 'top 88%' },
  }));
  $$('[data-reveal]').forEach((el) => {
    gsap.from(el, { clipPath: 'inset(0 0 100% 0)', duration: 1.3, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 85%' } });
    const img = $('img', el) || el;
    gsap.from(img, { scale: 1.08, duration: 1.6, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 85%' } });
  });
  gsap.from('.facts > div', { y: 20, opacity: 0, stagger: 0.07, duration: 0.9, ease: 'power3.out', scrollTrigger: { trigger: '.facts', start: 'top 90%' } });

  /* chapters: the field grows from an inset panel to full-bleed, the picture settles */
  $$('.chapter').forEach((ch) => {
    gsap.timeline({ scrollTrigger: { trigger: ch, start: 'top 75%' } })
      .from(ch, { clipPath: 'inset(20px 20px 20px 20px)', duration: 0.8, ease: 'power3.out', clearProps: 'clipPath' })
      .from($('.chapter__img', ch), { scale: 0.92, opacity: 0, duration: 0.9, ease: 'power3.out' }, 0)
      .from([$('.chapter__title', ch), $('.chapter__text', ch), $('.chapter__link', ch)], { y: 20, opacity: 0, duration: 0.8, stagger: 0.08, ease: 'power3.out' }, 0.15);
    gsap.fromTo($('.chapter__img', ch), { yPercent: 2 }, { yPercent: -2, ease: 'none', scrollTrigger: { trigger: ch, scrub: true } }); // small: the gap to the words stays clear
  });

  /* menu: groups and rows arrive row by row */
  $$('.sheet__group').forEach((g) => gsap.from($$('h3, li', g), {
    y: 16, opacity: 0, stagger: 0.06, duration: 0.7, ease: 'power3.out', scrollTrigger: { trigger: g, start: 'top 88%' },
  }));

  /* Maratea: the pictures drift at their own rates around the heading */
  $$('[data-drift]').forEach((img) => {
    gsap.from(img, { opacity: 0, y: 30, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: '.intorno', start: 'top 70%' } });
    gsap.fromTo(img, { yPercent: +img.dataset.drift }, { yPercent: -img.dataset.drift, ease: 'none', scrollTrigger: { trigger: '.intorno', scrub: true } });
  });

  /* the evening terrace settles under the card */
  gsap.fromTo('.prenota__photo img', { scale: 1.12 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: '.prenota', scrub: true } });
  gsap.from('.card > *', { y: 20, opacity: 0, stagger: 0.06, duration: 0.8, ease: 'power3.out', scrollTrigger: { trigger: '.card', start: 'top 85%' } });

  /* footer: the name rises as the page lifts off it */
  gsap.from('.footer__word', { yPercent: 40, opacity: 0, duration: 1.4, ease: 'expo.out', scrollTrigger: { trigger: '.footer', start: 'top 70%' } });
}

/* ---------- the pasta loop: loads and plays only while on screen ---------- */
{
  const ext = document.createElement('video').canPlayType('video/webm; codecs="vp9"') ? 'webm' : 'mp4';
  const io = new IntersectionObserver((entries) => entries.forEach(({ target: v, isIntersecting }) => {
    if (isIntersecting) {
      if (!v.src) v.src = `${v.dataset.src}.${ext}`;
      if (!reduced) v.play().catch(() => {});
    } else v.pause();
  }), { rootMargin: '200px 0px' });
  $$('video[data-src]').forEach((v) => io.observe(v));
}

/* ---------- direct booking ---------- */
{
  const form = $('.book');
  const out = (k) => $(`[data-out="${k}"]`, form);
  const eur = (n) => `${n.toLocaleString('it-IT')} €`;
  // dates stay as YYYY-MM-DD strings; "today" is the visitor's local day, not UTC
  const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const nextDay = (s) => new Date(Date.parse(s) + 86400000).toISOString().slice(0, 10);
  const { checkin, checkout, guests, email } = form.elements;
  checkin.min = today;
  checkout.min = nextDay(today);

  const update = () => {
    if (checkin.value) {
      checkout.min = nextDay(checkin.value);
      if (checkout.value && checkout.value <= checkin.value) checkout.value = '';
    }
    const q = quote(checkin.value, checkout.value, +guests.value);
    if (q.error) {
      out('line').textContent = checkin.value && checkout.value ? q.error : 'Scegliete le date';
      out('total').textContent = '—';
      return q;
    }
    const same = q.perNight.every((r) => r === q.perNight[0]);
    out('line').textContent = same ? `${eur(q.perNight[0])} × ${q.nights} ${q.nights === 1 ? 'notte' : 'notti'}` : `${q.nights} notti, tariffe di stagione`;
    out('total').textContent = eur(q.total);
    out('error').textContent = '';
    return q;
  };
  form.addEventListener('input', update);
  form.addEventListener('change', update);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = update();
    const err = q.error || (!email.value || !email.validity.valid ? 'Inserite un’email valida' : '');
    if (err) { out('error').textContent = err; return; }
    // ponytail: demo only, nothing is sent. Wire to a booking engine / Stripe checkout before launch.
    out('done').textContent = `Abbiamo ricevuto la richiesta per ${q.nights} ${q.nights === 1 ? 'notte' : 'notti'} (${eur(q.total)}). Vi scriviamo a ${email.value} per confermare.`;
    $('[data-step="form"]', form).hidden = true;
    $('[data-step="done"]', form).hidden = false;
  });
  $('[data-action="reset"]', form).addEventListener('click', () => {
    form.reset(); update();
    $('[data-step="form"]', form).hidden = false;
    $('[data-step="done"]', form).hidden = true;
  });
}

document.fonts.ready.then(() => ScrollTrigger.refresh());
