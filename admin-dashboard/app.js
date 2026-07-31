// ── State ────────────────────────────────────────────────────────
let allTransactions = [];
let packages = [];
let pinnedIds = new Set(JSON.parse(localStorage.getItem('pinnedTransactions') || '[]'));
let currentPage = 1;
const PAGE_SIZE = 12;
let knownIds = new Set();
let pollTimer = null;

// ── DOM refs ─────────────────────────────────────────────────────
const els = {
  connectionStatus: document.getElementById('connectionStatus'),
  connectionLabel: document.getElementById('connectionLabel'),
  themeToggle: document.getElementById('themeToggle'),
  themeIcon: document.getElementById('themeIcon'),
  statTotal: document.getElementById('statTotal'),
  statToday: document.getElementById('statToday'),
  statRevenue: document.getElementById('statRevenue'),
  statSuccess: document.getElementById('statSuccess'),
  statPending: document.getElementById('statPending'),
  statFailed: document.getElementById('statFailed'),
  statRefunded: document.getElementById('statRefunded'),
  searchInput: document.getElementById('searchInput'),
  filterDate: document.getElementById('filterDate'),
  filterStatus: document.getElementById('filterStatus'),
  filterPackage: document.getElementById('filterPackage'),
  filterNetwork: document.getElementById('filterNetwork'),
  filterAmount: document.getElementById('filterAmount'),
  transactionsBody: document.getElementById('transactionsBody'),
  pagination: document.getElementById('pagination'),
  refreshBtn: document.getElementById('refreshBtn'),
  drawerOverlay: document.getElementById('drawerOverlay'),
  drawerBody: document.getElementById('drawerBody'),
  drawerActions: document.getElementById('drawerActions'),
  drawerClose: document.getElementById('drawerClose'),
  toastContainer: document.getElementById('toastContainer'),
  revenueChart: document.getElementById('revenueChart'),
  exportCsv: document.getElementById('exportCsv'),
  exportExcel: document.getElementById('exportExcel'),
  exportPdf: document.getElementById('exportPdf')
};

// ── Theme ────────────────────────────────────────────────────────
function applyTheme(theme) {
  document.body.classList.toggle('light-theme', theme === 'light');
  els.themeIcon.innerHTML = theme === 'light' ? '&#9788;' : '&#9789;';
}

function initTheme() {
  const saved = localStorage.getItem('dashboardTheme') || 'dark';
  applyTheme(saved);
  els.themeToggle.addEventListener('click', () => {
    const next = document.body.classList.contains('light-theme') ? 'dark' : 'light';
    localStorage.setItem('dashboardTheme', next);
    applyTheme(next);
  });
}

// ── Data fetching ────────────────────────────────────────────────
async function fetchTransactions() {
  const res = await fetch('/api/transactions');
  if (!res.ok) throw new Error('Failed to load transactions');
  return res.json();
}

async function fetchPackages() {
  const res = await fetch('/api/packages');
  if (!res.ok) throw new Error('Failed to load packages');
  return res.json();
}

function populatePackageFilter() {
  els.filterPackage.innerHTML = '<option value="all">All packages</option>';
  packages.forEach((pkg) => {
    const opt = document.createElement('option');
    opt.value = pkg.id;
    opt.textContent = pkg.label;
    els.filterPackage.appendChild(opt);
  });
}

async function refreshData(isPoll) {
  try {
    allTransactions = await fetchTransactions();
    setConnectionStatus(true);
    if (isPoll) checkForNewTransactions();
    knownIds = new Set(allTransactions.map((tx) => tx.transactionId));
    renderAll();
  } catch (error) {
    setConnectionStatus(false);
    console.error(error);
  }
}

function setConnectionStatus(online) {
  els.connectionStatus.classList.toggle('online', online);
  els.connectionLabel.textContent = online ? 'Live' : 'Offline';
}

// ── New-transaction toast detection ─────────────────────────────
function checkForNewTransactions() {
  allTransactions.forEach((tx) => {
    if (!knownIds.has(tx.transactionId) && tx.status !== 'PENDING') {
      showToast(tx);
    }
  });
}

function showToast(tx) {
  const toast = document.createElement('div');
  toast.className = `toast ${tx.status === 'FAILED' ? 'failed' : ''}`;
  toast.textContent =
    tx.status === 'SUCCESS'
      ? `Payment received: ${formatCurrency(tx.amount)} from ${tx.phoneNumber}`
      : `Payment failed for ${tx.phoneNumber}`;
  els.toastContainer.appendChild(toast);
  setTimeout(() => toast.remove(), 5000);
}

// ── Formatting helpers ───────────────────────────────────────────
function formatCurrency(amount) {
  return `UGX ${Number(amount).toLocaleString()}`;
}

function formatDate(timestamp) {
  return new Date(timestamp).toLocaleString();
}

// ── Filtering ────────────────────────────────────────────────────
function getFilteredTransactions() {
  const search = els.searchInput.value.trim().toLowerCase();
  const dateFilter = els.filterDate.value;
  const statusFilter = els.filterStatus.value;
  const packageFilter = els.filterPackage.value;
  const networkFilter = els.filterNetwork.value;
  const amountFilter = els.filterAmount.value;
  const now = Date.now();

  return allTransactions.filter((tx) => {
    if (search) {
      const haystack = `${tx.transactionId} ${tx.phoneNumber} ${tx.voucherCode || ''}`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }

    if (dateFilter === 'today' && !isSameDay(tx.createdAt, now)) return false;
    if (dateFilter === '7d' && now - tx.createdAt > 7 * 24 * 60 * 60 * 1000) return false;
    if (dateFilter === '30d' && now - tx.createdAt > 30 * 24 * 60 * 60 * 1000) return false;

    if (statusFilter !== 'all' && tx.status !== statusFilter) return false;
    if (packageFilter !== 'all' && tx.packageId !== packageFilter) return false;
    if (networkFilter !== 'all' && tx.network !== networkFilter) return false;

    if (amountFilter === 'low' && tx.amount >= 5000) return false;
    if (amountFilter === 'mid' && (tx.amount < 5000 || tx.amount > 20000)) return false;
    if (amountFilter === 'high' && tx.amount <= 20000) return false;

    return true;
  });
}

function isSameDay(timestamp, reference) {
  const a = new Date(timestamp);
  const b = new Date(reference);
  return a.toDateString() === b.toDateString();
}

// ── Sorting: pinned first, then newest ──────────────────────────
function getSortedFiltered() {
  const filtered = getFilteredTransactions();
  return filtered.sort((a, b) => {
    const aPinned = pinnedIds.has(a.transactionId);
    const bPinned = pinnedIds.has(b.transactionId);
    if (aPinned !== bPinned) return aPinned ? -1 : 1;
    return b.createdAt - a.createdAt;
  });
}

// ── Summary cards ────────────────────────────────────────────────
function renderSummary() {
  const now = Date.now();
  const today = allTransactions.filter((tx) => isSameDay(tx.createdAt, now));
  const successful = allTransactions.filter((tx) => tx.status === 'SUCCESS');
  const pending = allTransactions.filter((tx) => tx.status === 'PENDING');
  const failed = allTransactions.filter((tx) => tx.status === 'FAILED');
  const refunded = allTransactions.filter((tx) => tx.status === 'REFUNDED');
  const revenue = successful.reduce((sum, tx) => sum + tx.amount, 0);

  els.statTotal.textContent = allTransactions.length;
  els.statToday.textContent = today.length;
  els.statRevenue.textContent = formatCurrency(revenue);
  els.statSuccess.textContent = successful.length;
  els.statPending.textContent = pending.length;
  els.statFailed.textContent = failed.length;
  els.statRefunded.textContent = refunded.length;
}

// ── Revenue chart (plain canvas, no external chart library) ────
function renderChart() {
  const ctx = els.revenueChart.getContext('2d');
  const canvas = els.revenueChart;
  const width = canvas.clientWidth || 600;
  const height = canvas.height || 140;
  canvas.width = width;
  canvas.height = height;

  const days = [];
  for (let i = 6; i >= 0; i -= 1) {
    const day = new Date();
    day.setDate(day.getDate() - i);
    days.push(day);
  }

  const dailyRevenue = days.map((day) =>
    allTransactions
      .filter((tx) => tx.status === 'SUCCESS' && isSameDay(tx.createdAt, day.getTime()))
      .reduce((sum, tx) => sum + tx.amount, 0)
  );

  const maxValue = Math.max(...dailyRevenue, 1);
  const padding = 30;
  const barWidth = (width - padding * 2) / days.length - 12;
  const accent = getComputedStyle(document.body).getPropertyValue('--accent').trim();
  const muted = getComputedStyle(document.body).getPropertyValue('--muted').trim();

  ctx.clearRect(0, 0, width, height);
  ctx.font = '11px IBM Plex Mono';
  ctx.fillStyle = muted;
  ctx.textAlign = 'center';

  days.forEach((day, index) => {
    const value = dailyRevenue[index];
    const barHeight = (value / maxValue) * (height - padding * 2);
    const x = padding + index * ((width - padding * 2) / days.length) + 6;
    const y = height - padding - barHeight;

    ctx.fillStyle = accent;
    ctx.fillRect(x, y, barWidth, barHeight);

    ctx.fillStyle = muted;
    const label = day.toLocaleDateString(undefined, { weekday: 'short' });
    ctx.fillText(label, x + barWidth / 2, height - 10);
  });
}

// ── Table rendering ──────────────────────────────────────────────
function renderTable() {
  const filtered = getSortedFiltered();
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  currentPage = Math.min(currentPage, totalPages);
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(start, start + PAGE_SIZE);

  if (pageItems.length === 0) {
    els.transactionsBody.innerHTML =
      '<tr class="empty-row"><td colspan="9">No transactions match your filters.</td></tr>';
    els.pagination.innerHTML = '';
    return;
  }

  els.transactionsBody.innerHTML = pageItems
    .map((tx) => {
      const pinned = pinnedIds.has(tx.transactionId);
      return `
        <tr data-id="${tx.transactionId}">
          <td><span class="pin-star ${pinned ? 'pinned' : ''}" data-pin="${tx.transactionId}">&#9733;</span></td>
          <td>${tx.transactionId}</td>
          <td>${formatDate(tx.createdAt)}</td>
          <td>${tx.phoneNumber}</td>
          <td>${tx.packageLabel || '-'}</td>
          <td>${formatCurrency(tx.amount)}</td>
          <td>${tx.method}</td>
          <td><span class="status-badge ${tx.status}">${tx.status}</span></td>
          <td>${tx.voucherCode ? `<span class="voucher-link">${tx.voucherCode}</span>` : '<span class="voucher-dash">-</span>'}</td>
        </tr>
      `;
    })
    .join('');

  renderPagination(totalPages);
  attachRowListeners();
}

function renderPagination(totalPages) {
  let html = `<button id="pagePrev" ${currentPage === 1 ? 'disabled' : ''}>&lt;</button>`;
  for (let page = 1; page <= totalPages; page += 1) {
    html += `<button class="page-btn ${page === currentPage ? 'active' : ''}" data-page="${page}">${page}</button>`;
  }
  html += `<button id="pageNext" ${currentPage === totalPages ? 'disabled' : ''}>&gt;</button>`;
  els.pagination.innerHTML = html;

  els.pagination.querySelectorAll('.page-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      currentPage = Number(btn.dataset.page);
      renderTable();
    });
  });
  const prevBtn = document.getElementById('pagePrev');
  const nextBtn = document.getElementById('pageNext');
  if (prevBtn) prevBtn.addEventListener('click', () => { currentPage -= 1; renderTable(); });
  if (nextBtn) nextBtn.addEventListener('click', () => { currentPage += 1; renderTable(); });
}

function attachRowListeners() {
  els.transactionsBody.querySelectorAll('tr[data-id]').forEach((row) => {
    row.addEventListener('click', (event) => {
      if (event.target.dataset.pin) return;
      openDrawer(row.dataset.id);
    });
  });

  els.transactionsBody.querySelectorAll('[data-pin]').forEach((star) => {
    star.addEventListener('click', (event) => {
      event.stopPropagation();
      togglePin(star.dataset.pin);
    });
  });
}

function togglePin(transactionId) {
  if (pinnedIds.has(transactionId)) {
    pinnedIds.delete(transactionId);
  } else {
    pinnedIds.add(transactionId);
  }
  localStorage.setItem('pinnedTransactions', JSON.stringify(Array.from(pinnedIds)));
  renderTable();
}

// ── Drawer ───────────────────────────────────────────────────────
function openDrawer(transactionId) {
  const tx = allTransactions.find((t) => t.transactionId === transactionId);
  if (!tx) return;

  els.drawerBody.innerHTML = [
    ['Transaction ID', tx.transactionId],
    ['Date & Time', formatDate(tx.createdAt)],
    ['Phone Number', tx.phoneNumber],
    ['Network', tx.network],
    ['Package', tx.packageLabel || '-'],
    ['Amount', formatCurrency(tx.amount)],
    ['Payment Method', tx.method],
    ['Status', tx.status],
    ['Reference', tx.reference || '-'],
    ['Voucher Code', tx.voucherCode || '-'],
    ['Voucher Status', tx.voucherStatus || '-'],
    ['Expires', tx.expiresAt ? formatDate(tx.expiresAt) : '-']
  ]
    .map(([label, value]) => `
      <div class="detail-row">
        <span class="detail-label">${label}</span>
        <span class="detail-value">${value}</span>
      </div>
    `)
    .join('');

  els.drawerActions.innerHTML = `
    <button id="btnPrint">Print Receipt</button>
    <button id="btnDownload">Download Receipt</button>
    <button id="btnCopyVoucher" ${tx.voucherCode ? '' : 'disabled'}>Copy Voucher</button>
    <button id="btnRefresh" ${tx.status === 'PENDING' ? '' : 'disabled'}>Refresh Status</button>
  `;

  document.getElementById('btnPrint').addEventListener('click', () => window.print());
  document.getElementById('btnDownload').addEventListener('click', () => downloadReceipt(tx));
  document.getElementById('btnCopyVoucher').addEventListener('click', () => {
    if (tx.voucherCode) navigator.clipboard.writeText(tx.voucherCode);
  });
  document.getElementById('btnRefresh').addEventListener('click', () => refreshTransaction(tx.transactionId));

  els.drawerOverlay.classList.add('open');
}

function closeDrawer() {
  els.drawerOverlay.classList.remove('open');
}

async function refreshTransaction(transactionId) {
  const res = await fetch(`/api/transactions/${transactionId}/refresh`, { method: 'POST' });
  if (res.ok) {
    await refreshData(false);
    openDrawer(transactionId);
  }
}

function downloadReceipt(tx) {
  const lines = [
    `Receipt - ${tx.transactionId}`,
    `Date: ${formatDate(tx.createdAt)}`,
    `Phone: ${tx.phoneNumber}`,
    `Package: ${tx.packageLabel}`,
    `Amount: ${formatCurrency(tx.amount)}`,
    `Status: ${tx.status}`,
    `Voucher: ${tx.voucherCode || '-'}`
  ].join('\n');
  const blob = new Blob([lines], { type: 'text/plain' });
  triggerDownload(blob, `${tx.transactionId}-receipt.txt`);
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

// ── Exports ──────────────────────────────────────────────────────
function exportCsv() {
  const rows = getSortedFiltered();
  const header = ['Transaction ID', 'Date', 'Phone', 'Package', 'Amount', 'Method', 'Status', 'Voucher'];
  const csvRows = [header.join(',')];
  rows.forEach((tx) => {
    csvRows.push(
      [
        tx.transactionId,
        formatDate(tx.createdAt),
        tx.phoneNumber,
        tx.packageLabel,
        tx.amount,
        tx.method,
        tx.status,
        tx.voucherCode || ''
      ]
        .map((value) => `"${String(value).replace(/"/g, '""')}"`)
        .join(',')
    );
  });
  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
  triggerDownload(blob, 'transactions.csv');
}

function exportExcel() {
  const rows = getSortedFiltered();
  const header = '<tr>' +
    ['Transaction ID', 'Date', 'Phone', 'Package', 'Amount', 'Method', 'Status', 'Voucher']
      .map((h) => `<th>${h}</th>`)
      .join('') +
    '</tr>';
  const body = rows
    .map(
      (tx) =>
        '<tr>' +
        [tx.transactionId, formatDate(tx.createdAt), tx.phoneNumber, tx.packageLabel, tx.amount, tx.method, tx.status, tx.voucherCode || '']
          .map((v) => `<td>${v}</td>`)
          .join('') +
        '</tr>'
    )
    .join('');
  const html = `<table>${header}${body}</table>`;
  const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
  triggerDownload(blob, 'transactions.xls');
}

function exportPdf() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const rows = getSortedFiltered().map((tx) => [
    tx.transactionId,
    formatDate(tx.createdAt),
    tx.phoneNumber,
    tx.packageLabel,
    formatCurrency(tx.amount),
    tx.status,
    tx.voucherCode || '-'
  ]);
  doc.text('Voucher Ops Console - Transactions', 14, 14);
  doc.autoTable({
    head: [['ID', 'Date', 'Phone', 'Package', 'Amount', 'Status', 'Voucher']],
    body: rows,
    startY: 20,
    styles: { fontSize: 8 }
  });
  doc.save('transactions.pdf');
}

// ── Render everything ─────────────────────────────────────────────
function renderAll() {
  populatePackageFilter();
  renderSummary();
  renderChart();
  renderTable();
}

// ── Wiring ───────────────────────────────────────────────────────
function initListeners() {
  [els.searchInput, els.filterDate, els.filterStatus, els.filterPackage, els.filterNetwork, els.filterAmount].forEach((el) => {
    el.addEventListener('input', () => {
      currentPage = 1;
      renderTable();
    });
  });

  els.refreshBtn.addEventListener('click', () => refreshData(false));
  els.drawerClose.addEventListener('click', closeDrawer);
  els.drawerOverlay.addEventListener('click', (event) => {
    if (event.target === els.drawerOverlay) closeDrawer();
  });

  els.exportCsv.addEventListener('click', exportCsv);
  els.exportExcel.addEventListener('click', exportExcel);
  els.exportPdf.addEventListener('click', exportPdf);

  window.addEventListener('resize', renderChart);
}

// ── Boot ─────────────────────────────────────────────────────────
async function init() {
  initTheme();
  initListeners();

  try {
    packages = await fetchPackages();
  } catch (error) {
    console.error(error);
  }

  await refreshData(false);
  pollTimer = setInterval(() => refreshData(true), 5000);
}

init();
