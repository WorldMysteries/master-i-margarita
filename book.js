(function () {
  var THEME_KEY = 'mm_html_theme';
  var MODE_KEY = 'mm_html_mode';
  var SIZE_KEY = 'mm_html_size';
  var BM_KEY = 'mm_html_bookmarks';

  var theme = localStorage.getItem(THEME_KEY) || 'paper';
  var mode = localStorage.getItem(MODE_KEY) || 'spread';
  var fontSize = parseInt(localStorage.getItem(SIZE_KEY) || '18', 10);

  function applyTheme(next) {
    theme = next;
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem(THEME_KEY, next);
    document.querySelectorAll('[data-set-theme]').forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-set-theme') === next);
    });
  }

  function applyFontSize(next) {
    fontSize = Math.min(24, Math.max(15, next));
    document.documentElement.style.setProperty('--reader-font-size', fontSize + 'px');
    localStorage.setItem(SIZE_KEY, String(fontSize));
    var lbl = document.getElementById('fontSizeLabel');
    if (lbl) lbl.textContent = fontSize + ' px';
    if (typeof renderSpread === 'function' && document.body.classList.contains('mode-spread')) {
      renderSpread();
    }
  }

  function applyMode(next) {
    mode = next;
    localStorage.setItem(MODE_KEY, next);
    document.body.classList.toggle('mode-spread', next === 'spread');
    document.querySelectorAll('[data-set-mode]').forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-set-mode') === next);
    });
    if (next === 'spread' && typeof renderSpread === 'function') {
      renderSpread();
    }
  }

  applyTheme(theme);
  document.documentElement.style.setProperty('--reader-font-size', fontSize + 'px');

  document.querySelectorAll('[data-set-theme]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      applyTheme(btn.getAttribute('data-set-theme'));
    });
  });

  document.querySelectorAll('[data-set-mode]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      applyMode(btn.getAttribute('data-set-mode'));
    });
  });

  var decBtn = document.getElementById('fontDec');
  var incBtn = document.getElementById('fontInc');
  if (decBtn) decBtn.addEventListener('click', function () { applyFontSize(fontSize - 1); });
  if (incBtn) incBtn.addEventListener('click', function () { applyFontSize(fontSize + 1); });
  var lbl = document.getElementById('fontSizeLabel');
  if (lbl) lbl.textContent = fontSize + ' px';

  // Chapter Jump Select
  var selectEl = document.getElementById('chapterSelect');
  if (selectEl) {
    selectEl.addEventListener('change', function () {
      if (selectEl.value) window.location.href = selectEl.value;
    });
  }

  // Bookmarks on index & chapter pages
  function getBookmarks() {
    try { return JSON.parse(localStorage.getItem(BM_KEY) || '[]'); } catch (e) { return []; }
  }
  var bmBtn = document.getElementById('bookmarkBtn');
  if (bmBtn) {
    var slug = bmBtn.getAttribute('data-slug');
    var title = bmBtn.getAttribute('data-title');
    function syncBm() {
      var list = getBookmarks();
      var exists = list.some(function (b) { return b.slug === slug; });
      bmBtn.classList.toggle('active', exists);
      bmBtn.textContent = exists ? 'В закладках' : 'Закладка';
    }
    syncBm();
    bmBtn.addEventListener('click', function () {
      var list = getBookmarks();
      var exists = list.some(function (b) { return b.slug === slug; });
      if (exists) {
        list = list.filter(function (b) { return b.slug !== slug; });
      } else {
        list.unshift({ slug: slug, title: title });
      }
      localStorage.setItem(BM_KEY, JSON.stringify(list));
      syncBm();
    });
  }

  // Index TOC search & filter
  var tocSearch = document.getElementById('tocSearch');
  var tocItems = document.querySelectorAll('[data-toc-item]');
  var partTabs = document.querySelectorAll('[data-part-filter]');
  var activePart = 'all';

  function filterToc() {
    var q = (tocSearch ? tocSearch.value : '').trim().toLowerCase();
    tocItems.forEach(function (item) {
      var part = item.getAttribute('data-part');
      var text = item.textContent.toLowerCase();
      var matchPart = activePart === 'all' || part === activePart;
      var matchText = !q || text.indexOf(q) !== -1;
      item.style.display = (matchPart && matchText) ? '' : 'none';
    });
  }
  if (tocSearch) tocSearch.addEventListener('input', filterToc);
  partTabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      activePart = tab.getAttribute('data-part-filter');
      partTabs.forEach(function (t) { t.classList.toggle('active', t === tab); });
      filterToc();
    });
  });

  var bmContainer = document.getElementById('savedBookmarksBox');
  if (bmContainer) {
    var list = getBookmarks();
    if (list.length > 0) {
      bmContainer.style.display = 'block';
      var ul = document.getElementById('savedBookmarksList');
      list.forEach(function (b) {
        var a = document.createElement('a');
        a.href = b.slug + '.html';
        a.className = 'ctrl-btn';
        a.textContent = b.title;
        ul.appendChild(a);
      });
    }
  }

  // Open Book Spread Pagination for chapter pages
  var spreadRoot = document.getElementById('spreadContainer');
  var sourceProse = document.getElementById('chapterSourceProse');
  var spreadIndex = 0;
  var pages = [];

  function buildPages() {
    if (!sourceProse) return [];
    var paras = Array.prototype.slice.call(sourceProse.querySelectorAll('p'));
    var scale = 18 / Math.max(15, fontSize);
    var budget = Math.round(1150 * scale);
    var hasPlate = Boolean(document.getElementById('chapterPlateSource'));
    var openBudget = Math.round((hasPlate ? 500 : 820) * scale);
    var result = [];
    var buf = [];
    var chars = 0;
    var first = true;
    paras.forEach(function (p, i) {
      var len = p.textContent.length + 110;
      var limit = first ? openBudget : budget;
      if (buf.length > 0 && chars + len > limit) {
        result.push({ isFirst: first, paras: buf });
        first = false;
        buf = [{ text: p.textContent, isDrop: i === 0 }];
        chars = len;
      } else {
        buf.push({ text: p.textContent, isDrop: i === 0 });
        chars += len;
      }
    });
    if (buf.length > 0) result.push({ isFirst: first, paras: buf });
    return result;
  }

  function renderPageSlot(el, pageObj, pageNum, totalPages, isHeaderPage) {
    if (!el) return;
    if (!pageObj) {
      el.innerHTML = '<div class="spread-header"><span>Окончание главы</span><span></span></div><div class="spread-body" style="display:flex;align-items:center;justify-content:center;text-align:center;color:var(--muted);"><div><p style="font-family:Cormorant Garamond,serif;font-size:1.8rem;color:var(--ink);margin:0 0 12px;">Конец главы</p><p style="font-size:0.9rem;">Перейдите к следующей главе кнопкой ниже.</p></div></div><div class="spread-footer"><span></span><span></span></div>';
      return;
    }
    var chTitle = spreadRoot.getAttribute('data-chapter-title');
    var chRoman = spreadRoot.getAttribute('data-chapter-roman');
    var chPart = spreadRoot.getAttribute('data-chapter-part');
    var chLoc = spreadRoot.getAttribute('data-chapter-location');
    var epigraphEl = document.getElementById('chapterEpigraphSource');
    var plateEl = document.getElementById('chapterPlateSource');

    var html = '<div class="spread-header"><span>' + (isHeaderPage ? 'М. А. Булгаков · Мастер и Маргарита' : chRoman + ' · ' + chTitle) + '</span><span>' + pageNum + ' / ' + totalPages + '</span></div>';
    html += '<div class="spread-body">';
    if (pageObj.isFirst) {
      html += '<p class="kicker" style="margin-bottom:6px;">' + chPart + ' · ' + chRoman + '</p>';
      html += '<h2 style="font-size:2rem;line-height:1.12;margin-bottom:14px;">' + chTitle + '</h2>';
      if (epigraphEl) {
        html += '<div class="epigraph" style="margin:12px 0 18px;padding:10px 14px;font-size:0.9rem;">' + epigraphEl.innerHTML + '</div>';
      }
      if (plateEl) {
        html += '<figure class="chapter-plate" style="margin:0 0 16px;"><img src="' + plateEl.getAttribute('data-src') + '" alt="" style="max-height:170px;" /><figcaption>' + plateEl.getAttribute('data-caption') + '</figcaption></figure>';
      }
    }
    html += '<div class="prose">';
    pageObj.paras.forEach(function (pr) {
      html += '<p class="' + (pr.isDrop ? 'dropcap' : '') + '">' + pr.text.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</p>';
    });
    html += '</div></div>';
    html += '<div class="spread-footer"><span>' + (isHeaderPage ? chLoc : '') + '</span><span>стр. ' + pageNum + '</span></div>';
    el.innerHTML = html;
  }

  window.renderSpread = function () {
    if (!spreadRoot || !sourceProse) return;
    pages = buildPages();
    var isDesktop = window.innerWidth >= 961;
    var step = isDesktop ? 2 : 1;
    if (spreadIndex >= pages.length) spreadIndex = Math.max(0, pages.length - step);
    if (isDesktop) spreadIndex = Math.floor(spreadIndex / 2) * 2;

    var leftSlot = document.getElementById('spreadLeft');
    var rightSlot = document.getElementById('spreadRight');
    renderPageSlot(leftSlot, pages[spreadIndex], spreadIndex + 1, pages.length, true);
    if (isDesktop) {
      renderPageSlot(rightSlot, pages[spreadIndex + 1], spreadIndex + 2, pages.length, false);
    }

    var indicator = document.getElementById('spreadIndicator');
    if (indicator) {
      if (isDesktop && pages[spreadIndex + 1]) {
        indicator.textContent = 'Стр. ' + (spreadIndex + 1) + '–' + (spreadIndex + 2) + ' из ' + pages.length;
      } else {
        indicator.textContent = 'Стр. ' + (spreadIndex + 1) + ' из ' + pages.length;
      }
    }
  };

  if (spreadRoot && sourceProse) {
    applyMode(mode);
    var prevBtn = document.getElementById('spreadPrev');
    var nextBtn = document.getElementById('spreadNext');
    function goPrev() {
      var step = window.innerWidth >= 961 ? 2 : 1;
      if (spreadIndex > 0) {
        spreadIndex = Math.max(0, spreadIndex - step);
        renderSpread();
      } else {
        var pHref = spreadRoot.getAttribute('data-prev-href');
        if (pHref) window.location.href = pHref;
      }
    }
    function goNext() {
      var step = window.innerWidth >= 961 ? 2 : 1;
      if (spreadIndex + step < pages.length) {
        spreadIndex += step;
        renderSpread();
      } else {
        var nHref = spreadRoot.getAttribute('data-next-href');
        if (nHref) window.location.href = nHref;
      }
    }
    if (prevBtn) prevBtn.addEventListener('click', goPrev);
    if (nextBtn) nextBtn.addEventListener('click', goNext);
    window.addEventListener('resize', function () {
      if (mode === 'spread') renderSpread();
    });
    document.addEventListener('keydown', function (e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
      if (mode === 'spread') {
        if (e.key === 'ArrowLeft') { e.preventDefault(); goPrev(); }
        if (e.key === 'ArrowRight') { e.preventDefault(); goNext(); }
      } else {
        if (e.key === 'ArrowLeft') {
          var p = document.querySelector('.chapter-pager a.prev-link');
          if (p) window.location.href = p.getAttribute('href');
        } else if (e.key === 'ArrowRight') {
          var n = document.querySelector('.chapter-pager a.next-link');
          if (n) window.location.href = n.getAttribute('href');
        }
      }
    });
  }
})();
