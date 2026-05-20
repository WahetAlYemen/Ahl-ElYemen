'use strict';
/* ═══════════════════════════════════════════
   مطعم أهل اليمن — Main JavaScript
   Features: Cart · Telegram Checkout · UI
   ═══════════════════════════════════════════ */

/* ── Worker URL — replace with your deployed Cloudflare Worker URL ── */
const WORKER_URL = 'https://ahl-elyemen.sharif-alsahbool.workers.dev';
/* ─────────────────────────────────────────────────────────────────── */

const WA_NUMBER   = '201212002005';
const STORAGE_KEY = 'ahlYemenCart';

/* ───────────────────────────────────────────
   CART CLASS
─────────────────────────────────────────── */
class Cart {
  constructor() {
    this.items = [];
    this._load();
  }

  /* Public API */
  add(id, name, price, nameAr = '') {
    price = parseFloat(price);
    if (isNaN(price) || price <= 0) return;
    const existing = this.items.find(i => i.id === id);
    if (existing) {
      existing.qty++;
      if (!existing.nameAr && nameAr) existing.nameAr = nameAr;
    } else {
      this.items.push({ id, name, nameAr, price, qty: 1 });
    }
    this._persist();
    this._refresh();
    this._toastAdded(name, nameAr);
    this._popBadge();
  }

  setQty(id, qty) {
    qty = parseInt(qty, 10);
    if (isNaN(qty) || qty < 1) { this.remove(id); return; }
    const item = this.items.find(i => i.id === id);
    if (item) { item.qty = qty; this._persist(); this._refresh(); }
  }

  remove(id) {
    this.items = this.items.filter(i => i.id !== id);
    this._persist(); this._refresh();
  }

  clear() {
    this.items = []; this._persist(); this._refresh();
  }

  getTotal()    { return this.items.reduce((s, i) => s + i.price * i.qty, 0); }
  getCount()    { return this.items.reduce((s, i) => s + i.qty, 0); }
  isEmpty()     { return this.items.length === 0; }

  /* Internals */
  _load() {
    try { this.items = JSON.parse(sessionStorage.getItem(STORAGE_KEY)) || []; }
    catch { this.items = []; }
  }
  _persist() { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(this.items)); }

  _refresh() {
    this._updateBadges();
    this._renderDrawer();
    this._renderCheckout();
  }

  _updateBadges() {
    const n = this.getCount();
    document.querySelectorAll('.cart-badge').forEach(el => {
      el.textContent = n;
      el.hidden = n === 0;
    });
    /* update drawer counter */
    const hc = document.getElementById('cartHeadCount');
    if (hc) hc.textContent = n;
  }

  _popBadge() {
    document.querySelectorAll('.cart-badge').forEach(el => {
      el.classList.remove('pop');
      void el.offsetWidth;
      el.classList.add('pop');
    });
  }

  _toastAdded(name, nameAr = '') {
    const t = document.getElementById('cartToast');
    if (!t) return;
    const nm = t.querySelector('.toast-name');
    const isAr = document.documentElement.dir === 'rtl';
    if (nm) nm.textContent = (isAr && nameAr) ? nameAr : name;
    t.classList.add('show');
    clearTimeout(t._tid);
    t._tid = setTimeout(() => t.classList.remove('show'), 2200);
  }

  _fmtPrice(n) {
    const currency = document.documentElement.dir === 'rtl' ? ' جنيه' : ' EGP';
    return n.toFixed(2) + currency;
  }

  _esc(s) {
    return String(s).replace(/[&<>"']/g, c =>
      ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])
    );
  }

  _renderDrawer() {
    const list    = document.getElementById('cartItemsList');
    const empty   = document.getElementById('cartEmpty');
    const footer  = document.getElementById('cartFooter');
    const totalEl = document.getElementById('cartTotalAmt');
    if (!list) return;

    if (this.isEmpty()) {
      list.innerHTML = '';
      if (empty)  empty.style.display  = '';
      if (footer) footer.hidden = true;
      return;
    }
    if (empty)  empty.style.display  = 'none';
    if (footer) footer.hidden = false;
    if (totalEl) totalEl.textContent = this._fmtPrice(this.getTotal());

    const isAr = document.documentElement.dir === 'rtl';
    list.innerHTML = this.items.map(item => {
      const displayName = (isAr && item.nameAr) ? item.nameAr : item.name;
      return `
      <div class="cart-item">
        <div class="cart-item-thumb"><div class="cart-item-ph"></div></div>
        <div class="cart-item-info">
          <p class="cart-item-name">${this._esc(displayName)}</p>
          <p class="cart-item-sub">${this._fmtPrice(item.price)} / ${isAr ? 'قطعة' : 'each'}</p>
          <p class="cart-item-price">${this._fmtPrice(item.price * item.qty)}</p>
        </div>
        <div class="cart-item-ctrl">
          <button class="qty-btn" onclick="window.cart.setQty('${item.id}', ${item.qty - 1})" aria-label="decrease">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
          <span class="qty-num">${item.qty}</span>
          <button class="qty-btn" onclick="window.cart.setQty('${item.id}', ${item.qty + 1})" aria-label="increase">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
          <button class="qty-del" onclick="window.cart.remove('${item.id}')" aria-label="remove">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
          </button>
        </div>
      </div>
    `}).join('');
  }

  _renderCheckout() {
    const itemsEl = document.getElementById('checkoutItems');
    const totalEl = document.getElementById('checkoutTotal');
    if (!itemsEl) return;
    const isAr = document.documentElement.dir === 'rtl';
    itemsEl.innerHTML = this.items.map(i => {
      const displayName = (isAr && i.nameAr) ? i.nameAr : i.name;
      return `
      <div class="co-order-item">
        <span class="co-order-item-name">${this._esc(displayName)} × ${i.qty}</span>
        <span class="co-order-item-price">${this._fmtPrice(i.price * i.qty)}</span>
      </div>
    `}).join('');
    if (totalEl) totalEl.textContent = this._fmtPrice(this.getTotal());
  }
}

/* ───────────────────────────────────────────
   CART DRAWER
─────────────────────────────────────────── */
function openCart() {
  window.cart._renderDrawer();
  document.getElementById('cartDrawer')?.classList.add('open');
  document.getElementById('cartOverlay')?.classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeCart() {
  document.getElementById('cartDrawer')?.classList.remove('open');
  document.getElementById('cartOverlay')?.classList.remove('open');
  document.body.style.overflow = '';
}

/* ───────────────────────────────────────────
   CHECKOUT MODAL
─────────────────────────────────────────── */
function openCheckout() {
  if (window.cart.isEmpty()) return;
  closeCart();
  setTimeout(() => {
    document.getElementById('checkoutOverlay')?.classList.add('open');
    document.getElementById('checkoutModal')?.classList.add('open');
    document.body.style.overflow = 'hidden';
    window.cart._renderCheckout();
  }, 280);
}
function closeCheckout() {
  document.getElementById('checkoutOverlay')?.classList.remove('open');
  document.getElementById('checkoutModal')?.classList.remove('open');
  document.body.style.overflow = '';
}

/* ───────────────────────────────────────────
   ORDER SUCCESS OVERLAY
─────────────────────────────────────────── */
function showOrderSuccess(orderNum) {
  const overlay = document.getElementById('orderSuccessOverlay');
  const numEl   = document.getElementById('orderSuccessNum');
  if (!overlay) return;
  const isAr = document.documentElement.dir === 'rtl';
  if (numEl) numEl.textContent = (isAr ? 'رقم الطلب: #' : 'Order #') + orderNum;
  overlay.classList.add('show');
  document.body.style.overflow = 'hidden';
}

function closeOrderSuccess() {
  document.getElementById('orderSuccessOverlay')?.classList.remove('show');
  document.body.style.overflow = '';
}
window.closeOrderSuccess = closeOrderSuccess;

/* ───────────────────────────────────────────
   ORDER SUBMIT — via Cloudflare Worker
─────────────────────────────────────────── */
async function submitOrder() {
  const nameEl    = document.getElementById('orderName');
  const phoneEl   = document.getElementById('orderPhone');
  const addressEl = document.getElementById('orderAddress');
  const notesEl   = document.getElementById('orderNotes');
  const submitBtn = document.getElementById('checkoutSubmit');
  const isAr      = document.documentElement.dir === 'rtl';

  const name    = nameEl?.value.trim()    || '';
  const phone   = phoneEl?.value.trim()   || '';
  const address = addressEl?.value.trim() || '';
  const notes   = notesEl?.value.trim()   || '';

  /* Validation */
  let valid = true;
  [
    [nameEl,    document.getElementById('errName'),    !name],
    [phoneEl,   document.getElementById('errPhone'),   !phone],
    [addressEl, document.getElementById('errAddress'), !address]
  ].forEach(([input, errEl, invalid]) => {
    if (input)  input.classList.toggle('error', invalid);
    if (errEl)  errEl.classList.toggle('show',  invalid);
    if (invalid) valid = false;
  });
  if (!valid) return;

  /* Build payload */
  const payload = {
    orderNum: Date.now().toString().slice(-6),
    name,
    phone,
    address,
    notes,
    items: window.cart.items.map(i => ({
      name:   i.name,
      nameAr: i.nameAr || '',
      price:  i.price,
      qty:    i.qty,
    })),
    total: window.cart.getTotal().toFixed(2),
  };

  /* Loading state */
  const origHtml = submitBtn?.innerHTML;
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span style="display:inline-flex;align-items:center;gap:8px;">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" style="animation:tgSpin 0.8s linear infinite">
        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
      </svg>${isAr ? 'جاري الإرسال...' : 'Sending...'}</span>`;
  }

  try {
    const res  = await fetch(WORKER_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) throw new Error(data.error || `HTTP ${res.status}`);

    /* Close checkout, clear form & cart, show success overlay */
    closeCheckout();
    window.cart.clear();
    if (nameEl)    nameEl.value    = '';
    if (phoneEl)   phoneEl.value   = '';
    if (addressEl) addressEl.value = '';
    if (notesEl)   notesEl.value   = '';
    if (submitBtn) { submitBtn.disabled = false; submitBtn.style.cssText = ''; submitBtn.innerHTML = origHtml; }
    showOrderSuccess(payload.orderNum);

  } catch (err) {
    console.error('Order error:', err);
    if (submitBtn) { submitBtn.disabled = false; submitBtn.style.cssText = ''; submitBtn.innerHTML = origHtml; }
    alert(isAr
      ? '⚠️ لم يتم إرسال الطلب.\nيرجى المحاولة مرة أخرى أو الاتصال بنا: 012 12002005'
      : '⚠️ Order could not be sent.\nPlease try again or call us: 012 12002005'
    );
  }
}

/* ───────────────────────────────────────────
   HEADER SCROLL
─────────────────────────────────────────── */
function initHeader() {
  const header = document.getElementById('mainHeader');
  if (!header) return;
  const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 60);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

/* ───────────────────────────────────────────
   MOBILE NAV
─────────────────────────────────────────── */
function initMobileNav() {
  const toggle   = document.getElementById('menuToggle');
  const overlay  = document.getElementById('mobileOverlay');
  const drawer   = document.getElementById('mobileDrawer');
  const closeBtn = document.getElementById('mobileClose');

  const open  = () => { toggle?.classList.add('open'); drawer?.classList.add('open'); overlay?.classList.add('open'); document.body.style.overflow = 'hidden'; };
  const close = () => { toggle?.classList.remove('open'); drawer?.classList.remove('open'); overlay?.classList.remove('open'); document.body.style.overflow = ''; };

  toggle?.addEventListener('click', open);
  overlay?.addEventListener('click', close);
  closeBtn?.addEventListener('click', close);
  drawer?.querySelectorAll('a').forEach(a => a.addEventListener('click', close));
}

/* ───────────────────────────────────────────
   SCROLL REVEAL
─────────────────────────────────────────── */
function initReveal() {
  const els = document.querySelectorAll('.reveal');
  if (!els.length) return;
  const io = new IntersectionObserver(
    entries => entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); } }),
    { threshold: 0.1 }
  );
  els.forEach(el => io.observe(el));
}

/* ───────────────────────────────────────────
   ADD-TO-CART BUTTONS
─────────────────────────────────────────── */
function initAddButtons() {
  document.addEventListener('click', e => {
    const btn = e.target.closest('.btn-add');
    if (!btn) return;
    const { id, name, price } = btn.dataset;
    if (!id || !name || !price) return;
    const card   = btn.closest('article');
    const nameEl = card?.querySelector('.item-name[data-ar], .dish-name[data-ar]');
    const nameAr = nameEl?.dataset?.ar || '';
    window.cart.add(id, name, price, nameAr);
    /* Visual feedback */
    btn.classList.add('added');
    const txt = btn.querySelector('.btn-add-text');
    const isAr = document.documentElement.dir === 'rtl';
    if (txt) txt.textContent = isAr ? 'تمت الإضافة' : 'Added!';
    setTimeout(() => {
      btn.classList.remove('added');
      if (txt) txt.textContent = isAr ? 'أضف للسلة' : 'Add to Cart';
    }, 1400);
  });
}

/* ───────────────────────────────────────────
   MENU CATEGORY FILTER (home preview)
─────────────────────────────────────────── */
function initCatFilter() {
  const pills = document.querySelectorAll('.cat-pill');
  const cards = document.querySelectorAll('.dish-card[data-cat]');
  if (!pills.length) return;

  pills.forEach(pill => {
    pill.addEventListener('click', () => {
      pills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      const cat = pill.dataset.cat;
      cards.forEach(card => {
        const match = cat === 'all' || card.dataset.cat === cat;
        card.style.display = match ? '' : 'none';
      });
    });
  });
}

/* ───────────────────────────────────────────
   MENU PAGE — STICKY TAB NAV
─────────────────────────────────────────── */
function initMenuTabs() {
  const tabs = document.querySelectorAll('.menu-tab');
  if (!tabs.length) return;

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = document.getElementById(tab.dataset.target);
      if (!target) return;
      const navH = document.querySelector('.menu-sticky-nav')?.offsetHeight || 0;
      const headerH = document.getElementById('mainHeader')?.offsetHeight || 0;
      const top = target.getBoundingClientRect().top + window.scrollY - navH - headerH - 8;
      window.scrollTo({ top, behavior: 'smooth' });
    });
  });

  /* Highlight active tab on scroll */
  const sections = [...tabs].map(t => document.getElementById(t.dataset.target)).filter(Boolean);
  if (!sections.length) return;
  const navBar = document.querySelector('.menu-sticky-nav');
  const headerH = () => document.getElementById('mainHeader')?.offsetHeight || 68;

  const observer = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        const id = e.target.id;
        tabs.forEach(t => t.classList.toggle('active', t.dataset.target === id));
        const active = document.querySelector(`.menu-tab[data-target="${id}"]`);
        active?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    });
  }, { rootMargin: `-${(navBar?.offsetHeight || 56) + headerH() + 10}px 0px -55% 0px`, threshold: 0 });

  sections.forEach(s => observer.observe(s));
}

/* ───────────────────────────────────────────
   VIDEO MUTE TOGGLE
─────────────────────────────────────────── */
function initVideoCtrl() {
  const btn   = document.getElementById('videoCtrl');
  const video = document.getElementById('heroVideo');
  if (!btn || !video) return;
  const muteIco   = btn.querySelector('.ico-mute');
  const unmuteIco = btn.querySelector('.ico-unmute');
  btn.addEventListener('click', () => {
    video.muted = !video.muted;
    if (muteIco)   muteIco.style.display   = video.muted ? '' : 'none';
    if (unmuteIco) unmuteIco.style.display = video.muted ? 'none' : '';
  });
}

/* ───────────────────────────────────────────
   INPUT VALIDATION — clear error on input
─────────────────────────────────────────── */
function initFormValidation() {
  [['orderName', 'errName'], ['orderPhone', 'errPhone'], ['orderAddress', 'errAddress']].forEach(([id, errId]) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', () => {
      el.classList.remove('error');
      document.getElementById(errId)?.classList.remove('show');
    });
  });
}

/* ───────────────────────────────────────────
   SCROLL PROGRESS BAR
─────────────────────────────────────────── */
function initScrollProgress() {
  const bar = document.getElementById('scrollProgress');
  if (!bar) return;
  const update = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.transform = `scaleX(${max > 0 ? window.scrollY / max : 0})`;
  };
  window.addEventListener('scroll', update, { passive: true });
  update();
}

/* ───────────────────────────────────────────
   FORCE-PLAY BACKGROUND VIDEOS
─────────────────────────────────────────── */
function initVideos() {
  document.querySelectorAll('video[autoplay]').forEach(v => {
    v.muted = true;
    v.play().catch(() => {});
  });
}

/* ───────────────────────────────────────────
   CART MIGRATION — fill nameAr for old items
─────────────────────────────────────────── */
function migrateCartNames() {
  let changed = false;
  window.cart.items.forEach(item => {
    if (item.nameAr) return;
    const btn = document.querySelector(`.btn-add[data-id="${item.id}"]`);
    if (!btn) return;
    const card   = btn.closest('article');
    const nameEl = card?.querySelector('.item-name[data-ar], .dish-name[data-ar]');
    const nameAr = nameEl?.dataset?.ar || '';
    if (nameAr) { item.nameAr = nameAr; changed = true; }
  });
  if (changed) { window.cart._persist(); window.cart._refresh(); }
}

/* ───────────────────────────────────────────
   BRANCH PHOTO SLIDESHOW
─────────────────────────────────────────── */
function initSlideshow() {
  const track = document.getElementById('slideshowTrack');
  const dotsEl = document.getElementById('slideshowDots');
  const prev  = document.getElementById('ssPrev');
  const next  = document.getElementById('ssNext');
  if (!track) return;

  const slides = track.querySelectorAll('img');
  const dots   = dotsEl ? dotsEl.querySelectorAll('.ss-dot') : [];
  let current  = 0;
  let timer    = null;

  function goTo(idx) {
    current = (idx + slides.length) % slides.length;
    track.style.transform = `translateX(-${current * 100}%)`;
    dots.forEach((d, i) => d.classList.toggle('active', i === current));
  }

  function start() {
    timer = setInterval(() => goTo(current + 1), 4000);
  }

  function stop() {
    clearInterval(timer);
  }

  prev?.addEventListener('click', () => { stop(); goTo(current - 1); start(); });
  next?.addEventListener('click', () => { stop(); goTo(current + 1); start(); });

  dots.forEach((d, i) => {
    d.addEventListener('click', () => { stop(); goTo(i); start(); });
  });

  track.closest('.branch-slideshow')?.addEventListener('mouseenter', stop);
  track.closest('.branch-slideshow')?.addEventListener('mouseleave', start);

  goTo(0);
  start();
}

/* ───────────────────────────────────────────
   LANGUAGE TOGGLE
─────────────────────────────────────────── */
function toggleLanguage() {
  const html = document.documentElement;
  const isAr = html.dir === 'rtl';
  setLanguage(isAr ? 'en' : 'ar');
}

function setLanguage(lang) {
  const html = document.documentElement;
  html.lang = lang;
  html.dir  = lang === 'ar' ? 'rtl' : 'ltr';

  /* Swap text content for [data-ar] elements */
  document.querySelectorAll('[data-ar]').forEach(el => {
    if (!el.dataset.en) el.dataset.en = el.textContent.trim();
    el.textContent = lang === 'ar' ? el.dataset.ar : el.dataset.en;
  });

  /* Swap placeholders */
  document.querySelectorAll('[data-ar-placeholder]').forEach(el => {
    if (!el.dataset.enPlaceholder) el.dataset.enPlaceholder = el.placeholder;
    el.placeholder = lang === 'ar' ? el.dataset.arPlaceholder : el.dataset.enPlaceholder;
  });

  /* Update toggle button labels (header + mobile drawer) */
  document.querySelectorAll('.lang-lbl').forEach(el => {
    el.textContent = lang === 'ar' ? 'English' : 'عربي';
  });

  /* Re-render cart to apply new currency/language */
  window.cart?._refresh();

  localStorage.setItem('siteLang', lang);
}

/* ───────────────────────────────────────────
   EXPOSE GLOBALS & INIT
─────────────────────────────────────────── */
window.cart              = new Cart();
window.openCart          = openCart;
window.closeCart         = closeCart;
window.openCheckout      = openCheckout;
window.closeCheckout     = closeCheckout;
window.submitOrder       = submitOrder;
window.toggleLanguage    = toggleLanguage;
window.showOrderSuccess  = showOrderSuccess;
window.closeOrderSuccess = closeOrderSuccess;

document.addEventListener('DOMContentLoaded', () => {
  /* Restore saved language preference — default is Arabic */
  const savedLang = localStorage.getItem('siteLang') || 'ar';
  setLanguage(savedLang);

  window.cart._refresh();
  initHeader();
  initMobileNav();
  initReveal();
  initAddButtons();
  migrateCartNames();
  initCatFilter();
  initMenuTabs();
  initVideoCtrl();
  initVideos();
  initScrollProgress();
  initFormValidation();
  initSlideshow();

  /* Cart overlay close */
  document.getElementById('cartOverlay')?.addEventListener('click', closeCart);
  document.getElementById('checkoutOverlay')?.addEventListener('click', closeCheckout);

  /* Smooth anchor scroll */
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const t = document.querySelector(a.getAttribute('href'));
      if (!t) return;
      e.preventDefault();
      const h = document.getElementById('mainHeader')?.offsetHeight || 0;
      window.scrollTo({ top: t.offsetTop - h - 10, behavior: 'smooth' });
    });
  });
});
