/**
 * Book Catalog - Static Data Integration (Atom One Dark Theme)
 * Fetches compiled book catalog from data/catalog.json (synced via scripts/sync.py)
 */

document.addEventListener('DOMContentLoaded', () => {
  let catalogData = null;

  // App State
  const state = {
    selectedYear: 'ALL',
    selectedCategory: 'ALL',
    selectedLanguage: 'ALL',
    selectedTag: 'ALL',
    searchQuery: '',
    sortBy: 'date-desc',
    viewMode: 'grid',
    theme: localStorage.getItem('catalog_theme') || 'dark',
    isSyncing: false
  };

  // Safe Helper to set innerHTML
  function setHtml(idOrEl, html) {
    const el = typeof idOrEl === 'string' ? document.getElementById(idOrEl) : idOrEl;
    if (el) el.innerHTML = html;
  }

  // Safe Helper to set textContent
  function setText(idOrEl, text) {
    const el = typeof idOrEl === 'string' ? document.getElementById(idOrEl) : idOrEl;
    if (el) el.textContent = text;
  }

  // DOM Elements Querying
  function getEl(id) {
    return document.getElementById(id);
  }

  // Initialize Theme
  document.documentElement.setAttribute('data-theme', state.theme);
  updateThemeIcon();

  // Load Catalog Data from data/catalog.json
  loadCatalogData();

  async function loadCatalogData() {
    showLoadingState();

    try {
      const res = await fetch('data/catalog.json?v=' + Date.now());
      if (!res.ok) {
        throw new Error(`Failed to load catalog.json (${res.status} ${res.statusText})`);
      }
      catalogData = await res.json();
      initApp();
    } catch (err) {
      console.error("Catalog load error:", err);
      setHtml('catalog-display', `
        <div style="text-align: center; padding: 3rem; color: var(--color-red);">
          ⚠️ Error loading book catalog. Please ensure <code>python scripts/sync.py</code> has been run.
        </div>
      `);
    }
  }

  function showLoadingState() {
    setHtml('catalog-display', `
      <div style="text-align: center; padding: 4rem 1rem; color: var(--text-muted);">
        <div style="font-size: 1.5rem; margin-bottom: 0.5rem; color: var(--accent-primary);">⚡ Loading reading catalog...</div>
        <div>Reading compiled catalog data...</div>
      </div>
    `);
  }

  function initApp() {
    setupEventListeners();
    renderYearPills();
    renderTagBar();
    applyFiltersAndRender();
  }

  function setupEventListeners() {
    const themeBtn = getEl('theme-toggle');
    if (themeBtn) {
      themeBtn.onclick = () => {
        state.theme = state.theme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', state.theme);
        localStorage.setItem('catalog_theme', state.theme);
        updateThemeIcon();
      };
    }

    const search = getEl('search-input');
    if (search) {
      search.oninput = (e) => {
        state.searchQuery = e.target.value.toLowerCase().trim();
        applyFiltersAndRender();
      };
    }

    const catSelect = getEl('category-select');
    if (catSelect) {
      catSelect.onchange = (e) => {
        state.selectedCategory = e.target.value;
        applyFiltersAndRender();
      };
    }

    const langSelect = getEl('language-select');
    if (langSelect) {
      langSelect.onchange = (e) => {
        state.selectedLanguage = e.target.value;
        applyFiltersAndRender();
      };
    }

    const sSelect = getEl('sort-select');
    if (sSelect) {
      sSelect.onchange = (e) => {
        state.sortBy = e.target.value;
        applyFiltersAndRender();
      };
    }

    const gridBtn = getEl('view-grid-btn');
    const tableBtn = getEl('view-table-btn');

    if (gridBtn) {
      gridBtn.onclick = () => {
        state.viewMode = 'grid';
        gridBtn.style.borderColor = 'var(--accent-primary)';
        if (tableBtn) tableBtn.style.borderColor = 'var(--border-color)';
        applyFiltersAndRender();
      };
    }

    if (tableBtn) {
      tableBtn.onclick = () => {
        state.viewMode = 'table';
        tableBtn.style.borderColor = 'var(--accent-primary)';
        if (gridBtn) gridBtn.style.borderColor = 'var(--border-color)';
        applyFiltersAndRender();
      };
    }

    const modalClose = getEl('modal-close');
    const modalOverlay = getEl('modal-overlay');
    if (modalClose) modalClose.onclick = closeModal;
    if (modalOverlay) {
      modalOverlay.onclick = (e) => {
        if (e.target === modalOverlay) closeModal();
      };
    }
    document.onkeydown = (e) => {
      if (e.key === 'Escape') closeModal();
    };
  }

  function updateThemeIcon() {
    setHtml('theme-toggle', state.theme === 'dark' ? '☀️ Light' : '🌙 Dark');
  }

  function renderYearPills() {
    if (!catalogData) return;
    const readBooks = catalogData.books.filter(b => b.read_status);

    let html = `
      <button class="year-pill ${state.selectedYear === 'ALL' ? 'active' : ''}" data-year="ALL">
        All <span class="count-tag">${readBooks.length}</span>
      </button>
    `;

    catalogData.years.forEach(yr => {
      const count = catalogData.years_breakdown[yr] || 0;
      const isSelected = state.selectedYear === String(yr);

      html += `
        <button class="year-pill ${isSelected ? 'active' : ''}" data-year="${yr}">
          ${yr} <span class="count-tag">${count}</span>
        </button>
      `;
    });

    setHtml('year-pills', html);

    const yearPillsContainer = getEl('year-pills');
    if (yearPillsContainer) {
      yearPillsContainer.querySelectorAll('.year-pill').forEach(btn => {
        btn.onclick = () => {
          state.selectedYear = btn.dataset.year;
          renderYearPills();
          applyFiltersAndRender();
        };
      });
    }
  }

  function renderTagBar() {
    if (!catalogData) return;
    const tagCounts = {};
    catalogData.books.filter(b => b.read_status).forEach(b => {
      (b.tags || []).forEach(t => {
        tagCounts[t] = (tagCounts[t] || 0) + 1;
      });
    });

    const sortedTags = Object.keys(tagCounts).sort((a, b) => tagCounts[b] - tagCounts[a]);

    let html = `
      <button class="tag-pill ${state.selectedTag === 'ALL' ? 'active' : ''}" data-tag="ALL">
        All Tags
      </button>
    `;

    sortedTags.forEach(tag => {
      html += `
        <button class="tag-pill ${state.selectedTag === tag ? 'active' : ''}" data-tag="${tag}">
          #${tag} (${tagCounts[tag]})
        </button>
      `;
    });

    setHtml('tag-bar', html);

    const tagContainer = getEl('tag-bar');
    if (tagContainer) {
      tagContainer.querySelectorAll('.tag-pill').forEach(btn => {
        btn.onclick = () => {
          state.selectedTag = btn.dataset.tag;
          renderTagBar();
          applyFiltersAndRender();
        };
      });
    }
  }

  function applyFiltersAndRender() {
    if (!catalogData) return;

    let filtered = catalogData.books.filter(b => b.read_status);

    if (state.selectedYear !== 'ALL') {
      filtered = filtered.filter(b => String(b.read_year) === state.selectedYear);
    }

    if (state.selectedCategory !== 'ALL') {
      filtered = filtered.filter(b => b.category.toLowerCase() === state.selectedCategory.toLowerCase());
    }

    if (state.selectedLanguage !== 'ALL') {
      filtered = filtered.filter(b => b.language.toLowerCase() === state.selectedLanguage.toLowerCase());
    }

    if (state.selectedTag !== 'ALL') {
      filtered = filtered.filter(b => (b.tags || []).includes(state.selectedTag));
    }

    if (state.searchQuery) {
      const q = state.searchQuery;
      filtered = filtered.filter(b => 
        b.title.toLowerCase().includes(q) ||
        b.author.toLowerCase().includes(q) ||
        (b.personal_notes && b.personal_notes.toLowerCase().includes(q)) ||
        (b.tags && b.tags.some(t => t.toLowerCase().includes(q)))
      );
    }

    if (state.sortBy === 'date-desc') {
      filtered.sort((a, b) => (b.effective_date || '').localeCompare(a.effective_date || ''));
    } else if (state.sortBy === 'date-asc') {
      filtered.sort((a, b) => (a.effective_date || '').localeCompare(b.effective_date || ''));
    } else if (state.sortBy === 'title-asc') {
      filtered.sort((a, b) => a.title.localeCompare(b.title));
    }

    updateStats(filtered);

    if (state.viewMode === 'grid') {
      renderGridView(filtered);
    } else {
      renderTableView(filtered);
    }
  }

  function updateStats(currentFilteredBooks) {
    const totalRead = catalogData.books.filter(b => b.read_status).length;
    setText('stat-total-read', totalRead);
    setText('stat-active-year', currentFilteredBooks.length);

    if (state.selectedYear === 'ALL') {
      setText('active-year-label', "All Years");
    } else {
      setText('active-year-label', `Read ${state.selectedYear}`);
    }

    const authorsSet = new Set(currentFilteredBooks.map(b => b.author));
    setText('stat-total-authors', authorsSet.size);

    const catCounts = {};
    currentFilteredBooks.forEach(b => {
      catCounts[b.category] = (catCounts[b.category] || 0) + 1;
    });
    let topCat = 'N/A';
    let maxC = 0;
    for (const cat in catCounts) {
      if (catCounts[cat] > maxC) {
        maxC = catCounts[cat];
        topCat = cat;
      }
    }
    setText('stat-top-category', topCat);

    const tagCounts = {};
    currentFilteredBooks.forEach(b => {
      (b.tags || []).forEach(t => {
        tagCounts[t] = (tagCounts[t] || 0) + 1;
      });
    });
    let topTag = 'N/A';
    let maxT = 0;
    for (const tag in tagCounts) {
      if (tagCounts[tag] > maxT) {
        maxT = tagCounts[tag];
        topTag = `#${tag}`;
      }
    }
    setText('stat-top-tag', topTag);
  }

  function renderGridView(books) {
    if (books.length === 0) {
      setHtml('catalog-display', `<div style="text-align: center; padding: 3rem; color: var(--text-muted);">No books match criteria.</div>`);
      return;
    }

    let html = '<div class="book-grid">';
    books.forEach(b => {
      const categoryClass = b.category.toLowerCase() === 'fiction' ? 'fiction' : 'nonfiction';
      const tagsHtml = (b.tags || []).map(t => `<span class="book-tag">#${t}</span>`).join('');
      
      const notesSnippet = b.personal_notes 
        ? `<div class="notes-snippet">"${escapeHtml(b.personal_notes)}"</div>` 
        : '';

      const notesActionBtn = b.personal_notes 
        ? `<button class="btn-notes" onclick="window.openBookModal('${b.id}')">Notes</button>`
        : `<span style="font-size: 0.7rem; color: var(--text-muted);">No notes</span>`;

      html += `
        <div class="book-card">
          <div>
            <div class="card-top">
              <div class="badges">
                <span class="badge ${categoryClass}">${escapeHtml(b.category)}</span>
                <span class="badge language">${escapeHtml(b.language)}</span>
                ${b.bought ? '<span class="badge bought">Bought</span>' : ''}
              </div>
              <span class="card-year">${b.read_year}</span>
            </div>
            
            <h3 class="book-title" title="${escapeHtml(b.title)}">${escapeHtml(b.title)}</h3>
            <div class="book-author">${escapeHtml(b.author)}</div>
            
            ${tagsHtml ? `<div class="book-tags">${tagsHtml}</div>` : ''}
            ${notesSnippet}
          </div>

          <div class="card-footer">
            ${notesActionBtn}
          </div>
        </div>
      `;
    });
    html += '</div>';
    setHtml('catalog-display', html);
  }

  function renderTableView(books) {
    if (books.length === 0) {
      setHtml('catalog-display', `<div style="text-align: center; padding: 3rem; color: var(--text-muted);">No books match criteria.</div>`);
      return;
    }

    let html = `
      <table class="book-table">
        <thead>
          <tr>
            <th>Year</th>
            <th>Title</th>
            <th>Author</th>
            <th>Category</th>
            <th>Language</th>
            <th>Tags</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
    `;

    books.forEach(b => {
      const categoryClass = b.category.toLowerCase() === 'fiction' ? 'fiction' : 'nonfiction';
      const tagsHtml = (b.tags || []).map(t => `<span class="book-tag">#${t}</span>`).join(' ');
      const notesBtn = b.personal_notes 
        ? `<button class="btn-notes" onclick="window.openBookModal('${b.id}')">View Notes</button>` 
        : '-';

      html += `
        <tr>
          <td><span class="card-year">${b.read_year}</span></td>
          <td><strong>${escapeHtml(b.title)}</strong></td>
          <td>${escapeHtml(b.author)}</td>
          <td><span class="badge ${categoryClass}">${escapeHtml(b.category)}</span></td>
          <td><span class="badge language">${escapeHtml(b.language)}</span></td>
          <td>${tagsHtml}</td>
          <td>${notesBtn}</td>
        </tr>
      `;
    });

    html += `</tbody></table>`;
    setHtml('catalog-display', html);
  }

  window.openBookModal = function(bookId) {
    if (!catalogData) return;
    const book = catalogData.books.find(b => b.id === bookId);
    if (!book) return;

    setText('modal-title', book.title);
    setText('modal-author', `By ${book.author}`);
    
    const categoryClass = book.category.toLowerCase() === 'fiction' ? 'fiction' : 'nonfiction';
    const tagsHtml = (book.tags || []).map(t => `<span class="book-tag">#${t}</span>`).join('');

    setHtml('modal-badges', `
      <span class="badge ${categoryClass}">${escapeHtml(book.category)}</span>
      <span class="badge language">${escapeHtml(book.language)}</span>
      <span class="card-year">Read ${book.read_year}</span>
      ${book.bought ? '<span class="badge bought">Bought</span>' : ''}
      <div class="book-tags" style="margin-top: 0.3rem;">${tagsHtml}</div>
    `);

    setText('modal-notes-body', book.personal_notes || "No notes recorded.");

    const modalOverlay = getEl('modal-overlay');
    if (modalOverlay) {
      modalOverlay.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
  };

  function closeModal() {
    const modalOverlay = getEl('modal-overlay');
    if (modalOverlay) {
      modalOverlay.classList.remove('active');
      document.body.style.overflow = '';
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
});
