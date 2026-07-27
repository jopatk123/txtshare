/**
 * 管理后台脚本
 * 从 admin/index.html 抽离，配合 CSP 移除 unsafe-inline
 */

// ── State ────────────────────────────────────────────────────────────────────
const state = {
  token: '',
  page: 1,
  limit: 20,
  search: '',
  total: 0,
  selected: new Set(),
  searchTimer: null,
};

// ── DOM refs ─────────────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const loginScreen = $('loginScreen');
const adminApp = $('adminApp');
const tokenInput = $('tokenInput');
const loginBtn = $('loginBtn');
const loginError = $('loginError');
const tableBody = $('tableBody');
const checkAll = $('checkAll');
const batchDeleteBtn = $('batchDeleteBtn');
const searchInput = $('searchInput');
const pageInfo = $('pageInfo');
const pageBtns = $('pageBtns');
const auditTableBody = $('auditTableBody');
const toast = $('toast');
const confirmModal = $('confirmModal');

// ── Toast ─────────────────────────────────────────────────────────────────────
let _toastTimer;
function showToast(msg, type = '') {
  clearTimeout(_toastTimer);
  toast.textContent = msg;
  toast.className = 'show ' + type;
  _toastTimer = setTimeout(() => {
    toast.className = '';
  }, 2800);
}

// ── Confirm dialog ────────────────────────────────────────────────────────────
function confirmDialog(title, msg) {
  return new Promise((resolve) => {
    $('confirmTitle').textContent = title;
    $('confirmMsg').textContent = msg;
    confirmModal.classList.add('open');
    const ok = $('confirmOk');
    const cancel = $('confirmCancel');
    const close = (result) => {
      confirmModal.classList.remove('open');
      ok.removeEventListener('click', onOk);
      cancel.removeEventListener('click', onCancel);
      resolve(result);
    };
    const onOk = () => close(true);
    const onCancel = () => close(false);
    ok.addEventListener('click', onOk);
    cancel.addEventListener('click', onCancel);
  });
}

// ── API helper ────────────────────────────────────────────────────────────────
async function api(method, path, body) {
  const opts = {
    method,
    headers: { Authorization: 'Bearer ' + state.token },
  };
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch('/api/admin' + path, opts);
  const data = await res.json();
  return { ok: res.ok, status: res.status, data };
}

// ── Auth ──────────────────────────────────────────────────────────────────────
async function tryLogin() {
  const token = tokenInput.value.trim();
  if (!token) {
    loginError.textContent = '请输入令牌';
    return;
  }

  loginError.textContent = '';
  loginBtn.disabled = true;
  loginBtn.textContent = '验证中…';

  // 先写入 state，api() 才能在请求头里带上 token
  state.token = token;

  const { ok, data } = await api('GET', '/stats').catch(() => ({ ok: false, data: {} }));

  loginBtn.disabled = false;
  loginBtn.textContent = '登 录';

  if (!ok) {
    state.token = ''; // 验证失败则清空
    loginError.textContent = data.error || '令牌无效或服务未启用';
    return;
  }

  showMain(data.data);
}

function logout() {
  state.token = '';
  adminApp.style.display = 'none';
  loginScreen.style.display = 'flex';
  tokenInput.value = '';
  loginError.textContent = '';
}

function showMain(statsData) {
  loginScreen.style.display = 'none';
  adminApp.style.display = 'block';
  renderStats(statsData);
  loadShares();
  loadAuditLogs();
}

// ── Stats ─────────────────────────────────────────────────────────────────────
function renderStats(d) {
  if (!d) return;
  $('statTotal').textContent = d.total ?? '-';
  $('statViews').textContent = d.totalViews ?? '-';
  $('statExpired').textContent = d.expired ?? '-';
  $('statNever').textContent = d.neverExpire ?? '-';
}

async function refreshStats() {
  const { ok, data } = await api('GET', '/stats');
  if (ok) renderStats(data.data);
}

async function loadAuditLogs() {
  auditTableBody.innerHTML = '<tr class="loading-row"><td colspan="5">加载中…</td></tr>';
  const { ok, status, data } = await api('GET', '/audit-logs?limit=10');
  if (!ok) {
    if (status === 401) {
      logout();
      return;
    }
    auditTableBody.innerHTML = `<tr class="empty-row"><td colspan="5">加载失败：${esc(data.error || '未知错误')}</td></tr>`;
    return;
  }

  if (!data.data.rows.length) {
    auditTableBody.innerHTML = '<tr class="empty-row"><td colspan="5">暂无审计记录</td></tr>';
    return;
  }

  auditTableBody.innerHTML = data.data.rows
    .map(
      (row) => `
  <tr class="audit-row">
    <td class="time-cell">${formatTime(row.createdTime)}</td>
    <td>${esc(row.action)}</td>
    <td>${esc(row.target)}</td>
    <td class="audit-detail" title="${esc(JSON.stringify(row.detail || {}))}">${esc(JSON.stringify(row.detail || {}))}</td>
    <td>${esc(row.actorIp || '-')}</td>
  </tr>
`
    )
    .join('');
}

// ── List ──────────────────────────────────────────────────────────────────────
async function loadShares() {
  tableBody.innerHTML = '<tr class="loading-row"><td colspan="7">加载中…</td></tr>';
  checkAll.checked = false;
  state.selected.clear();
  batchDeleteBtn.disabled = true;

  const qs = `?page=${state.page}&limit=${state.limit}&search=${encodeURIComponent(state.search)}`;
  const { ok, status, data } = await api('GET', '/shares' + qs);

  if (!ok) {
    if (status === 401) {
      logout();
      return;
    }
    tableBody.innerHTML = `<tr class="empty-row"><td colspan="7">加载失败：${esc(data.error || '未知错误')}</td></tr>`;
    return;
  }

  const { total, rows } = data.data;
  state.total = total;
  renderTable(rows);
  renderPagination(total);
}

function formatTime(iso) {
  if (!iso) return '<span class="badge badge-never">永不过期</span>';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function expireBadge(row) {
  if (!row.expireTime) return '<span class="badge badge-never">永不过期</span>';
  if (row.isExpired) return '<span class="badge badge-expired">已过期</span>';
  return '<span class="badge badge-active">有效</span>';
}

function renderTable(rows) {
  if (!rows.length) {
    tableBody.innerHTML = '<tr class="empty-row"><td colspan="7">暂无数据</td></tr>';
    return;
  }
  tableBody.innerHTML = rows
    .map(
      (row) => `
  <tr data-id="${esc(row.id)}">
    <td><input type="checkbox" class="row-check" data-id="${esc(row.id)}" /></td>
    <td class="id-cell">
      <a href="${esc(row.url)}" target="_blank" rel="noopener">${esc(row.id)}</a>
    </td>
    <td class="preview-cell" title="${esc(row.contentPreview || '')}">${esc(row.contentPreview || '(空)')}</td>
    <td class="time-cell">${formatTime(row.createTime)}</td>
    <td class="time-cell">${row.expireTime ? formatTime(row.expireTime) : ''}
      ${expireBadge(row)}</td>
    <td>${row.viewCount}</td>
    <td>
      <button class="btn btn-danger btn-sm del-btn" data-id="${esc(row.id)}">删除</button>
    </td>
  </tr>
`
    )
    .join('');

  // row checkboxes
  tableBody.querySelectorAll('.row-check').forEach((cb) => {
    cb.addEventListener('change', onRowCheck);
  });

  // delete buttons
  tableBody.querySelectorAll('.del-btn').forEach((btn) => {
    btn.addEventListener('click', () => deleteSingle(btn.dataset.id));
  });
}

// HTML 转义，防止 XSS。补充单引号转义以覆盖未来可能出现的单引号属性。
function esc(s) {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

// ── Pagination ────────────────────────────────────────────────────────────────
function renderPagination(total) {
  const totalPages = Math.ceil(total / state.limit) || 1;
  const start = (state.page - 1) * state.limit + 1;
  const end = Math.min(state.page * state.limit, total);
  pageInfo.textContent = total > 0 ? `第 ${start}–${end} 条，共 ${total} 条` : '共 0 条';

  let html = '';
  html += `<button class="page-btn" id="prevPage" ${state.page <= 1 ? 'disabled' : ''}>‹ 上一页</button>`;

  const maxVisible = 5;
  let startP = Math.max(1, state.page - Math.floor(maxVisible / 2));
  const endP = Math.min(totalPages, startP + maxVisible - 1);
  if (endP - startP < maxVisible - 1) startP = Math.max(1, endP - maxVisible + 1);

  for (let p = startP; p <= endP; p++) {
    html += `<button class="page-btn ${p === state.page ? 'active' : ''}" data-page="${p}">${p}</button>`;
  }
  html += `<button class="page-btn" id="nextPage" ${state.page >= totalPages ? 'disabled' : ''}>下一页 ›</button>`;
  pageBtns.innerHTML = html;

  pageBtns.querySelectorAll('[data-page]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.page = +btn.dataset.page;
      loadShares();
    });
  });
  const prev = $('prevPage');
  const next = $('nextPage');
  if (prev)
    prev.addEventListener('click', () => {
      state.page--;
      loadShares();
    });
  if (next)
    next.addEventListener('click', () => {
      state.page++;
      loadShares();
    });
}

// ── Select / Batch ────────────────────────────────────────────────────────────
function onRowCheck(e) {
  const id = e.target.dataset.id;
  if (e.target.checked) state.selected.add(id);
  else state.selected.delete(id);
  batchDeleteBtn.disabled = state.selected.size === 0;

  const allChecks = tableBody.querySelectorAll('.row-check');
  checkAll.checked = allChecks.length > 0 && [...allChecks].every((c) => c.checked);
  checkAll.indeterminate = !checkAll.checked && state.selected.size > 0;
}

checkAll.addEventListener('change', () => {
  const checked = checkAll.checked;
  tableBody.querySelectorAll('.row-check').forEach((cb) => {
    cb.checked = checked;
    if (checked) state.selected.add(cb.dataset.id);
    else state.selected.delete(cb.dataset.id);
  });
  batchDeleteBtn.disabled = state.selected.size === 0;
});

// ── Delete ────────────────────────────────────────────────────────────────────
async function deleteSingle(id) {
  const ok = await confirmDialog('删除确认', `确定要删除 ID 为「${id}」的分享吗？此操作不可撤销。`);
  if (!ok) return;

  const res = await api('DELETE', `/shares/${id}`);
  if (res.ok) {
    showToast('删除成功', 'success');
    state.selected.delete(id);
    await loadShares();
    await refreshStats();
    await loadAuditLogs();
  } else {
    showToast(res.data.error || '删除失败', 'error');
  }
}

batchDeleteBtn.addEventListener('click', async () => {
  const ids = [...state.selected];
  const ok = await confirmDialog(
    '批量删除确认',
    `确定要删除选中的 ${ids.length} 条记录吗？此操作不可撤销。`
  );
  if (!ok) return;

  const res = await api('DELETE', '/shares', { ids });
  if (res.ok) {
    showToast(`已删除 ${res.data.data.deleted} 条记录`, 'success');
    state.selected.clear();
    await loadShares();
    await refreshStats();
    await loadAuditLogs();
  } else {
    showToast(res.data.error || '批量删除失败', 'error');
  }
});

// ── Cleanup ───────────────────────────────────────────────────────────────────
$('cleanupBtn').addEventListener('click', async () => {
  const ok = await confirmDialog('清理过期记录', '将删除所有已过期的分享记录，此操作不可撤销。');
  if (!ok) return;

  const res = await api('POST', '/cleanup');
  if (res.ok) {
    showToast(`已清理 ${res.data.data.deleted} 条过期记录`, 'success');
    await loadShares();
    await refreshStats();
    await loadAuditLogs();
  } else {
    showToast(res.data.error || '清理失败', 'error');
  }
});

// ── Search ────────────────────────────────────────────────────────────────────
searchInput.addEventListener('input', () => {
  clearTimeout(state.searchTimer);
  state.searchTimer = setTimeout(() => {
    state.search = searchInput.value.trim();
    state.page = 1;
    loadShares();
  }, 400);
});

// ── Misc ──────────────────────────────────────────────────────────────────────
$('refreshBtn').addEventListener('click', () => {
  loadShares();
  refreshStats();
  loadAuditLogs();
});
$('logoutBtn').addEventListener('click', logout);
loginBtn.addEventListener('click', tryLogin);
tokenInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') tryLogin();
});
confirmModal.addEventListener('click', (e) => {
  if (e.target === confirmModal) confirmModal.classList.remove('open');
});

// ── Init ──────────────────────────────────────────────────────────────────────
loginScreen.style.display = 'flex';
