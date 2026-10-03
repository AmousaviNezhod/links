/* ========================================
   AM!R - Creative Developer Portfolio
   GitHub API, rendering, interactions
   ======================================== */

(function () {
  'use strict';

  // --- State ---
  let profile = null;
  let allRepos = [];
  let featuredRepos = [];
  let otherRepos = [];

  // --- DOM refs ---
  const nav = document.getElementById('nav');
  const navBurger = document.getElementById('navBurger');
  const mobileMenu = document.getElementById('mobileMenu');
  const cursorLight = document.querySelector('.cursor-light');
  const projectsGrid = document.getElementById('projectsGrid');
  const otherGrid = document.getElementById('otherGrid');
  const stackGrid = document.getElementById('stackGrid');
  const modal = document.getElementById('projectModal');
  const modalBackdrop = document.getElementById('modalBackdrop');
  const modalPanel = document.getElementById('modalPanel');
  const modalClose = document.getElementById('modalClose');
  const modalContent = document.getElementById('modalContent');

  // --- Helpers ---
  function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value).replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    })[char]);
  }

  const LANG_SLUGS = {
    JavaScript: 'javascript',
    TypeScript: 'typescript',
    CSS: 'css',
    HTML: 'html5',
    Python: 'python',
    Java: 'openjdk',
    Kotlin: 'kotlin',
    TeX: 'latex',
    'C++': 'cpp',
    C: 'c',
    Go: 'go',
    Rust: 'rust',
    Shell: 'gnubash',
    Swift: 'swift',
    Ruby: 'ruby',
    PHP: 'php',
  };

  // Brand colors that disappear on a dark surface are overridden here
  const ICON_COLORS = {
    Java: 'e6e6e6',
  };

  function iconUrl(name, slug) {
    const color = ICON_COLORS[name];
    return `https://cdn.simpleicons.org/${slug}${color ? `/${color}` : ''}`;
  }

  function coverUrl(repoName) {
    return `https://picsum.photos/seed/amir-${encodeURIComponent(repoName)}/1200/600`;
  }

  const LANG_COLORS = {
    JavaScript: '#f1e05a',
    TypeScript: '#3178c6',
    HTML: '#e34c26',
    CSS: '#563d7c',
    Python: '#3572a5',
    Java: '#b07219',
    Kotlin: '#a97bff',
    TeX: '#3d6117',
    'C++': '#f34b7d',
    C: '#6f7681',
    Shell: '#89e051',
    Go: '#00add8',
    Ruby: '#701516',
    PHP: '#4f5d95',
    Swift: '#f05138',
    Rust: '#dea584',
  };

  function langColor(name) {
    return LANG_COLORS[name] || '#8b949e';
  }

  function langLabel(name) {
    return name
      ? `<span class="project-media-lang"><span class="lang-dot" style="background:${langColor(name)}"></span>${escapeHtml(name)}</span>`
      : '';
  }

  function githubMark() {
    return `<svg class="project-media-gh" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>`;
  }

  // --- Cache helpers ---
  const CACHE_KEY = 'amir_github_cache';
  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  function getCache() {
    try {
      const raw = sessionStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (Date.now() - data.timestamp > CACHE_TTL) {
        sessionStorage.removeItem(CACHE_KEY);
        return null;
      }
      return data;
    } catch {
      return null;
    }
  }

  function setCache(data) {
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ...data, timestamp: Date.now() }));
    } catch { /* ignore */ }
  }

  // --- API ---
  async function fetchJSON(url) {
    const res = await fetch(url, {
      headers: { Accept: 'application/vnd.github.v3+json' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  async function fetchREADME(repo) {
    try {
      const data = await fetchJSON(
        `https://api.github.com/repos/${CONFIG.githubUsername}/${repo}/readme`
      );
      if (data.content) {
        return atob(data.content.replace(/\n/g, ''));
      }
    } catch { /* no README */ }
    return null;
  }

  async function fetchLanguages(repo) {
    try {
      return await fetchJSON(
        `https://api.github.com/repos/${CONFIG.githubUsername}/${repo}/languages`
      );
    } catch {
      return {};
    }
  }

  // --- Data loading ---
  async function loadData() {
    const cached = getCache();
    if (cached) {
      applyData(cached);
      return;
    }

    try {
      const [profileData, reposData] = await Promise.all([
        fetchJSON(`https://api.github.com/users/${CONFIG.githubUsername}`),
        fetchJSON(
          `https://api.github.com/users/${CONFIG.githubUsername}/repos?per_page=100&sort=updated`
        ),
      ]);

      profile = profileData;
      allRepos = reposData;

      // Separate featured vs other
      const featured = [];
      const others = [];
      for (const repo of allRepos) {
        if (CONFIG.featuredRepos.includes(repo.name)) {
          featured.push(repo);
        } else if (!repo.fork) {
          others.push(repo);
        }
      }

      // Sort featured by config order
      featured.sort(
        (a, b) =>
          CONFIG.featuredRepos.indexOf(a.name) - CONFIG.featuredRepos.indexOf(b.name)
      );

      // Fetch details for featured repos
      const details = await Promise.all(
        featured.map(async (repo) => {
          const [readme, langs] = await Promise.all([
            fetchREADME(repo.name),
            fetchLanguages(repo.name),
          ]);
          return { ...repo, readme, languages: langs };
        })
      );

      featuredRepos = details;
      otherRepos = others;

      const cacheData = { profile, allRepos, featuredRepos, otherRepos };
      setCache(cacheData);
      applyData(cacheData);
    } catch (err) {
      console.warn('GitHub API failed, using fallback:', err);
      loadFallback();
    }
  }

  function applyData(data) {
    profile = data.profile;
    allRepos = data.allRepos || [];
    featuredRepos = data.featuredRepos;
    otherRepos = data.otherRepos;

    renderStats();
    renderProjects();
    renderOtherWork();
    renderStack();
  }

  function loadFallback() {
    // Static fallback based on known data
    profile = {
      public_repos: 16,
      followers: 13,
    };
    allRepos = [];
    featuredRepos = [
      {
        name: 'Unit-selection',
        html_url: `https://github.com/${CONFIG.githubUsername}/Unit-selection`,
        stargazers_count: 2,
        description: 'University course pre-selection and scheduling tool with PDF export, calendar sync, and conflict detection.',
        languages: { JavaScript: 679496, CSS: 401911, HTML: 206218 },
        readme: 'Pre-selection tool for university course scheduling. Features capacity tracking, duplicate/conflict detection, per-course pricing, calendar export, dark/light theme, and undo/redo.',
        language: 'JavaScript',
      },
      {
        name: 'SonicDraft',
        html_url: `https://github.com/${CONFIG.githubUsername}/SonicDraft`,
        stargazers_count: 0,
        description: 'Bilingual static music-prompt composer. Creates professional Master Prompts for external AI providers.',
        languages: { JavaScript: 105890, HTML: 1143 },
        readme: 'Bilingual static music-prompt composer. Creates a professional Master Prompt for an external AI. Simple and Advanced modes with distinct workflows. Supports ChatGPT, Gemini, and Claude as destinations.',
        language: 'JavaScript',
      },
      {
        name: 'binarauraler',
        html_url: `https://github.com/${CONFIG.githubUsername}/binarauraler`,
        stargazers_count: 2,
        description: 'Web-based audio tool.',
        languages: { HTML: 33470 },
        readme: null,
        language: 'HTML',
      },
    ];
    otherRepos = [
      { name: 'VoxLink', language: 'Java', html_url: `https://github.com/${CONFIG.githubUsername}/VoxLink` },
      { name: 'AudioSyncPro', language: 'Python', html_url: `https://github.com/${CONFIG.githubUsername}/AudioSyncPro` },
      { name: 'MultiCam-Sony', language: 'TypeScript', html_url: `https://github.com/${CONFIG.githubUsername}/MultiCam-Sony` },
      { name: 'Pr-liner', language: 'JavaScript', html_url: `https://github.com/${CONFIG.githubUsername}/Pr-liner` },
      { name: 'maktab-baft-FrontEnd', language: 'HTML', html_url: `https://github.com/${CONFIG.githubUsername}/maktab-baft-FrontEnd` },
      { name: 'audioSorter-for-Zoom-F8-Recorder-', language: 'TeX', html_url: `https://github.com/${CONFIG.githubUsername}/audioSorter-for-Zoom-F8-Recorder-` },
    ];

    applyData({ profile, allRepos, featuredRepos, otherRepos });
  }

  // --- Rendering ---
  function renderStats() {
    const totalStars = allRepos.length
      ? allRepos.reduce((sum, r) => sum + (r.stargazers_count || 0), 0)
      : featuredRepos.reduce((sum, r) => sum + (r.stargazers_count || 0), 0);
    animateValue('statRepos', profile?.public_repos || 0);
    animateValue('statStars', totalStars);
    animateValue('statFollowers', profile?.followers || 0);
  }

  function animateValue(id, target) {
    const el = document.getElementById(id);
    if (!el) return;
    const duration = 1200;
    const start = 0;
    const startTime = performance.now();

    function tick(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(start + (target - start) * eased);
      el.textContent = current;
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  function truncate(str, len) {
    if (!str) return '';
    return str.length > len ? str.slice(0, len).trimEnd() + '…' : str;
  }

  function renderSkeletons() {
    if (projectsGrid) {
      projectsGrid.innerHTML = `
        <div class="skeleton sk-card sk-wide"></div>
        <div class="skeleton sk-card"></div>
        <div class="skeleton sk-card"></div>`;
    }
    if (stackGrid) {
      stackGrid.innerHTML = Array.from({ length: 4 }, () => '<div class="skeleton sk-item"></div>').join('');
    }
    if (otherGrid) {
      otherGrid.innerHTML = Array.from({ length: 6 }, () => '<div class="skeleton sk-row"></div>').join('');
    }
  }

  function renderProjects() {
    if (!projectsGrid) return;

    if (!featuredRepos.length) {
      projectsGrid.innerHTML = `
        <div class="state-note">
          No featured projects to show right now.
          <a href="https://github.com/${CONFIG.githubUsername}" target="_blank" rel="noopener">Browse all repositories on GitHub</a>
        </div>`;
      return;
    }

    projectsGrid.innerHTML = featuredRepos
      .map((repo, i) => {
        const langs = Object.keys(repo.languages || {}).slice(0, 4);
        const tags = langs
          .map((lang) => `<span class="project-tag">${escapeHtml(lang)}</span>`)
          .join('');
        const stars = repo.stargazers_count || 0;
        const name = escapeHtml(repo.name);
        const desc = escapeHtml(truncate(repo.description || getFallbackDescription(repo), 150));

        return `
        <article class="project-card reveal" style="--d:${0.1 + i * 0.1}s" data-repo="${name}" tabindex="0" role="button" aria-label="View details for ${name}">
          <div class="project-media">
            <img src="${coverUrl(repo.name)}" alt="Cover photo for ${name}" width="1200" height="600" loading="${i === 0 ? 'eager' : 'lazy'}" decoding="async" />
            <div class="project-media-veil" aria-hidden="true">
              ${langLabel(repo.language)}
              ${githubMark()}
            </div>
          </div>
          <div class="project-body">
            <h3 class="project-title">${name}</h3>
            <p class="project-desc">${desc}</p>
            <div class="project-footer">
              <div class="project-tags">${tags}</div>
              <span class="project-stars">
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                ${stars}
              </span>
            </div>
          </div>
        </article>`;
      })
      .join('');

    projectsGrid.querySelectorAll('.project-media img').forEach((img) => {
      img.addEventListener('error', () => {
        const card = img.closest('.project-card');
        img.closest('.project-media')?.remove();
        card?.classList.add('no-media');
      });
    });

    projectsGrid.querySelectorAll('.project-card').forEach((card) => {
      const open = () => {
        const repo = featuredRepos.find((r) => r.name === card.dataset.repo);
        if (repo) openModal(repo);
      };

      card.addEventListener('click', open);
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open();
        }
      });
      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        card.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
        card.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
      });
    });
  }

  function getFallbackDescription(repo) {
    const fallbacks = {
      'Unit-selection':
        'University course pre-selection and scheduling tool with PDF export, calendar sync, and conflict detection.',
      SonicDraft:
        'Bilingual static music-prompt composer. Creates professional Master Prompts for external AI providers.',
      binarauraler: 'Web-based audio tool.',
    };
    if (fallbacks[repo.name]) return fallbacks[repo.name];
    if (repo.readme) {
      const line = repo.readme.split('\n').find((l) => l.trim() && !l.startsWith('#'));
      if (line) return truncate(line, 150);
    }
    if (repo.language) return `Open-source ${repo.language} project, published on GitHub.`;
    return 'Open-source project, published on GitHub.';
  }

  function renderOtherWork() {
    if (!otherGrid) return;
    const sorted = otherRepos
      .filter((r) => r.name && !CONFIG.featuredRepos.includes(r.name))
      .sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''))
      .slice(0, 9);

    if (!sorted.length) {
      otherGrid.innerHTML = `
        <div class="state-note">
          Nothing else to list yet.
          <a href="https://github.com/${CONFIG.githubUsername}?tab=repositories" target="_blank" rel="noopener">Open the repository list</a>
        </div>`;
      return;
    }

    otherGrid.innerHTML = sorted
      .map(
        (repo, i) => `
      <a href="${escapeHtml(repo.html_url)}" target="_blank" rel="noopener" class="other-card reveal" style="--d:${(i % 3) * 0.06}s">
        <span class="other-card-name">${escapeHtml(repo.name)}</span>
        <span class="other-card-lang">${escapeHtml(repo.language || 'n/a')}</span>
      </a>`
      )
      .join('');
  }

  function computeLanguageCounts() {
    const counts = {};
    const add = (lang) => {
      if (lang) counts[lang] = (counts[lang] || 0) + 1;
    };
    const primary = allRepos.filter((repo) => !repo.fork && repo.language);
    const source = primary.length ? primary : featuredRepos;
    source.forEach((repo) => add(repo.language));
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }

  function renderStack() {
    if (!stackGrid) return;
    const entries = computeLanguageCounts();

    if (!entries.length) {
      stackGrid.innerHTML = '<div class="state-note">Stack details appear once repositories load.</div>';
      return;
    }

    stackGrid.innerHTML = entries
      .map(([name, count], i) => {
        const slug = LANG_SLUGS[name];
        const logo = slug
          ? `<img class="stack-logo" src="${iconUrl(name, slug)}" alt="" width="26" height="26" loading="lazy" data-lang="${escapeHtml(name)}" />`
          : `<span class="stack-fallback" aria-hidden="true">${escapeHtml(name.slice(0, 2).toUpperCase())}</span>`;

        return `
      <div class="stack-item reveal" style="--d:${i * 0.05}s">
        ${logo}
        <span class="stack-item-name">${escapeHtml(name)}</span>
        <span class="stack-count">${count} ${count === 1 ? 'repo' : 'repos'}</span>
      </div>`;
      })
      .join('');

    stackGrid.querySelectorAll('img.stack-logo').forEach((img) => {
      img.addEventListener('error', () => {
        const fallback = document.createElement('span');
        fallback.className = 'stack-fallback';
        fallback.setAttribute('aria-hidden', 'true');
        fallback.textContent = (img.dataset.lang || '?').slice(0, 2).toUpperCase();
        img.replaceWith(fallback);
      });
    });
  }

  // --- Modal ---
  let lastFocused = null;

  function openModal(repo) {
    const langs = Object.keys(repo.languages || {});
    const tags = langs.map((l) => `<span class="modal-tag">${escapeHtml(l)}</span>`).join('');
    const stars = repo.stargazers_count || 0;
    const forks = repo.forks_count || 0;
    const name = escapeHtml(repo.name);
    const desc = escapeHtml(repo.description || getFallbackDescription(repo));
    const readmeExcerpt = repo.readme
      ? escapeHtml(truncate(repo.readme.replace(/[#*`]/g, '').trim(), 400))
      : null;

    modalContent.innerHTML = `
      <div class="modal-media">
        <img src="${coverUrl(repo.name)}" alt="Cover photo for ${name}" width="1200" height="600" loading="lazy" />
        <div class="project-media-veil" aria-hidden="true">
          ${langLabel(repo.language)}
          ${githubMark()}
        </div>
      </div>
      <h3 class="modal-title" id="modalTitle">${name}</h3>
      <p class="modal-desc">${desc}</p>
      <div class="modal-meta">
        <div class="modal-meta-item">
          <span class="modal-meta-value">${stars}</span>
          <span class="modal-meta-label">Stars</span>
        </div>
        <div class="modal-meta-item">
          <span class="modal-meta-value">${forks}</span>
          <span class="modal-meta-label">Forks</span>
        </div>
        <div class="modal-meta-item">
          <span class="modal-meta-value">${escapeHtml(repo.language || 'n/a')}</span>
          <span class="modal-meta-label">Primary</span>
        </div>
      </div>
      ${
        langs.length
          ? `<div class="modal-section">
              <p class="modal-section-title">Technologies</p>
              <div class="modal-tags">${tags}</div>
            </div>`
          : ''
      }
      ${
        readmeExcerpt
          ? `<div class="modal-section">
              <p class="modal-section-title">About</p>
              <div class="modal-readme">${readmeExcerpt}</div>
            </div>`
          : ''
      }
      <div class="modal-actions">
        <a href="${escapeHtml(repo.html_url)}" target="_blank" rel="noopener" class="btn btn-primary">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
          View on GitHub
        </a>
      </div>
    `;

    lastFocused = document.activeElement;
    modal.classList.remove('closing');
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    modalClose.focus({ preventScroll: true });
  }

  function closeModal() {
    modal.classList.add('closing');
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';

    setTimeout(() => {
      modal.classList.remove('closing');
    }, 400);

    if (lastFocused && typeof lastFocused.focus === 'function') {
      lastFocused.focus({ preventScroll: true });
    }
    lastFocused = null;
  }

  modalClose.addEventListener('click', closeModal);
  modalBackdrop.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('open')) closeModal();
  });
  modal.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const focusables = modal.querySelectorAll('a[href], button:not([disabled])');
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });

  // --- Navigation ---
  // Nav state is driven by a sentinel instead of a scroll listener
  const topSentinel = document.getElementById('topSentinel');
  if (topSentinel && 'IntersectionObserver' in window) {
    new IntersectionObserver(
      ([entry]) => nav.classList.toggle('scrolled', !entry.isIntersecting),
      { rootMargin: '-72px 0px 0px 0px', threshold: 0 }
    ).observe(topSentinel);
  } else {
    nav.classList.add('scrolled');
  }

  // Active nav link
  const navLinks = Array.from(document.querySelectorAll('.nav-link'));
  const observedSections = navLinks
    .map((link) => document.querySelector(link.getAttribute('href')))
    .filter(Boolean);

  if (observedSections.length && 'IntersectionObserver' in window) {
    const sectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          navLinks.forEach((link) => {
            const active = link.getAttribute('href') === `#${entry.target.id}`;
            link.classList.toggle('active', active);
            if (active) link.setAttribute('aria-current', 'true');
            else link.removeAttribute('aria-current');
          });
        });
      },
      { rootMargin: '-45% 0px -50% 0px', threshold: 0 }
    );
    observedSections.forEach((section) => sectionObserver.observe(section));
  }

  // Smooth scroll for data-scroll links
  document.querySelectorAll('[data-scroll]').forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const target = document.querySelector(link.getAttribute('href'));
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      // Close mobile menu if open
      if (mobileMenu.classList.contains('open')) {
        toggleMobileMenu();
      }
    });
  });

  // --- Mobile menu ---
  function toggleMobileMenu() {
    const isOpen = mobileMenu.classList.toggle('open');
    navBurger.classList.toggle('active', isOpen);
    navBurger.setAttribute('aria-expanded', String(isOpen));
    mobileMenu.setAttribute('aria-hidden', String(!isOpen));
    document.body.style.overflow = isOpen ? 'hidden' : '';

    if (isOpen) {
      mobileMenu.querySelector('a')?.focus({ preventScroll: true });
    }
  }

  navBurger.addEventListener('click', toggleMobileMenu);

  // --- Cursor light ---
  const finePointer = window.matchMedia('(pointer: fine)').matches;
  const allowMotion = window.matchMedia('(prefers-reduced-motion: no-preference)').matches;

  if (cursorLight && finePointer && allowMotion) {
    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    let lightX = mouseX;
    let lightY = mouseY;

    document.addEventListener(
      'mousemove',
      (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;
      },
      { passive: true }
    );

    (function animateCursorLight() {
      lightX += (mouseX - lightX) * 0.08;
      lightY += (mouseY - lightY) * 0.08;
      cursorLight.style.transform = `translate3d(${lightX}px, ${lightY}px, 0) translate(-50%, -50%)`;
      requestAnimationFrame(animateCursorLight);
    })();
  }

  // --- Reveal on scroll ---
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
  );

  function observeReveals() {
    document.querySelectorAll('.reveal:not(.visible)').forEach((el) => {
      revealObserver.observe(el);
    });
  }

  // --- Apply config to static content ---
  function applyConfig() {
    if (CONFIG.hero.eyebrow) {
      const el = document.getElementById('heroEyebrow');
      if (el) el.textContent = CONFIG.hero.eyebrow;
    }
    if (CONFIG.hero.title) {
      const el = document.getElementById('heroTitle');
      if (el) el.textContent = CONFIG.hero.title;
    }
    if (CONFIG.hero.description) {
      const el = document.getElementById('heroDesc');
      if (el) el.innerHTML = CONFIG.hero.description.replace(/\n/g, '<br />');
    }
    if (CONFIG.about.heading) {
      const el = document.getElementById('aboutHeading');
      if (el) el.textContent = CONFIG.about.heading;
    }
    if (CONFIG.about.body) {
      const paras = CONFIG.about.body.split(/\n+/).filter((p) => p.trim());
      const el1 = document.getElementById('aboutBody1');
      const el2 = document.getElementById('aboutBody2');
      if (el1 && paras[0]) el1.textContent = paras[0];
      if (el2 && paras[1]) el2.textContent = paras[1];
    }
    if (CONFIG.contact.heading) {
      const el = document.getElementById('contactTitle');
      if (el) el.textContent = CONFIG.contact.heading;
    }
    if (CONFIG.contact.subtext) {
      const el = document.getElementById('contactSub');
      if (el) el.textContent = CONFIG.contact.subtext;
    }
  }

  // --- Init ---
  function init() {
    applyConfig();

    const yearEl = document.getElementById('footerYear');
    if (yearEl) yearEl.textContent = String(new Date().getFullYear());

    renderSkeletons();
    observeReveals();

    loadData().then(() => {
      // Re-observe after dynamic content renders
      setTimeout(observeReveals, 100);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
