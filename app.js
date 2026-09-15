/**
 * MangaVault - Personal Manga Collection Catalog
 * Handles Google Sheets live sync, hybrid cover fetching, search & filtering, and statistics.
 */

// Configuration & State
const CONFIG = {
  SHEET_CSV_URL: 'https://docs.google.com/spreadsheets/d/1Xew5o7ULMmckqOhxIlBQJ1dqHGbREYCGxv47hvkFPS8/gviz/tq?tqx=out:csv',
  JIKAN_API_URL: 'https://api.jikan.moe/v4/manga',
  CACHE_PREFIX: 'mv_cover_cache_v2_',
  ITEMS_PER_PAGE: 36,
  RATE_LIMIT_DELAY: 350 // ms between Jikan API calls to avoid 429
};

// Title translation/mapping for better Jikan API matching on Indonesian localized titles
const TITLE_MAPPINGS = {
  'detektif conan premium': 'Detective Conan',
  'detektif conan': 'Detective Conan',
  'detektif kindaichi 37 tahun': 'Kindaichi 37-sai no Jikenbo',
  'detektif kindaichi premium': 'Kindaichi Shounen no Jikenbo',
  'hanako si arwah penasaran': 'Jibaku Shounen Hanako-kun',
  'samurai x: hokkaido arc': 'Rurouni Kenshin: Meiji Kenkaku Romantan - Hokkaido-hen',
  'komikus shojo nozaki': 'Gekkan Shoujo Nozaki-kun',
  'aku no hana : kembang jahanam': 'Aku no Hana',
  'i want to eat your pancreass': 'Kimi no Suizou wo Tabetai',
  'haikyu! fly high volleyball!': 'Haikyuu!!',
  'gokushufudo - the way of house husband': 'Gokushufudou',
  'frieren: after the end': 'Sousou no Frieren',
  'dr. stone': 'Dr. Stone',
  'oshi no ko: anak idola': 'Oshi no Ko',
  'hibiki: kiat menjadi novelis': 'Hibiki: Shousetsuka ni Naru Houhou'
};

const state = {
  allManga: [],
  filteredManga: [],
  currentPage: 1,
  activeFilter: {
    status: 'all',
    publisher: 'all',
    type: 'all',
    search: '',
    sort: 'no-asc'
  },
  viewMode: 'grid',
  coverQueue: [],
  isProcessingQueue: false,
  observer: null
};

// DOM Elements
const DOM = {
  statTotalTitles: document.getElementById('statTotalTitles'),
  statTotalVolumes: document.getElementById('statTotalVolumes'),
  statComplete: document.getElementById('statComplete'),
  statCompletePercent: document.getElementById('statCompletePercent'),
  statBolong: document.getElementById('statBolong'),
  statLater: document.getElementById('statLater'),

  searchInput: document.getElementById('searchInput'),
  btnClearSearch: document.getElementById('btnClearSearch'),
  statusTabs: document.getElementById('statusTabs'),
  publisherFilter: document.getElementById('publisherFilter'),
  typeFilter: document.getElementById('typeFilter'),
  sortFilter: document.getElementById('sortFilter'),

  btnGridView: document.getElementById('btnGridView'),
  btnListView: document.getElementById('btnListView'),
  btnSync: document.getElementById('btnSync'),
  syncStatusText: document.getElementById('syncStatusText'),

  resultsCount: document.getElementById('resultsCount'),
  mangaGrid: document.getElementById('mangaGrid'),
  mangaTableContainer: document.getElementById('mangaTableContainer'),
  mangaTableBody: document.getElementById('mangaTableBody'),
  emptyState: document.getElementById('emptyState'),
  btnResetFilters: document.getElementById('btnResetFilters'),

  paginationWrapper: document.getElementById('paginationWrapper'),
  btnLoadMore: document.getElementById('btnLoadMore'),
  loadMoreCount: document.getElementById('loadMoreCount'),

  detailModal: document.getElementById('detailModal'),
  btnModalClose: document.getElementById('btnModalClose'),
  modalCoverImg: document.getElementById('modalCoverImg'),
  modalCoverFallback: document.getElementById('modalCoverFallback'),
  modalTitle: document.getElementById('modalTitle'),
  modalAuthor: document.getElementById('modalAuthor'),
  modalTypeBadge: document.getElementById('modalTypeBadge'),
  modalPublisherBadge: document.getElementById('modalPublisherBadge'),
  modalStatusBadge: document.getElementById('modalStatusBadge'),
  modalVolumeProgressText: document.getElementById('modalVolumeProgressText'),
  modalVolumeProgressBar: document.getElementById('modalVolumeProgressBar'),
  modalPunyaVolume: document.getElementById('modalPunyaVolume'),
  modalTotalTerbit: document.getElementById('modalTotalTerbit'),
  modalStatusTerbit: document.getElementById('modalStatusTerbit'),
  modalTotalKoleksi: document.getElementById('modalTotalKoleksi'),
  modalCatatan: document.getElementById('modalCatatan'),
  modalMalLink: document.getElementById('modalMalLink'),
  modalGoogleLink: document.getElementById('modalGoogleLink'),

  toastContainer: document.getElementById('toastContainer')
};

// ==========================================
// Initialization
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  setupIntersectionObserver();

  // Load initial data from data.js
  if (window.INITIAL_MANGA_DATA && Array.isArray(window.INITIAL_MANGA_DATA)) {
    loadData(window.INITIAL_MANGA_DATA);
  } else {
    // Or fetch from sheet directly
    syncWithGoogleSheet();
  }
});

function loadData(data) {
  state.allManga = data;
  populatePublishersDropdown();
  updateStatistics();
  applyFilters();
}

// ==========================================
// Google Sheets Live Sync
// ==========================================
async function syncWithGoogleSheet() {
  DOM.syncStatusText.textContent = 'Menyinkronkan...';
  DOM.btnSync.classList.add('loading');

  try {
    const response = await fetch(CONFIG.SHEET_CSV_URL);
    if (!response.ok) throw new Error('Gagal mengakses Google Sheets');

    const csvText = await response.text();
    const parsedData = parseCSV(csvText);

    if (parsedData.length > 0) {
      state.allManga = parsedData;
      populatePublishersDropdown();
      updateStatistics();
      applyFilters();
      DOM.syncStatusText.textContent = `Tersinkron: ${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
      showToast(`Berhasil menyinkronkan ${parsedData.length} data komik!`, 'success');
    }
  } catch (error) {
    console.error('Sync error:', error);
    DOM.syncStatusText.textContent = 'Gagal sinkron (pakai data lokal)';
    showToast('Gagal sinkron dengan Google Sheets. Menggunakan data cadangan.', 'warning');
  } finally {
    DOM.btnSync.classList.remove('loading');
  }
}

function parseCSV(text) {
  const lines = text.split('\n');
  const items = [];
  let headerIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('Judul') && lines[i].includes('Pengarang')) {
      headerIndex = i;
      break;
    }
  }

  if (headerIndex === -1) headerIndex = 0;

  for (let i = headerIndex + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const row = parseCSVLine(line);
    if (!row[1] || row[1].trim() === '' || row[1].toLowerCase().includes('total')) continue;

    items.push({
      no: parseInt(row[0]) || (items.length + 1),
      judul: row[1] || '',
      pengarang: row[2] || '',
      penerbit: row[3] || '',
      story: row[4] || '',
      art: row[5] || '',
      originalDesign: row[6] || '',
      jenis: row[7] || 'Series',
      statusTerbit: row[8] || '',
      totalVolume: parseInt(row[9]) || row[9] || '',
      statusKoleksi: row[10] || 'Lainnya',
      punyaVolume: row[11] || '',
      totalKoleksi: parseInt(row[12]) || row[12] || 0,
      catatan: row[13] || ''
    });
  }

  return items;
}

function parseCSVLine(line) {
  const result = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      result.push(cur.replace(/^"|"$/g, '').trim());
      cur = '';
    } else {
      cur += c;
    }
  }
  result.push(cur.replace(/^"|"$/g, '').trim());
  return result;
}

// ==========================================
// Statistics
// ==========================================
function updateStatistics() {
  const totalTitles = state.allManga.length;
  let totalVolumes = 0;
  let completeCount = 0;
  let bolongCount = 0;
  let laterCount = 0;

  state.allManga.forEach(item => {
    const vol = typeof item.totalKoleksi === 'number' ? item.totalKoleksi : parseInt(item.totalKoleksi) || 0;
    totalVolumes += vol;

    const status = (item.statusKoleksi || '').toLowerCase();
    if (status.includes('komplit') || status.includes('lengkap')) {
      completeCount++;
    } else if (status.includes('bolong')) {
      bolongCount++;
    } else if (status.includes('nanti')) {
      laterCount++;
    }
  });

  DOM.statTotalTitles.textContent = totalTitles.toLocaleString('id-ID');
  DOM.statTotalVolumes.textContent = totalVolumes.toLocaleString('id-ID');
  DOM.statComplete.textContent = completeCount.toLocaleString('id-ID');
  DOM.statBolong.textContent = bolongCount.toLocaleString('id-ID');
  DOM.statLater.textContent = laterCount.toLocaleString('id-ID');

  const percent = totalTitles > 0 ? Math.round((completeCount / totalTitles) * 100) : 0;
  DOM.statCompletePercent.textContent = `${percent}%`;
}

// ==========================================
// Filter, Search, and Sort Logic
// ==========================================
function populatePublishersDropdown() {
  const publishers = new Set();
  state.allManga.forEach(item => {
    if (item.penerbit && item.penerbit.trim()) {
      publishers.add(item.penerbit.trim());
    }
  });

  const sortedPublishers = Array.from(publishers).sort();
  const curVal = DOM.publisherFilter.value;
  DOM.publisherFilter.innerHTML = '<option value="all">Semua Penerbit</option>';

  sortedPublishers.forEach(pub => {
    const opt = document.createElement('option');
    opt.value = pub;
    opt.textContent = pub;
    DOM.publisherFilter.appendChild(opt);
  });

  if (curVal) DOM.publisherFilter.value = curVal;
}

function applyFilters() {
  const { status, publisher, type, search, sort } = state.activeFilter;
  const q = search.trim().toLowerCase();

  state.filteredManga = state.allManga.filter(item => {
    // Status filter
    if (status !== 'all') {
      const itemStatus = (item.statusKoleksi || '').toLowerCase();
      if (status === 'Komplit' && !itemStatus.includes('komplit')) return false;
      if (status === 'Bolong-bolong' && !itemStatus.includes('bolong')) return false;
      if (status === 'Nanti dulu deh' && !itemStatus.includes('nanti')) return false;
    }

    // Publisher filter
    if (publisher !== 'all' && (item.penerbit || '').trim() !== publisher) {
      return false;
    }

    // Type filter
    if (type !== 'all' && (item.jenis || '').trim().toLowerCase() !== type.toLowerCase()) {
      return false;
    }

    // Search query
    if (q) {
      const titleMatch = (item.judul || '').toLowerCase().includes(q);
      const authorMatch = (item.pengarang || '').toLowerCase().includes(q) || (item.story || '').toLowerCase().includes(q);
      const pubMatch = (item.penerbit || '').toLowerCase().includes(q);
      const noteMatch = (item.catatan || '').toLowerCase().includes(q);
      if (!titleMatch && !authorMatch && !pubMatch && !noteMatch) return false;
    }

    return true;
  });

  // Sort
  state.filteredManga.sort((a, b) => {
    switch (sort) {
      case 'no-asc': return a.no - b.no;
      case 'no-desc': return b.no - a.no;
      case 'title-asc': return (a.judul || '').localeCompare(b.judul || '');
      case 'title-desc': return (b.judul || '').localeCompare(a.judul || '');
      case 'vol-desc': return (parseInt(b.totalKoleksi) || 0) - (parseInt(a.totalKoleksi) || 0);
      case 'vol-asc': return (parseInt(a.totalKoleksi) || 0) - (parseInt(b.totalKoleksi) || 0);
      default: return a.no - b.no;
    }
  });

  state.currentPage = 1;
  renderView();
}

// ==========================================
// Rendering
// ==========================================
function renderView() {
  const total = state.filteredManga.length;
  DOM.resultsCount.textContent = `Menampilkan ${total} dari ${state.allManga.length} buku`;

  if (total === 0) {
    DOM.mangaGrid.style.display = 'none';
    DOM.mangaTableContainer.style.display = 'none';
    DOM.paginationWrapper.style.display = 'none';
    DOM.emptyState.style.display = 'block';
    return;
  }

  DOM.emptyState.style.display = 'none';

  if (state.viewMode === 'grid') {
    DOM.mangaTableContainer.style.display = 'none';
    DOM.mangaGrid.style.display = 'grid';
    renderGrid();
  } else {
    DOM.mangaGrid.style.display = 'none';
    DOM.mangaTableContainer.style.display = 'block';
    renderTable();
  }

  updatePagination();
}

function renderGrid() {
  const countToShow = state.currentPage * CONFIG.ITEMS_PER_PAGE;
  const itemsToRender = state.filteredManga.slice(0, countToShow);

  // If on page 1, clear container; otherwise append newly loaded items
  if (state.currentPage === 1) {
    DOM.mangaGrid.innerHTML = '';
  }

  const existingCount = DOM.mangaGrid.children.length;
  const newItems = itemsToRender.slice(existingCount);

  const fragment = document.createDocumentFragment();

  newItems.forEach(item => {
    const card = document.createElement('div');
    card.className = 'manga-card';
    card.dataset.no = item.no;

    const statusBadge = getStatusBadge(item.statusKoleksi);
    const publisherName = item.penerbit || 'Umum';
    const cleanTitle = getCleanTitle(item.judul);

    // Volume calculation
    const totalKoleksi = parseInt(item.totalKoleksi) || 0;
    const totalVolume = parseInt(item.totalVolume) || 0;
    const progressPercent = totalVolume > 0 ? Math.min(100, Math.round((totalKoleksi / totalVolume) * 100)) : (totalKoleksi > 0 ? 100 : 0);

    card.innerHTML = `
      <div class="card-cover-container" data-title="${encodeURIComponent(cleanTitle)}" data-raw-title="${encodeURIComponent(item.judul)}">
        <span class="card-number-badge">#${item.no}</span>
        <span class="card-status-badge ${statusBadge.class}">${statusBadge.label}</span>
        
        <!-- Image element for Jikan / cached cover -->
        <img class="card-cover-img" alt="${escapeHTML(item.judul)}" loading="lazy">
        
        <!-- Fallback stylized book cover if image not yet loaded/found -->
        <div class="card-fallback-cover">
          <span class="fallback-publisher">${escapeHTML(publisherName)}</span>
          <h3 class="fallback-title">${escapeHTML(item.judul)}</h3>
          <p class="fallback-author">${escapeHTML(item.pengarang || item.story || '-')}</p>
          <span class="fallback-volume-tag">${totalKoleksi} Vol</span>
        </div>
      </div>

      <div class="card-body">
        <div class="card-meta-header">
          <span class="card-publisher">${escapeHTML(publisherName)}</span>
          <span class="card-type">${escapeHTML(item.jenis || 'Series')}</span>
        </div>
        <h3 class="card-title" title="${escapeHTML(item.judul)}">${escapeHTML(item.judul)}</h3>
        <p class="card-author">${escapeHTML(item.pengarang || item.story || '-')}</p>
        
        <div class="card-footer-info">
          <div class="card-volume-bar-wrap">
            <span>Volume: ${totalKoleksi}${totalVolume > 0 ? ' / ' + totalVolume : ''}</span>
            <span>${progressPercent}%</span>
          </div>
          <div class="volume-mini-progress">
            <div class="volume-mini-fill" style="width: ${progressPercent}%;"></div>
          </div>
        </div>
      </div>
    `;

    card.addEventListener('click', () => openDetailModal(item));

    // Observe cover container for lazy loading cover from Jikan API
    const coverContainer = card.querySelector('.card-cover-container');
    if (state.observer) {
      state.observer.observe(coverContainer);
    }

    fragment.appendChild(card);
  });

  DOM.mangaGrid.appendChild(fragment);
}

function renderTable() {
  const countToShow = state.currentPage * CONFIG.ITEMS_PER_PAGE;
  const itemsToRender = state.filteredManga.slice(0, countToShow);

  DOM.mangaTableBody.innerHTML = '';
  const fragment = document.createDocumentFragment();

  itemsToRender.forEach(item => {
    const tr = document.createElement('tr');
    tr.dataset.no = item.no;

    const statusBadge = getStatusBadge(item.statusKoleksi);
    const cleanTitle = getCleanTitle(item.judul);
    const cachedCover = getCachedCover(cleanTitle);

    tr.innerHTML = `
      <td><strong>#${item.no}</strong></td>
      <td>
        ${cachedCover ? `<img src="${cachedCover}" class="table-thumb" alt="cover">` : `<div class="table-thumb" style="background:#1e293b;display:flex;align-items:center;justify-content:center;font-size:10px;">📖</div>`}
      </td>
      <td><strong>${escapeHTML(item.judul)}</strong></td>
      <td>${escapeHTML(item.pengarang || item.story || '-')}</td>
      <td><span class="card-publisher">${escapeHTML(item.penerbit || '-')}</span></td>
      <td>${escapeHTML(item.statusTerbit || '-')}</td>
      <td>${escapeHTML(item.punyaVolume || (item.totalKoleksi ? item.totalKoleksi + ' Vol' : '-'))}</td>
      <td><span class="table-badge ${statusBadge.class}">${statusBadge.label}</span></td>
      <td style="color:#94a3b8;font-size:0.78rem;">${escapeHTML(item.catatan || '-')}</td>
    `;

    tr.addEventListener('click', () => openDetailModal(item));
    fragment.appendChild(tr);
  });

  DOM.mangaTableBody.appendChild(fragment);
}

function updatePagination() {
  const total = state.filteredManga.length;
  const countShown = Math.min(total, state.currentPage * CONFIG.ITEMS_PER_PAGE);

  if (countShown < total) {
    DOM.paginationWrapper.style.display = 'flex';
    DOM.loadMoreCount.textContent = `(${total - countShown} tersisa)`;
  } else {
    DOM.paginationWrapper.style.display = 'none';
  }
}

function loadMore() {
  state.currentPage++;
  if (state.viewMode === 'grid') {
    renderGrid();
  } else {
    renderTable();
  }
  updatePagination();
}

// ==========================================
// Hybrid Cover Fetching & Caching System
// ==========================================
function setupIntersectionObserver() {
  if (!('IntersectionObserver' in window)) return;

  state.observer = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const container = entry.target;
        observer.unobserve(container);
        queueCoverFetch(container);
      }
    });
  }, {
    rootMargin: '200px 0px',
    threshold: 0.01
  });
}

function queueCoverFetch(container) {
  const cleanTitle = decodeURIComponent(container.dataset.title || '');
  const rawTitle = decodeURIComponent(container.dataset.rawTitle || '');
  if (!cleanTitle) return;

  // 1. Check local storage cache
  const cachedUrl = getCachedCover(cleanTitle);
  if (cachedUrl) {
    if (cachedUrl !== 'none') {
      applyCoverToContainer(container, cachedUrl);
    }
    return;
  }

  // 2. Add to fetch queue
  state.coverQueue.push({ container, cleanTitle, rawTitle });
  processCoverQueue();
}

async function processCoverQueue() {
  if (state.isProcessingQueue || state.coverQueue.length === 0) return;
  state.isProcessingQueue = true;

  while (state.coverQueue.length > 0) {
    const { container, cleanTitle, rawTitle } = state.coverQueue.shift();

    // Check again if now cached
    const cached = getCachedCover(cleanTitle);
    if (cached) {
      if (cached !== 'none') applyCoverToContainer(container, cached);
      continue;
    }

    try {
      const coverUrl = await fetchCoverFromJikan(cleanTitle, rawTitle);
      if (coverUrl) {
        setCachedCover(cleanTitle, coverUrl);
        applyCoverToContainer(container, coverUrl);
      } else {
        setCachedCover(cleanTitle, 'none');
      }
    } catch (err) {
      console.warn('Cover fetch rate limit or network error for:', cleanTitle, err);
      // Wait longer on error
      await sleep(1000);
    }

    await sleep(CONFIG.RATE_LIMIT_DELAY);
  }

  state.isProcessingQueue = false;
}

async function fetchCoverFromJikan(cleanTitle, rawTitle) {
  // Check special mappings first
  const mapped = TITLE_MAPPINGS[rawTitle.toLowerCase()] || TITLE_MAPPINGS[cleanTitle.toLowerCase()];
  const query = mapped || cleanTitle;

  const url = `${CONFIG.JIKAN_API_URL}?q=${encodeURIComponent(query)}&limit=1`;
  const res = await fetch(url);
  
  if (res.status === 429) {
    throw new Error('Jikan API 429 Too Many Requests');
  }

  if (!res.ok) return null;

  const json = await res.json();
  if (json.data && json.data.length > 0) {
    const manga = json.data[0];
    const images = manga.images;
    if (images && images.webp && images.webp.large_image_url) {
      return images.webp.large_image_url;
    } else if (images && images.jpg && images.jpg.large_image_url) {
      return images.jpg.large_image_url;
    }
  }
  return null;
}

function applyCoverToContainer(container, url) {
  if (!container || !url) return;
  const img = container.querySelector('.card-cover-img');
  const fallback = container.querySelector('.card-fallback-cover');

  if (img) {
    img.src = url;
    img.onload = () => {
      img.classList.add('loaded');
      if (fallback) fallback.style.display = 'none';
    };
    img.onerror = () => {
      img.style.display = 'none';
      if (fallback) fallback.style.display = 'flex';
    };
  }
}

function getCachedCover(title) {
  try {
    return localStorage.getItem(CONFIG.CACHE_PREFIX + title.toLowerCase());
  } catch (e) {
    return null;
  }
}

function setCachedCover(title, url) {
  try {
    localStorage.setItem(CONFIG.CACHE_PREFIX + title.toLowerCase(), url);
  } catch (e) {
    // Quota exceeded handled silently
  }
}

// Clean title: remove parenthetical tags like "(Bookpaper)", "(Complete Edition)", etc.
function getCleanTitle(title) {
  if (!title) return '';
  let cleaned = title.replace(/\([^)]*\)/g, '').trim();
  cleaned = cleaned.replace(/\[[^\]]*\]/g, '').trim();
  return cleaned;
}

// ==========================================
// Detail Modal
// ==========================================
function openDetailModal(item) {
  const cleanTitle = getCleanTitle(item.judul);
  const statusBadge = getStatusBadge(item.statusKoleksi);

  DOM.modalTitle.textContent = item.judul;
  DOM.modalAuthor.textContent = item.pengarang || item.story || 'Pengarang tidak diketahui';

  DOM.modalTypeBadge.textContent = item.jenis || 'Series';
  DOM.modalPublisherBadge.textContent = item.penerbit || 'Umum';
  DOM.modalStatusBadge.textContent = statusBadge.label;
  DOM.modalStatusBadge.className = `badge ${statusBadge.class}`;

  // Volume calculations
  const totalKoleksi = parseInt(item.totalKoleksi) || 0;
  const totalVolume = parseInt(item.totalVolume) || 0;
  const progressPercent = totalVolume > 0 ? Math.min(100, Math.round((totalKoleksi / totalVolume) * 100)) : (totalKoleksi > 0 ? 100 : 0);

  DOM.modalVolumeProgressText.textContent = `${totalKoleksi}${totalVolume > 0 ? ' / ' + totalVolume : ''} Vol`;
  DOM.modalVolumeProgressBar.style.width = `${progressPercent}%`;

  DOM.modalPunyaVolume.textContent = item.punyaVolume || (totalKoleksi ? `${totalKoleksi} Vol (Komplit)` : '-');
  DOM.modalTotalTerbit.textContent = totalVolume > 0 ? `${totalVolume} Volume` : 'Belum selesai / tidak tercatat';
  DOM.modalStatusTerbit.textContent = item.statusTerbit || 'Ongoing';
  DOM.modalTotalKoleksi.textContent = `${totalKoleksi} Volume`;

  // Notes
  if (item.catatan && item.catatan.trim()) {
    DOM.modalCatatan.textContent = item.catatan;
    DOM.modalCatatan.parentElement.style.display = 'block';
  } else {
    DOM.modalCatatan.textContent = 'Tidak ada catatan kondisi khusus.';
    DOM.modalCatatan.parentElement.style.display = 'block';
  }

  // Cover image
  const cachedCover = getCachedCover(cleanTitle);
  if (cachedCover && cachedCover !== 'none') {
    DOM.modalCoverImg.src = cachedCover;
    DOM.modalCoverImg.style.display = 'block';
    DOM.modalCoverFallback.style.display = 'none';
  } else {
    DOM.modalCoverImg.style.display = 'none';
    DOM.modalCoverFallback.style.display = 'flex';
    DOM.modalCoverFallback.innerHTML = `
      <div class="card-fallback-cover" style="height: 100%;">
        <span class="fallback-publisher">${escapeHTML(item.penerbit || '')}</span>
        <h3 class="fallback-title">${escapeHTML(item.judul)}</h3>
        <p class="fallback-author">${escapeHTML(item.pengarang || '-')}</p>
        <span class="fallback-volume-tag">${totalKoleksi} Vol</span>
      </div>
    `;
  }

  // External links
  const malQuery = TITLE_MAPPINGS[item.judul.toLowerCase()] || cleanTitle;
  DOM.modalMalLink.href = `https://myanimelist.net/manga.php?q=${encodeURIComponent(malQuery)}`;
  DOM.modalGoogleLink.href = `https://www.google.com/search?q=${encodeURIComponent('Komik ' + item.judul + ' ' + (item.penerbit || ''))}`;

  DOM.detailModal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeDetailModal() {
  DOM.detailModal.style.display = 'none';
  document.body.style.overflow = '';
}

// ==========================================
// Event Listeners
// ==========================================
function setupEventListeners() {
  // Search
  let searchTimeout;
  DOM.searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    const val = e.target.value;
    DOM.btnClearSearch.style.display = val ? 'block' : 'none';

    searchTimeout = setTimeout(() => {
      state.activeFilter.search = val;
      applyFilters();
    }, 250);
  });

  DOM.btnClearSearch.addEventListener('click', () => {
    DOM.searchInput.value = '';
    DOM.btnClearSearch.style.display = 'none';
    state.activeFilter.search = '';
    applyFilters();
  });

  // Status Tabs
  DOM.statusTabs.addEventListener('click', (e) => {
    if (e.target.classList.contains('tab-btn')) {
      DOM.statusTabs.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
      e.target.classList.add('active');
      state.activeFilter.status = e.target.dataset.status;
      applyFilters();
    }
  });

  // Select Filters
  DOM.publisherFilter.addEventListener('change', (e) => {
    state.activeFilter.publisher = e.target.value;
    applyFilters();
  });

  DOM.typeFilter.addEventListener('change', (e) => {
    state.activeFilter.type = e.target.value;
    applyFilters();
  });

  DOM.sortFilter.addEventListener('change', (e) => {
    state.activeFilter.sort = e.target.value;
    applyFilters();
  });

  // View Mode Toggles
  DOM.btnGridView.addEventListener('click', () => {
    DOM.btnGridView.classList.add('active');
    DOM.btnListView.classList.remove('active');
    state.viewMode = 'grid';
    renderView();
  });

  DOM.btnListView.addEventListener('click', () => {
    DOM.btnListView.classList.add('active');
    DOM.btnGridView.classList.remove('active');
    state.viewMode = 'list';
    renderView();
  });

  // Sync Button
  DOM.btnSync.addEventListener('click', syncWithGoogleSheet);

  // Load More Button
  DOM.btnLoadMore.addEventListener('click', loadMore);

  // Reset Filters Button
  DOM.btnResetFilters.addEventListener('click', () => {
    DOM.searchInput.value = '';
    DOM.btnClearSearch.style.display = 'none';
    DOM.publisherFilter.value = 'all';
    DOM.typeFilter.value = 'all';
    DOM.sortFilter.value = 'no-asc';
    DOM.statusTabs.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    DOM.statusTabs.querySelector('[data-status="all"]').classList.add('active');

    state.activeFilter = {
      status: 'all',
      publisher: 'all',
      type: 'all',
      search: '',
      sort: 'no-asc'
    };
    applyFilters();
  });

  // Modal Close
  DOM.btnModalClose.addEventListener('click', closeDetailModal);
  DOM.detailModal.addEventListener('click', (e) => {
    if (e.target === DOM.detailModal) closeDetailModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && DOM.detailModal.style.display === 'flex') {
      closeDetailModal();
    }
  });
}

// ==========================================
// Helper Utilities
// ==========================================
function getStatusBadge(status) {
  const s = (status || '').toLowerCase();
  if (s.includes('komplit') || s.includes('lengkap')) {
    return { label: 'Komplit', class: 'badge-komplit' };
  } else if (s.includes('bolong')) {
    return { label: 'Bolong', class: 'badge-bolong' };
  } else if (s.includes('nanti')) {
    return { label: 'Nanti Dulu', class: 'badge-nanti' };
  }
  return { label: status || 'Lainnya', class: 'badge-other' };
}

function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;

  DOM.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
