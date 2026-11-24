"use strict";
/* ===== Bookshelf App frontend ===== */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const TYPE_LABEL = { book: "書籍", cd: "CD", dvd: "DVD", other: "その他" };
const TYPE_BADGE = { book: "BOOK", cd: "CD", dvd: "DVD", other: "ITEM" };
const STATUS_LABEL = { unread: "未読", reading: "読み進め中", done: "読了" };
const SPINE_COLORS = ["#b8620a", "#a25400", "#7a4a21", "#8c5a2b", "#97552f", "#6d4c2f", "#c06919", "#814200", "#5f4328", "#94420e", "#33566b", "#51683c", "#71363f", "#3f4a5a"];

const state = {
  user: null,
  view: "home",
  viewMode: "shelf", // shelf | list
  homeType: "",
  items: [],
  total: 0,
  offset: 0,
  hasMore: false,
  loading: false,
  selectedId: null,
  detailId: null,
  pendingImageKey: "",
  pendingCoverUrl: "",
};

function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => (t.hidden = true), 2600);
}
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
async function api(path, opts = {}) {
  const res = await fetch(path, { credentials: "same-origin", ...opts });
  if (res.status === 401 && !path.includes("/api/auth/")) {
    showAuth();
    throw new Error("ログインが必要です");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `エラー (${res.status})`);
  return data;
}
function hashCode(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function spineColor(item) {
  return SPINE_COLORS[hashCode(item.title + item.id) % SPINE_COLORS.length];
}
function spineWidth(item) {
  if (item.type === "cd") return 20;
  if (item.type === "dvd") return 26;
  if (item.prog_total > 0) return Math.max(26, Math.min(62, 22 + item.prog_total / 11));
  return 30 + (hashCode(item.title) % 18);
}
function coverSrc(item) {
  if (item.image_key) return `/api/images/${encodeURIComponent(item.image_key)}`;
  if (item.cover_url) return item.cover_url;
  return "";
}
function coverHTML(item, cls = "") {
  const src = coverSrc(item);
  if (src) return `<img class="${cls}" src="${esc(src)}" alt="${esc(item.title)}" loading="lazy" onerror="this.outerHTML=window.__genCover(${item.id})">`;
  return genCoverHTML(item);
}
function genCoverHTML(item) {
  return `<div class="cover-generated" style="background:linear-gradient(160deg, ${spineColor(item)}, ${spineColor(item)}cc)">
    <div class="cg-title" style="color:#fff8f0">${esc(item.title)}</div>
    <div class="cg-creator" style="color:rgba(255,248,240,.8)">${esc(item.creator || "")}</div>
  </div>`;
}
window.__genCover = (id) => {
  const it = state.items.find((x) => x.id === id) || state._detail;
  return it ? genCoverHTML(it) : "";
};
function fmtDate(ts) {
  const d = new Date(ts * 1000);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

/* ===== Auth ===== */
let authMode = "login";
function showAuth() {
  $("#auth-view").hidden = false;
  $("#app-view").hidden = true;
}
function showApp() {
  $("#auth-view").hidden = true;
  $("#app-view").hidden = false;
}
$("#auth-switch-link").addEventListener("click", (e) => {
  e.preventDefault();
  authMode = authMode === "login" ? "register" : "login";
  $("#auth-submit").textContent = authMode === "login" ? "ログイン" : "新規登録";
  $("#auth-switch-text").textContent = authMode === "login" ? "アカウントをお持ちでない方" : "既にアカウントをお持ちの方";
  $("#auth-switch-link").textContent = authMode === "login" ? "新規登録" : "ログイン";
  $("#auth-error").hidden = true;
});
$("#auth-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = $("#auth-email").value.trim();
  const password = $("#auth-password").value;
  const errEl = $("#auth-error");
  try {
    const user = await api(`/api/auth/${authMode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    state.user = user;
    errEl.hidden = true;
    enterApp();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.hidden = false;
  }
});
async function enterApp() {
  showApp();
  $("#settings-email").textContent = state.user.email;
  switchView("home");
  await loadHome(true);
  loadStats();
}
$("#logout-btn").addEventListener("click", async () => {
  await api("/api/auth/logout", { method: "POST" }).catch(() => {});
  state.user = null;
  showAuth();
});

/* ===== Navigation ===== */
function switchView(name) {
  state.view = name;
  $$(".nav-item").forEach((b) => b.classList.toggle("active", b.dataset.view === name));
  ["home", "search", "memos", "settings"].forEach((v) => {
    $("#view-" + v).hidden = v !== name;
  });
  $("#view-scan").hidden = name !== "scan";
  $("#view-toggle").style.visibility = name === "home" ? "visible" : "hidden";
  if (name === "memos") loadMemos();
  if (name === "settings") loadStats();
  if (name !== "scan") stopScan();
}
$$(".nav-item").forEach((b) => b.addEventListener("click", () => switchView(b.dataset.view)));

/* ===== Home: shelf & list ===== */
const PAGE = 28;
async function fetchItems(params) {
  const qs = new URLSearchParams(params);
  return api(`/api/items?${qs}`);
}
async function loadHome(reset) {
  if (state.loading) return;
  state.loading = true;
  try {
    if (reset) { state.offset = 0; state.items = []; state.selectedId = null; }
    const data = await fetchItems({ type: state.homeType, limit: PAGE, offset: state.offset });
    state.items = reset ? data.items : state.items.concat(data.items);
    state.total = data.total;
    state.offset = state.items.length;
    state.hasMore = state.items.length < data.total;
    $("#total-count").textContent = `全${state.total}点`;
    renderShelf();
    renderHomeList();
  } catch (e) { toast(e.message); }
  state.loading = false;
}
function renderShelf() {
  const shelf = $("#shelf");
  shelf.innerHTML = "";
  $("#shelf-empty").hidden = state.items.length > 0;
  const ROW = 14;
  for (let i = 0; i < state.items.length; i += ROW) {
    const chunk = state.items.slice(i, i + ROW);
    const row = document.createElement("div");
    row.className = "shelf-row";
    const scroller = document.createElement("div");
    scroller.className = "shelf-scroller";
    chunk.forEach((item) => scroller.appendChild(spineEl(item)));
    scroller.addEventListener("scroll", () => {
      if (scroller.scrollLeft + scroller.clientWidth > scroller.scrollWidth - 240 && state.hasMore && !state.loading) loadHome(false);
    }, { passive: true });
    const board = document.createElement("div");
    board.className = "shelf-board";
    row.appendChild(scroller);
    row.appendChild(board);
    shelf.appendChild(row);
  }
  if (state.selectedId) {
    const el = shelf.querySelector(`.spine[data-id="${state.selectedId}"]`);
    if (el) el.classList.add("pulled");
  }
}
function spineEl(item) {
  const el = document.createElement("div");
  el.className = "spine" + (item.id === state.selectedId ? " pulled" : "");
  el.dataset.id = item.id;
  el.style.width = spineWidth(item) + "px";
  el.style.background = spineColor(item);
  const src = coverSrc(item);
  if (src) {
    el.innerHTML = `<img class="spine-cover" src="${esc(src)}" alt="" loading="lazy" onerror="this.remove()">`;
  }
  const band = document.createElement("div");
  band.className = "spine-band";
  band.style.top = "12px";
  const band2 = band.cloneNode();
  band2.style.top = "auto"; band2.style.bottom = "12px";
  const text = document.createElement("div");
  text.className = "spine-text";
  text.innerHTML = `<span class="spine-title">${esc(item.title)}</span><span class="spine-creator">${esc(item.creator || "")}</span>`;
  el.append(band, band2, text);
  el.addEventListener("click", () => selectItem(item.id));
  return el;
}
function selectItem(id) {
  state.selectedId = id;
  $$(".spine").forEach((s) => s.classList.toggle("pulled", parseInt(s.dataset.id) === id));
  const item = state.items.find((x) => x.id === id);
  if (!item) return;
  const p = $("#pullout");
  p.hidden = false;
  $("#pullout-cover").innerHTML = coverHTML(item);
  $("#pullout-type").textContent = TYPE_BADGE[item.type] || "ITEM";
  $("#pullout-status").textContent = STATUS_LABEL[item.status] || "";
  $("#pullout-memos").textContent = `メモ ${item.memo_count || 0}件`;
  $("#pullout-title").textContent = item.title;
  $("#pullout-creator").textContent = item.creator || "";
  const pw = $("#pullout-progress-wrap");
  if (item.prog_total > 0) {
    pw.hidden = false;
    const pct = Math.min(100, Math.round((item.prog_cur / item.prog_total) * 100));
    $("#pullout-progress-bar").style.width = pct + "%";
    $("#pullout-progress-text").textContent = `${item.prog_cur} / ${item.prog_total}（${pct}%）`;
  } else pw.hidden = true;
  p.scrollIntoView({ behavior: "smooth", block: "nearest" });
}
$("#pullout-detail").addEventListener("click", () => state.selectedId && openDetail(state.selectedId));
$("#pullout-memo").addEventListener("click", () => state.selectedId && openDetail(state.selectedId, true));

function listRowHTML(item) {
  const src = coverSrc(item);
  const thumb = src
    ? `<img class="list-thumb" src="${esc(src)}" alt="" loading="lazy" onerror="this.outerHTML='<div class=\\'list-thumb-gen\\' style=\\'background:${spineColor(item)}\\'>${esc(item.title.slice(0, 1))}</div>'">`
    : `<div class="list-thumb-gen" style="background:${spineColor(item)}">${esc(item.title.slice(0, 1))}</div>`;
  const prog = item.prog_total > 0 ? `<span class="badge badge-muted">${item.prog_cur}/${item.prog_total}</span>` : "";
  return `<button class="list-row" data-id="${item.id}">
    ${thumb}
    <span class="list-main">
      <span class="list-title">${esc(item.title)}</span>
      <span class="list-sub">${esc(item.creator || "")}</span>
    </span>
    <span class="list-meta">
      <span class="badge">${TYPE_BADGE[item.type] || "ITEM"}</span>
      <span class="badge badge-muted">${STATUS_LABEL[item.status] || ""}</span>
      ${prog}
      <span class="badge badge-muted">メモ ${item.memo_count || 0}</span>
    </span>
  </button>`;
}
function bindListRows(container) {
  $$(".list-row", container).forEach((r) => r.addEventListener("click", () => openDetail(parseInt(r.dataset.id))));
}
function renderHomeList() {
  const el = $("#home-list");
  el.innerHTML = state.items.map(listRowHTML).join("") || `<p class="empty-text">まだ何も登録されていません。</p>`;
  bindListRows(el);
  $("#home-list-more").hidden = !state.hasMore;
}
$("#home-list-more").addEventListener("click", () => loadHome(false));

$("#toggle-shelf").addEventListener("click", () => setViewMode("shelf"));
$("#toggle-list").addEventListener("click", () => setViewMode("list"));
function setViewMode(mode) {
  state.viewMode = mode;
  $("#toggle-shelf").classList.toggle("active", mode === "shelf");
  $("#toggle-list").classList.toggle("active", mode === "list");
  $("#shelf-area").hidden = mode !== "shelf";
  $("#list-area").hidden = mode !== "list";
}
$$("#home-chips .chip").forEach((c) => c.addEventListener("click", () => {
  $$("#home-chips .chip").forEach((x) => x.classList.remove("active"));
  c.classList.add("active");
  state.homeType = c.dataset.type;
  $("#pullout").hidden = true;
  loadHome(true);
}));

/* ===== Search ===== */
let searchTimer = null;
async function runSearch() {
  const params = {
    q: $("#search-input").value.trim(),
    type: $("#search-chips .chip.active")?.dataset.type || "",
    limit: 60, offset: 0,
  };
  if ($("#filter-unread").checked) params.unread = "1";
  if ($("#filter-memo").checked) params.withMemo = "1";
  try {
    const data = await fetchItems(params);
    const el = $("#search-results");
    el.innerHTML = data.items.map(listRowHTML).join("") || `<p class="empty-text">見つかりませんでした。</p>`;
    bindListRows(el);
  } catch (e) { toast(e.message); }
}
$("#search-input").addEventListener("input", () => { clearTimeout(searchTimer); searchTimer = setTimeout(runSearch, 300); });
$$("#search-chips .chip").forEach((c) => c.addEventListener("click", () => {
  $$("#search-chips .chip").forEach((x) => x.classList.remove("active"));
  c.classList.add("active");
  runSearch();
}));
$("#filter-unread").addEventListener("change", runSearch);
$("#filter-memo").addEventListener("change", runSearch);

/* ===== Memos view ===== */
async function loadMemos() {
  try {
    const data = await api("/api/memos");
    const el = $("#memo-list");
    $("#memo-empty").hidden = data.memos.length > 0;
    el.innerHTML = data.memos.map((m) => `
      <div class="memo-card">
        <div class="memo-body">${esc(m.body)}</div>
        <div class="memo-meta">
          <span class="memo-item-title" data-item="${m.item_id}">『${esc(m.item_title)}』</span>
          <span class="memo-date">${fmtDate(m.created_at)}</span>
        </div>
      </div>`).join("");
    $$(".memo-item-title", el).forEach((t) => t.addEventListener("click", () => openDetail(parseInt(t.dataset.item))));
  } catch (e) { toast(e.message); }
}

/* ===== Stats ===== */
async function loadStats() {
  try {
    const types = ["", "book", "cd", "dvd", "other"];
    const labels = ["すべて", "書籍", "CD", "DVD", "その他"];
    const parts = [];
    for (let i = 0; i < types.length; i++) {
      const d = await fetchItems({ type: types[i], limit: 1, offset: 0 });
      parts.push(`<span class="badge ${i === 0 ? "" : "badge-muted"}">${labels[i]} ${d.total}</span>`);
    }
    $("#settings-stats").innerHTML = parts.join("");
  } catch (_) {}
}

/* ===== Modals ===== */
function openModal(id) { $("#" + id).hidden = false; document.body.style.overflow = "hidden"; }
function closeModal(id) { $("#" + id).hidden = true; document.body.style.overflow = ""; }
$$("[data-close]").forEach((b) => b.addEventListener("click", () => closeModal(b.dataset.close)));
$$(".modal-backdrop").forEach((bd) => bd.addEventListener("click", (e) => { if (e.target === bd) closeModal(bd.id); }));

/* ===== Item detail ===== */
async function openDetail(id, focusMemo = false) {
  try {
    const item = await api(`/api/items/${id}`);
    state._detail = item;
    state.detailId = id;
    $("#detail-cover").innerHTML = coverHTML(item);
    $("#detail-type").textContent = TYPE_BADGE[item.type] || "ITEM";
    $("#detail-isbn").textContent = item.isbn ? `ISBN ${item.isbn}` : "";
    $("#detail-title").textContent = item.title;
    $("#detail-creator").textContent = item.creator || "";
    $("#detail-publisher").textContent = item.publisher || "";
    $("#d-status").value = item.status;
    $("#d-type").value = item.type;
    $("#d-prog-cur").value = item.prog_cur || "";
    $("#d-prog-total").value = item.prog_total || "";
    $("#d-title").value = item.title;
    $("#d-creator").value = item.creator || "";
    $("#d-publisher").value = item.publisher || "";
    $("#d-isbn").value = item.isbn || "";
    openModal("item-modal");
    await loadDetailMemos(id);
    if (focusMemo) setTimeout(() => $("#memo-input").focus(), 100);
  } catch (e) { toast(e.message); }
}
async function loadDetailMemos(id) {
  const data = await api(`/api/items/${id}/memos`);
  $("#detail-memo-count").textContent = `（${data.memos.length}件）`;
  $("#detail-memos").innerHTML = data.memos.map((m) => `
    <div class="memo-card">
      <div class="memo-body">${esc(m.body)}</div>
      <div class="memo-meta">
        <span class="memo-date">${fmtDate(m.created_at)}</span>
        <button class="memo-del" data-memo="${m.id}">削除</button>
      </div>
    </div>`).join("");
  $$("#detail-memos .memo-del").forEach((b) => b.addEventListener("click", async () => {
    await api(`/api/memos/${b.dataset.memo}`, { method: "DELETE" });
    loadDetailMemos(id);
    refreshAfterChange();
  }));
}
$("#memo-add").addEventListener("click", async () => {
  const body = $("#memo-input").value.trim();
  if (!body) return;
  try {
    await api(`/api/items/${state.detailId}/memos`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body }),
    });
    $("#memo-input").value = "";
    loadDetailMemos(state.detailId);
    refreshAfterChange();
    toast("メモを追加しました");
  } catch (e) { toast(e.message); }
});
$("#detail-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = state.detailId;
  const payload = {
    type: $("#d-type").value,
    status: $("#d-status").value,
    title: $("#d-title").value,
    creator: $("#d-creator").value,
    publisher: $("#d-publisher").value,
    isbn: $("#d-isbn").value,
    cover_url: state._detail ? state._detail.cover_url : "",
    image_key: state._detail ? state._detail.image_key : "",
    prog_cur: $("#d-prog-cur").value,
    prog_total: $("#d-prog-total").value,
  };
  try {
    await api(`/api/items/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    toast("保存しました");
    closeModal("item-modal");
    refreshAfterChange();
  } catch (err) { toast(err.message); }
});
$("#detail-delete").addEventListener("click", async () => {
  if (!confirm("このアイテムを削除しますか？メモも一緒に削除されます。")) return;
  await api(`/api/items/${state.detailId}`, { method: "DELETE" });
  closeModal("item-modal");
  $("#pullout").hidden = true;
  state.selectedId = null;
  refreshAfterChange();
  toast("削除しました");
});
$("#detail-change-cover").addEventListener("click", () => $("#detail-cover-file").click());
$("#detail-cover-file").addEventListener("change", (e) => {
  const f = e.target.files[0];
  e.target.value = "";
  if (f) openCoverEditor(f, async (key) => {
    const item = state._detail;
    const payload = { ...item, image_key: key };
    await api(`/api/items/${item.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    toast("表紙を更新しました");
    openDetail(item.id);
    refreshAfterChange();
  });
});
function refreshAfterChange() {
  loadHome(true);
  if (state.view === "memos") loadMemos();
  if (state.view === "search") runSearch();
}

/* ===== Item create form ===== */
function openForm(prefill = {}) {
  state.pendingImageKey = prefill.image_key || "";
  state.pendingCoverUrl = prefill.cover_url || "";
  $("#f-type").value = prefill.type || "book";
  $("#f-status").value = prefill.status || "unread";
  $("#f-title").value = prefill.title || "";
  $("#f-creator").value = prefill.creator || "";
  $("#f-publisher").value = prefill.publisher || "";
  $("#f-isbn").value = prefill.isbn || "";
  $("#f-cover-url").value = prefill.cover_url || "";
  $("#f-prog-cur").value = prefill.prog_cur || "";
  $("#f-prog-total").value = prefill.prog_total || "";
  $("#f-photo-status").textContent = state.pendingImageKey ? "写真を設定済み" : "";
  updateFormCoverPreview();
  openModal("form-modal");
}
function updateFormCoverPreview() {
  const url = state.pendingImageKey ? `/api/images/${encodeURIComponent(state.pendingImageKey)}` : $("#f-cover-url").value.trim();
  $("#form-cover-preview").innerHTML = url ? `<img src="${esc(url)}" alt="" onerror="this.remove()">` : "";
}
$("#f-cover-url").addEventListener("input", updateFormCoverPreview);
$("#manual-add").addEventListener("click", () => openForm());
$("#f-photo-btn").addEventListener("click", () => $("#f-photo-file").click());
$("#f-photo-file").addEventListener("change", (e) => {
  const f = e.target.files[0];
  e.target.value = "";
  if (f) openCoverEditor(f, (key) => {
    state.pendingImageKey = key;
    $("#f-photo-status").textContent = "写真を設定済み";
    updateFormCoverPreview();
  });
});
$("#item-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const payload = {
    type: $("#f-type").value,
    status: $("#f-status").value,
    title: $("#f-title").value,
    creator: $("#f-creator").value,
    publisher: $("#f-publisher").value,
    isbn: $("#f-isbn").value,
    cover_url: $("#f-cover-url").value,
    image_key: state.pendingImageKey,
    prog_cur: $("#f-prog-cur").value,
    prog_total: $("#f-prog-total").value,
  };
  try {
    await api("/api/items", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    closeModal("form-modal");
    toast("登録しました");
    switchView("home");
    setViewMode("shelf");
    loadHome(true);
  } catch (err) { toast(err.message); }
});

/* ===== Cover perspective correction ===== */
let coverState = null;
function openCoverEditor(file, onDone) {
  const url = URL.createObjectURL(file);
  const img = $("#cover-editor-img");
  img.onload = () => {
    const w = img.clientWidth, h = img.clientHeight;
    coverState = {
      onDone,
      corners: [
        { x: w * 0.08, y: h * 0.08 },
        { x: w * 0.92, y: h * 0.08 },
        { x: w * 0.92, y: h * 0.92 },
        { x: w * 0.08, y: h * 0.92 },
      ],
    };
    positionHandles();
    openModal("cover-modal");
  };
  img.src = url;
}
function positionHandles() {
  if (!coverState) return;
  const editor = $("#cover-editor");
  const rect = editor.getBoundingClientRect();
  const pts = coverState.corners.map((c) => `${c.x},${c.y}`).join(" ");
  $("#cover-editor-poly").setAttribute("points", pts);
  const svg = $("#cover-editor-svg");
  svg.setAttribute("viewBox", `0 0 ${rect.width} ${rect.height}`);
  $$(".corner-handle").forEach((h, i) => {
    h.style.left = coverState.corners[i].x + "px";
    h.style.top = coverState.corners[i].y + "px";
  });
}
$$(".corner-handle").forEach((h) => {
  h.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    h.setPointerCapture(e.pointerId);
    const idx = parseInt(h.dataset.corner);
    const editor = $("#cover-editor");
    const move = (ev) => {
      const rect = editor.getBoundingClientRect();
      coverState.corners[idx] = {
        x: Math.max(0, Math.min(rect.width, ev.clientX - rect.left)),
        y: Math.max(0, Math.min(rect.height, ev.clientY - rect.top)),
      };
      positionHandles();
    };
    const up = () => {
      h.removeEventListener("pointermove", move);
      h.removeEventListener("pointerup", up);
    };
    h.addEventListener("pointermove", move);
    h.addEventListener("pointerup", up);
  });
});
/* homography: map unit square -> quad, then inverse-warp by grid subdivision */
function computeH(src, dst) {
  // solve H (3x3) such that dst = H * src for 4 point pairs
  const A = [], b = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = src[i], { x: X, y: Y } = dst[i];
    A.push([x, y, 1, 0, 0, 0, -X * x, -X * y]); b.push(X);
    A.push([0, 0, 0, x, y, 1, -Y * x, -Y * y]); b.push(Y);
  }
  // Gaussian elimination
  const n = 8;
  for (let col = 0, row = 0; col < n && row < n; col++, row++) {
    let piv = row;
    for (let r = row; r < n; r++) if (Math.abs(A[r][col]) > Math.abs(A[piv][col])) piv = r;
    [A[row], A[piv]] = [A[piv], A[row]];
    [b[row], b[piv]] = [b[piv], b[row]];
    const d = A[row][col] || 1e-12;
    for (let j = col; j < n; j++) A[row][j] /= d;
    b[row] /= d;
    for (let r = 0; r < n; r++) {
      if (r === row) continue;
      const f = A[r][col];
      for (let j = col; j < n; j++) A[r][j] -= f * A[row][j];
      b[r] -= f * b[row];
    }
  }
  return [b[0], b[1], b[2], b[3], b[4], b[5], b[6], b[7], 1];
}
function applyH(H, x, y) {
  const w = H[6] * x + H[7] * y + H[8];
  return { x: (H[0] * x + H[1] * y + H[2]) / w, y: (H[3] * x + H[4] * y + H[5]) / w };
}
$("#cover-apply").addEventListener("click", async () => {
  if (!coverState) return;
  const img = $("#cover-editor-img");
  const scaleX = img.naturalWidth / img.clientWidth;
  const scaleY = img.naturalHeight / img.clientHeight;
  const quad = coverState.corners.map((c) => ({ x: c.x * scaleX, y: c.y * scaleY }));
  const OUT_W = 600, OUT_H = 848;
  const H = computeH([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }], quad);
  const src = document.createElement("canvas");
  src.width = img.naturalWidth; src.height = img.naturalHeight;
  src.getContext("2d").drawImage(img, 0, 0);
  const out = document.createElement("canvas");
  out.width = OUT_W; out.height = OUT_H;
  const ctx = out.getContext("2d");
  const GRID = 24;
  for (let gy = 0; gy < GRID; gy++) {
    for (let gx = 0; gx < GRID; gx++) {
      const u0 = gx / GRID, v0 = gy / GRID, u1 = (gx + 1) / GRID, v1 = (gy + 1) / GRID;
      const p00 = applyH(H, u0, v0), p10 = applyH(H, u1, v0), p01 = applyH(H, u0, v1), p11 = applyH(H, u1, v1);
      // draw two triangles with affine transform approximation
      drawTri(ctx, src, p00, p10, p01, u0 * OUT_W, v0 * OUT_H, u1 * OUT_W, v0 * OUT_H, u0 * OUT_W, v1 * OUT_H);
      drawTri(ctx, src, p10, p11, p01, u1 * OUT_W, v0 * OUT_H, u1 * OUT_W, v1 * OUT_H, u0 * OUT_W, v1 * OUT_H);
    }
  }
  const blob = await new Promise((r) => out.toBlob(r, "image/jpeg", 0.88));
  const fd = new FormData();
  fd.append("file", blob, "cover.jpg");
  try {
    const res = await api("/api/images", { method: "POST", body: fd });
    const cb = coverState.onDone;
    closeModal("cover-modal");
    coverState = null;
    toast("表紙写真を保存しました");
    if (cb) cb(res.key);
  } catch (e) { toast(e.message); }
});
function drawTri(ctx, img, s0, s1, s2, d0x, d0y, d1x, d1y, d2x, d2y) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(d0x, d0y); ctx.lineTo(d1x, d1y); ctx.lineTo(d2x, d2y);
  ctx.closePath(); ctx.clip();
  const denom = (s1.y - s2.y) * (s0.x - s2.x) + (s2.x - s1.x) * (s0.y - s2.y);
  if (Math.abs(denom) < 1e-9) { ctx.restore(); return; }
  const a = ((s1.y - s2.y) * (d0x - d2x) + (s2.x - s1.x) * (d0y - d2y)) / denom;
  const b = ((s2.y - s0.y) * (d0x - d2x) + (s0.x - s2.x) * (d0y - d2y)) / denom;
  const c = d2x - a * s2.x - b * s2.y;
  const d = ((s1.y - s2.y) * (d1x - d2x) + (s2.x - s1.x) * (d1y - d2y)) / denom;
  const e = ((s2.y - s0.y) * (d1x - d2x) + (s0.x - s2.x) * (d1y - d2y)) / denom;
  const f = d2y - d * s2.x - e * s2.y;
  // Note: mapping uses combined transform below (recompute properly)
  ctx.restore();
  // Simpler robust path: use per-triangle affine from source->dest directly
  drawTriAffine(ctx, img, s0, s1, s2, { x: d0x, y: d0y }, { x: d1x, y: d1y }, { x: d2x, y: d2y });
}
function drawTriAffine(ctx, img, s0, s1, s2, d0, d1, d2) {
  const denom = (s1.y - s2.y) * (s0.x - s2.x) + (s2.x - s1.x) * (s0.y - s2.y);
  if (Math.abs(denom) < 1e-9) return;
  const a = ((s1.y - s2.y) * (d0.x - d2.x) + (s2.x - s1.x) * (d0.y - d2.y)) / denom;
  const b = ((s2.y - s0.y) * (d0.x - d2.x) + (s0.x - s2.x) * (d0.y - d2.y)) / denom;
  const c = d2.x - a * s2.x - b * s2.y;
  const d = ((s1.y - s2.y) * (d1.x - d2.x) + (s2.x - s1.x) * (d1.y - d2.y)) / denom;
  const e = ((s2.y - s0.y) * (d1.x - d2.x) + (s0.x - s2.x) * (d1.y - d2.y)) / denom;
  const f = d2.y - d * s2.x - e * s2.y;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(d0.x, d0.y); ctx.lineTo(d1.x, d1.y); ctx.lineTo(d2.x, d2.y);
  ctx.closePath(); ctx.clip();
  ctx.setTransform(a, d, b, e, c, f);
  ctx.drawImage(img, 0, 0);
  ctx.restore();
}

/* ===== Lookup ===== */
async function doLookup(code) {
  const status = $("#lookup-status");
  status.textContent = "検索中…";
  $("#lookup-results").innerHTML = "";
  try {
    const data = await api(`/api/lookup?code=${encodeURIComponent(code)}`);
    if (!data.results.length) {
      status.textContent = "見つかりませんでした。手動登録をお試しください。";
      return;
    }
    status.textContent = `${data.results.length}件見つかりました。タップで登録フォームに反映します。`;
    $("#lookup-results").innerHTML = data.results.map((r, i) => `
      <div class="lookup-card" data-idx="${i}">
        ${r.cover_url ? `<img src="${esc(r.cover_url)}" alt="" onerror="this.remove()">` : ""}
        <div style="flex:1;min-width:0">
          <div class="list-title">${esc(r.title)}</div>
          <div class="list-sub">${esc(r.creator || "")} ／ ${esc(r.source)} ／ ${TYPE_LABEL[r.type] || ""}</div>
        </div>
        <button class="btn-primary btn-small">登録</button>
      </div>`).join("");
    $$("#lookup-results .lookup-card").forEach((card) => card.addEventListener("click", () => {
      const r = data.results[parseInt(card.dataset.idx)];
      openForm(r);
    }));
  } catch (e) {
    status.textContent = "検索に失敗しました: " + e.message;
  }
}
$("#code-lookup").addEventListener("click", () => {
  const code = $("#code-input").value.replace(/[-\s]/g, "");
  if (code) doLookup(code);
});

/* ===== Barcode scan ===== */
let scanStream = null, scanTimer = null, zxingControls = null;
async function startScan() {
  const video = $("#scan-video");
  $("#camera-wrap").hidden = false;
  $("#scan-start").hidden = true;
  $("#scan-stop").hidden = false;
  try {
    if ("BarcodeDetector" in window) {
      scanStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      video.srcObject = scanStream;
      await video.play();
      const detector = new BarcodeDetector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"] });
      const loop = async () => {
        if (!scanStream) return;
        try {
          const codes = await detector.detect(video);
          if (codes && codes.length) {
            stopScan();
            $("#code-input").value = codes[0].rawValue;
            doLookup(codes[0].rawValue);
            return;
          }
        } catch (_) {}
        scanTimer = setTimeout(loop, 350);
      };
      loop();
    } else if (window.ZXingBrowser) {
      const reader = new ZXingBrowser.BrowserMultiFormatReader();
      zxingControls = await reader.decodeFromVideoDevice(undefined, video, (result) => {
        if (result) {
          const code = result.getText();
          stopScan();
          $("#code-input").value = code;
          doLookup(code);
        }
      });
    } else {
      toast("このブラウザはバーコード読み取りに対応していません。コードを手入力してください。");
      stopScan();
    }
  } catch (e) {
    toast("カメラを起動できませんでした: " + e.message);
    stopScan();
  }
}
function stopScan() {
  if (scanTimer) { clearTimeout(scanTimer); scanTimer = null; }
  if (scanStream) { scanStream.getTracks().forEach((t) => t.stop()); scanStream = null; }
  if (zxingControls) { try { zxingControls.stop(); } catch (_) {} zxingControls = null; }
  const v = $("#scan-video");
  if (v) v.srcObject = null;
  const wrap = $("#camera-wrap");
  if (wrap) wrap.hidden = true;
  const st = $("#scan-start"); if (st) st.hidden = false;
  const sp = $("#scan-stop"); if (sp) sp.hidden = true;
}
$("#scan-start").addEventListener("click", startScan);
$("#scan-stop").addEventListener("click", stopScan);

/* ===== OCR ===== */
$("#ocr-add").addEventListener("click", () => $("#ocr-file").click());
$("#ocr-file").addEventListener("change", async (e) => {
  const f = e.target.files[0];
  e.target.value = "";
  if (!f) return;
  if (!window.Tesseract) { toast("OCRライブラリの読み込みに失敗しました"); return; }
  toast("OCRで読み取り中…（少し時間がかかります）");
  try {
    const { data } = await Tesseract.recognize(f, "jpn+eng");
    const lines = data.text.split("\n").map((s) => s.trim()).filter((s) => s.length >= 2);
    if (!lines.length) { toast("文字を読み取れませんでした"); return; }
    const isbnMatch = data.text.replace(/[-\s]/g, "").match(/97[89]\d{10}/);
    openForm({ title: lines[0], isbn: isbnMatch ? isbnMatch[0] : "" });
    toast(`OCR結果を反映しました: ${lines[0]}`);
  } catch (err) {
    toast("OCRに失敗しました: " + err.message);
  }
});

/* ===== Init ===== */
(async function init() {
  try {
    const user = await api("/api/auth/me");
    state.user = user;
    enterApp();
  } catch (_) {
    showAuth();
  }
})();
