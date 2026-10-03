(() => {
  'use strict';

  // ---------- Настройки ----------
  const CONFIG = {
    whatsapp: '79171011683',   // номер для заявок на бронь (только цифры, с 7)
    openAt: 12 * 60,           // открытие, минуты от полуночи (12:00)
    closeAt: 24 * 60,          // закрытие (00:00)
    lastBooking: 23 * 60,      // последнее время для брони (23:00)
    timeZone: 'Europe/Samara', // время Сызрани
    venue: '«Город 1683»',
  };

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const pad = (n) => String(n).padStart(2, '0');
  const toHM = (m) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;

  // Текущие дата и время в Сызрани
  function venueNow() {
    try {
      const parts = new Intl.DateTimeFormat('ru-RU', {
        timeZone: CONFIG.timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
      }).formatToParts(new Date());
      const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
      return { date: `${p.year}-${p.month}-${p.day}`, minutes: +p.hour * 60 + +p.minute };
    } catch (e) {
      const d = new Date();
      return { date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, minutes: d.getHours() * 60 + d.getMinutes() };
    }
  }

  function addDays(isoDate, n) {
    const [y, m, d] = isoDate.split('-').map(Number);
    const dt = new Date(y, m - 1, d + n);
    return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
  }

  // ---------- Статус «открыто / закрыто» ----------
  function renderStatus() {
    const { minutes } = venueNow();
    const open = minutes >= CONFIG.openAt && minutes < CONFIG.closeAt;
    $$('[data-status]').forEach((el) => el.setAttribute('data-status', open ? 'open' : 'closed'));
    $$('[data-open-status]').forEach((el) => {
      el.textContent = open ? `Открыто до ${toHM(CONFIG.closeAt % (24 * 60))}` : `Закрыто · откроемся в ${toHM(CONFIG.openAt)}`;
    });
  }
  renderStatus();
  setInterval(renderStatus, 60 * 1000);

  // ---------- Первый экран: появление текста и мини-меню ----------
  const hero = $('.hero');
  requestAnimationFrame(() => requestAnimationFrame(() => hero.classList.add('is-ready')));
  const toggleCue = () => hero.classList.toggle('is-scrolled', window.scrollY > 10);
  window.addEventListener('scroll', toggleCue, { passive: true });
  toggleCue();

  // ---------- Шапка и мобильное меню ----------
  const header = $('.header');
  const burger = $('.burger');
  const nav = $('#nav');
  const mbar = $('.mbar');

  function onScroll() {
    const y = window.scrollY;
    header.classList.toggle('is-scrolled', y > 20);
    if (mbar) {
      const show = y > window.innerHeight * 0.55;
      mbar.classList.toggle('is-visible', show);
      mbar.setAttribute('aria-hidden', String(!show));
      $$('a, button', mbar).forEach((el) => (el.tabIndex = show ? 0 : -1));
    }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  function setNav(open) {
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
    nav.classList.toggle('is-open', open);
    header.classList.toggle('nav-open', open);
    document.body.classList.toggle('no-scroll', open);
    document.body.classList.toggle('nav-is-open', open);
  }
  burger.addEventListener('click', () => setNav(burger.getAttribute('aria-expanded') !== 'true'));
  nav.addEventListener('click', (e) => { if (e.target.closest('a')) setNav(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && nav.classList.contains('is-open')) setNav(false); });
  window.matchMedia('(min-width: 961px)').addEventListener('change', (e) => { if (e.matches) setNav(false); });

  // Подсветка пункта меню текущего раздела
  const navLinks = $$('a', nav);
  const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      navLinks.forEach((a) => a.classList.toggle('is-active', a.getAttribute('href') === `#${entry.target.id}`));
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  navLinks.forEach((a) => { const s = $(a.getAttribute('href')); if (s) sectionObserver.observe(s); });

  // ---------- Меню: вкладки, категории, поиск ----------
  const menu = $('#menu');
  const tabs = $$('.tab', menu);
  const panels = $$('.menu-panel', menu);
  const pills = $('.pills', menu);
  const searchInput = $('#menu-search');
  const searchClear = $('.search__clear', menu);
  const emptyMsg = $('.menu-empty', menu);
  let currentTab = 'kitchen';
  let catObserver;

  function selectTab(name, { focus = false } = {}) {
    currentTab = name;
    tabs.forEach((t) => {
      const on = t.dataset.tab === name;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      if (on && focus) t.focus();
    });
    panels.forEach((p) => { p.hidden = p.dataset.panel !== name; });
    buildPills();
  }

  function buildPills() {
    const panel = panels.find((p) => p.dataset.panel === currentTab);
    const cats = $$('.cat', panel);
    pills.replaceChildren(...cats.map((cat) => {
      const a = document.createElement('a');
      a.className = 'pill';
      a.href = `#${cat.id}`;
      a.textContent = cat.dataset.title;
      return a;
    }));
    pills.scrollLeft = 0;

    if (catObserver) catObserver.disconnect();
    catObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => { if (entry.isIntersecting) setActivePill(entry.target.id); });
    }, { rootMargin: '-160px 0px -55% 0px' });
    cats.forEach((c) => catObserver.observe(c));
  }

  function setActivePill(id) {
    let active;
    $$('.pill', pills).forEach((p) => {
      const on = p.getAttribute('href') === `#${id}`;
      p.classList.toggle('is-active', on);
      if (on) active = p;
    });
    if (active) {
      const left = active.offsetLeft - pills.clientWidth / 2 + active.offsetWidth / 2;
      pills.scrollTo({ left, behavior: 'smooth' });
    }
  }

  tabs.forEach((t) => t.addEventListener('click', () => {
    if (searchInput.value) { searchInput.value = ''; applySearch(''); }
    selectTab(t.dataset.tab);
  }));
  // стрелки влево/вправо по вкладкам
  $('.tabs', menu).addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const i = tabs.findIndex((t) => t.dataset.tab === currentTab);
    const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
    selectTab(next.dataset.tab, { focus: true });
  });

  const norm = (s) => s.toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ');

  function applySearch(raw) {
    const q = norm(raw.trim());
    const searching = q.length > 0;
    menu.classList.toggle('is-searching', searching);
    searchClear.hidden = !searching;
    let total = 0;

    panels.forEach((panel) => {
      panel.hidden = searching ? false : panel.dataset.panel !== currentTab;
      $$('.cat', panel).forEach((cat) => {
        const catHit = searching && norm(cat.dataset.title).includes(q);
        let shown = 0;
        $$('li', cat).forEach((li) => {
          if (li.classList.contains('sub')) { li.hidden = searching && !catHit; return; }
          const hit = !searching || catHit || norm(li.textContent).includes(q);
          li.hidden = !hit;
          if (hit) shown++;
        });
        cat.hidden = searching && shown === 0;
        total += shown;
      });
    });
    emptyMsg.hidden = !searching || total > 0;
  }

  let searchTimer;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => applySearch(searchInput.value), 80);
  });
  searchInput.addEventListener('keydown', (e) => { if (e.key === 'Escape') { searchInput.value = ''; applySearch(''); } });
  searchClear.addEventListener('click', () => { searchInput.value = ''; applySearch(''); searchInput.focus(); });

  selectTab('kitchen');

  // ---------- Галерея ----------
  const lightbox = $('#lightbox');
  const lbImg = $('img', lightbox);
  const lbCap = $('figcaption', lightbox);
  const gItems = $$('.g-item');
  let gIndex = 0;

  function showPhoto(i) {
    gIndex = (i + gItems.length) % gItems.length;
    const item = gItems[gIndex];
    const thumb = $('img', item);
    lbImg.src = item.dataset.full;
    lbImg.alt = thumb.alt;
    lbCap.textContent = `${thumb.alt} · ${gIndex + 1} / ${gItems.length}`;
  }
  gItems.forEach((item, i) => item.addEventListener('click', () => { showPhoto(i); lightbox.showModal(); }));
  $('.lightbox__prev', lightbox).addEventListener('click', () => showPhoto(gIndex - 1));
  $('.lightbox__next', lightbox).addEventListener('click', () => showPhoto(gIndex + 1));
  lightbox.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') showPhoto(gIndex - 1);
    if (e.key === 'ArrowRight') showPhoto(gIndex + 1);
  });
  lightbox.addEventListener('click', (e) => { if (e.target === lightbox) lightbox.close(); });

  // свайпы на телефоне
  let touchX = null;
  lightbox.addEventListener('touchstart', (e) => { touchX = e.touches[0].clientX; }, { passive: true });
  lightbox.addEventListener('touchend', (e) => {
    if (touchX === null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 50) showPhoto(gIndex + (dx < 0 ? 1 : -1));
    touchX = null;
  });

  // ---------- Бронирование ----------
  const dialog = $('#booking');
  const form = $('#booking-form');
  const done = $('.booking__done', dialog);
  const waAgain = $('#wa-again');
  const errorBox = $('.form-error', form);
  const f = {
    name: $('#b-name'), phone: $('#b-phone'), date: $('#b-date'), time: $('#b-time'),
    guests: $('#b-guests'), occasion: $('#b-occasion'), comment: $('#b-comment'),
    consent: $('input[name="consent"]', form),
  };

  function fillTimes() {
    const { date, minutes } = venueNow();
    const isToday = f.date.value === date;
    const prev = f.time.value;
    f.time.replaceChildren();
    for (let m = CONFIG.openAt; m <= CONFIG.lastBooking; m += 30) {
      if (isToday && m < minutes + 30) continue;
      f.time.add(new Option(toHM(m), toHM(m)));
    }
    if (!f.time.options.length) {
      f.time.add(new Option('На сегодня уже поздно', ''));
      return;
    }
    const values = Array.from(f.time.options, (o) => o.value);
    f.time.value = values.includes(prev) ? prev : (values.includes('19:00') ? '19:00' : values[0]);
  }

  function openBooking(occasion) {
    setNav(false);
    const { date, minutes } = venueNow();
    const firstDay = minutes + 30 > CONFIG.lastBooking ? addDays(date, 1) : date;
    f.date.min = firstDay;
    f.date.max = addDays(date, 90);
    if (!f.date.value || f.date.value < firstDay) f.date.value = firstDay;
    if (occasion) f.occasion.value = occasion;
    fillTimes();
    form.hidden = false;
    done.hidden = true;
    errorBox.hidden = true;
    dialog.showModal();
  }

  $$('.js-book').forEach((btn) => btn.addEventListener('click', (e) => {
    e.preventDefault();
    openBooking(btn.dataset.occasion);
  }));
  $$('[data-close]').forEach((btn) => btn.addEventListener('click', () => btn.closest('dialog').close()));
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });

  f.date.addEventListener('change', fillTimes);

  // количество гостей
  $$('[data-step]', form).forEach((btn) => btn.addEventListener('click', () => {
    const v = (parseInt(f.guests.value, 10) || 0) + Number(btn.dataset.step);
    f.guests.value = Math.min(50, Math.max(1, v));
  }));

  // маска телефона +7 (XXX) XXX-XX-XX
  function phoneDigits(v) {
    let d = v.replace(/\D/g, '');
    if (!d) return '';
    if (d[0] === '8') d = '7' + d.slice(1);
    if (d[0] !== '7') d = '7' + d;
    return d.slice(0, 11);
  }
  function formatPhone(d) {
    if (!d) return '';
    let out = '+7';
    if (d.length > 1) out += ' (' + d.slice(1, 4);
    if (d.length >= 4) out += ') ' + d.slice(4, 7);
    if (d.length >= 7) out += '-' + d.slice(7, 9);
    if (d.length >= 9) out += '-' + d.slice(9, 11);
    return out;
  }
  f.phone.addEventListener('input', (e) => {
    if (e.inputType && e.inputType.startsWith('delete')) return;
    f.phone.value = formatPhone(phoneDigits(f.phone.value));
  });
  f.phone.addEventListener('focus', () => { if (!f.phone.value) f.phone.value = '+7 ('; });
  f.phone.addEventListener('blur', () => { if (phoneDigits(f.phone.value).length <= 1) f.phone.value = ''; });

  function validate() {
    const problems = [];
    const mark = (el, bad) => el.classList.toggle('is-invalid', bad);

    const nameBad = f.name.value.trim().length < 2;
    mark(f.name, nameBad); if (nameBad) problems.push('имя');

    const phoneBad = phoneDigits(f.phone.value).length !== 11;
    mark(f.phone, phoneBad); if (phoneBad) problems.push('телефон');

    const dateBad = !f.date.value || (f.date.min && f.date.value < f.date.min);
    mark(f.date, dateBad); if (dateBad) problems.push('дату');

    const timeBad = !f.time.value;
    mark(f.time, timeBad); if (timeBad) problems.push('время');

    const g = parseInt(f.guests.value, 10);
    const guestsBad = !(g >= 1 && g <= 50);
    mark(f.guests, guestsBad); if (guestsBad) problems.push('количество гостей');

    $('.consent', form).classList.toggle('is-invalid', !f.consent.checked);

    if (problems.length) {
      errorBox.textContent = `Проверьте, пожалуйста: ${problems.join(', ')}.`;
    } else if (!f.consent.checked) {
      errorBox.textContent = 'Нужно согласие на обработку данных — без него мы не сможем принять заявку.';
    }
    const ok = !problems.length && f.consent.checked;
    errorBox.hidden = ok;
    if (!ok) (form.querySelector('.is-invalid') || f.consent).focus();
    return ok;
  }

  form.addEventListener('input', (e) => {
    if (e.target.classList.contains('is-invalid')) e.target.classList.remove('is-invalid');
  });

  function formatDate(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    const wd = dt.toLocaleDateString('ru-RU', { weekday: 'long' });
    return `${pad(d)}.${pad(m)}.${y} (${wd})`;
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!validate()) return;

    const lines = [
      `Здравствуйте! Хочу забронировать стол в ${CONFIG.venue}.`,
      '',
      `Имя: ${f.name.value.trim()}`,
      `Телефон: ${formatPhone(phoneDigits(f.phone.value))}`,
      `Дата: ${formatDate(f.date.value)}`,
      `Время: ${f.time.value}`,
      `Гостей: ${parseInt(f.guests.value, 10)}`,
    ];
    if (f.occasion.value) lines.push(`Повод: ${f.occasion.value}`);
    if (f.comment.value.trim()) lines.push(`Пожелания: ${f.comment.value.trim()}`);

    const url = `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(lines.join('\n'))}`;
    waAgain.href = url;
    window.open(url, '_blank', 'noopener');
    form.hidden = true;
    done.hidden = false;
    $('h3', done).focus?.();
  });

  dialog.addEventListener('close', () => {
    if (!done.hidden) { form.reset(); f.guests.value = 2; }
    $$('.is-invalid', dialog).forEach((el) => el.classList.remove('is-invalid'));
  });

  // ---------- Появление блоков при прокрутке ----------
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-in');
      revealObserver.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  $$('[data-reveal]').forEach((el, i) => {
    if (el.classList.contains('feature')) el.style.transitionDelay = `${(i % 4) * 70}ms`;
    revealObserver.observe(el);
  });

  // ---------- Год в подвале ----------
  $$('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });
})();
