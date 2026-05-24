/* ===================================================
   Talent Thread — Home Page JavaScript
   Tab filtering, scrolled header, mobile menu.
   =================================================== */

(function () {
  'use strict';

  // ── Scrolled header class ──────────────────────────
  const header = document.getElementById('siteHeader');
  if (header) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 40) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }
    }, { passive: true });
  }

  // ── Mobile menu toggle ─────────────────────────────
  const mobileBtn = document.getElementById('mobileMenuBtn');
  const nav = document.getElementById('mainNav');
  if (mobileBtn && nav) {
    mobileBtn.addEventListener('click', () => {
      nav.classList.toggle('mobile-open');
    });
    // close on outside click
    document.addEventListener('click', (e) => {
      if (!header.contains(e.target)) {
        nav.classList.remove('mobile-open');
      }
    });
  }

  // ── Talent category tab filter ─────────────────────
  const catTabs  = document.querySelectorAll('.cat-tab');
  const dcCards  = document.querySelectorAll('.designer-card-v2');

  catTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // Update active tab
      catTabs.forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');

      const selectedCat = tab.dataset.tab;

      // Filter cards
      dcCards.forEach(card => {
        const cats = (card.dataset.cat || '').split(' ');
        if (selectedCat === 'all' || cats.includes(selectedCat)) {
          card.classList.remove('hidden-by-tab');
        } else {
          card.classList.add('hidden-by-tab');
        }
      });
    });
  });

  // ── Role toggle ────────────────────────────────────
  document.querySelectorAll('.role-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.role-toggle-btn').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      const role = btn.dataset.role;
      document.querySelectorAll('.role-panel').forEach(p => p.classList.add('hidden'));
      const panel = document.getElementById(`rolePanel${role.charAt(0).toUpperCase() + role.slice(1)}`);
      if (panel) panel.classList.remove('hidden');
    });
  });

  // ── Dismiss trust banner ───────────────────────────
  const trustBanner = document.getElementById('trustBanner');
  if (trustBanner) {
    trustBanner.addEventListener('click', (e) => {
      if (e.target.tagName !== 'A') {
        trustBanner.style.display = 'none';
      }
    });
  }

  // ── Entrance animations (Intersection Observer) ────
  const animEls = document.querySelectorAll(
    '.process-step-card, .designer-card-v2, .demo-gig-card, .testi-card-v2, .dark-stat-item'
  );
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.style.opacity = '1';
          entry.target.style.transform = 'translateY(0)';
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

    animEls.forEach((el, i) => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(24px)';
      el.style.transition = `opacity 0.4s ease ${i * 0.06}s, transform 0.4s ease ${i * 0.06}s`;
      observer.observe(el);
    });
  }

})();


