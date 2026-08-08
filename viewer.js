"use strict";

const elements = {
  app: document.getElementById("readerApp"),
  pages: document.getElementById("readerPages"),
  title: document.getElementById("readerBookTitle"),
  hint: document.getElementById("readerHint"),
  prev: document.getElementById("readerPrev"),
  next: document.getElementById("readerNext"),
  progress: document.getElementById("readerProgress"),
  counter: document.getElementById("readerCounter")
};

let currentBook = null;
let currentPage = 0;
let scrollTimer = 0;
let tapTimer = 0;
let lastTap = null;
let pointerStart = null;
const DOUBLE_TAP_DELAY = 300;
const TAP_MOVE_LIMIT = 14;

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  })[char]);
}

function resolveAssetPath(jsonPath, assetPath) {
  return new URL(assetPath, new URL(jsonPath, window.location.href)).href;
}

async function fetchJson(path) {
  const response = await fetch(path, { cache: "no-cache" });
  if (!response.ok) throw new Error(`${path}を読み込めませんでした (${response.status})`);
  return response.json();
}

function getRequestedBookId() {
  return new URLSearchParams(window.location.search).get("id");
}

async function loadRequestedBook() {
  const id = getRequestedBookId();
  if (!id) throw new Error("URLに作品IDがありません。例: viewer.html?id=book-001");

  const catalog = await fetchJson("./books.json");
  if (!Array.isArray(catalog)) throw new Error("books.jsonは配列形式にしてください。");
  const catalogBook = catalog.find(book => book.id === id);
  if (!catalogBook) throw new Error(`作品「${id}」がbooks.jsonに見つかりません。`);

  const bookData = await fetchJson(catalogBook.bookData);
  if (!Array.isArray(bookData.pages) || bookData.pages.length === 0) {
    throw new Error("book.jsonのpagesに画像を設定してください。");
  }

  return {
    ...catalogBook,
    ...bookData,
    bookData: catalogBook.bookData,
    pages: bookData.pages.map(page => resolveAssetPath(catalogBook.bookData, page))
  };
}

function storageKey() {
  return `reader-position:${currentBook.id}`;
}

function updateControls() {
  if (!currentBook) return;
  const total = currentBook.pages.length;
  currentPage = Math.max(0, Math.min(currentPage, total - 1));
  elements.counter.textContent = `${currentPage + 1} / ${total}`;
  elements.progress.max = String(total);
  elements.progress.value = String(currentPage + 1);
  elements.prev.disabled = currentPage === 0;
  elements.next.disabled = currentPage === total - 1;
  localStorage.setItem(storageKey(), String(currentPage));
}

function goToPage(index, behavior = "smooth") {
  if (!currentBook) return;
  resetZoom();
  currentPage = Math.max(0, Math.min(index, currentBook.pages.length - 1));
  const page = elements.pages.children[currentPage];
  if (page) page.scrollIntoView({ behavior, inline: "start", block: "nearest" });
  updateControls();
}

function renderBook() {
  const title = currentBook.title || "漫画";
  document.title = `${title}｜吉田図書館`;
  elements.title.textContent = title;
  elements.hint.textContent = "中央タップでメニュー・ダブルタップで拡大";
  elements.pages.dataset.direction = "rtl";
  elements.pages.innerHTML = currentBook.pages.map((src, index) => `
    <section class="reader-page" aria-label="${index + 1}ページ目">
      <img class="reader-page-image" src="${escapeHtml(src)}" alt="${escapeHtml(title)} ${index + 1}ページ目"
        ${index <= 1 ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async" draggable="false">
    </section>
  `).join("");

  const saved = Number(localStorage.getItem(storageKey()));
  currentPage = Number.isInteger(saved) ? Math.min(Math.max(saved, 0), currentBook.pages.length - 1) : 0;
  requestAnimationFrame(() => goToPage(currentPage, "auto"));
  elements.app.setAttribute("aria-busy", "false");
}

function currentPageElement() {
  return elements.pages.children[currentPage] || null;
}

function resetZoom() {
  elements.pages.querySelectorAll(".reader-page.is-zoomed").forEach(page => {
    page.classList.remove("is-zoomed");
    page.style.removeProperty("--zoom-x");
    page.style.removeProperty("--zoom-y");
  });
}

function toggleZoom(clientX, clientY) {
  const page = currentPageElement();
  if (!page) return;

  if (page.classList.contains("is-zoomed")) {
    resetZoom();
    return;
  }

  resetZoom();
  const rect = page.getBoundingClientRect();
  const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
  const y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));
  page.style.setProperty("--zoom-x", `${x}%`);
  page.style.setProperty("--zoom-y", `${y}%`);
  page.classList.add("is-zoomed");
  requestAnimationFrame(() => {
    page.scrollLeft = (page.scrollWidth - page.clientWidth) * (x / 100);
    page.scrollTop = (page.scrollHeight - page.clientHeight) * (y / 100);
  });
}

function toggleControls() {
  const hidden = elements.app.classList.toggle("controls-hidden");
  elements.app.setAttribute("data-controls-hidden", String(hidden));
}

function handleSingleTap(clientX) {
  const rect = elements.pages.getBoundingClientRect();
  const position = (clientX - rect.left) / rect.width;

  // 右開き：右端が前ページ、左端が次ページ
  if (position <= 0.25) {
    goToPage(currentPage + 1);
  } else if (position >= 0.75) {
    goToPage(currentPage - 1);
  } else {
    toggleControls();
  }
}

function showError(error) {
  console.error(error);
  elements.title.textContent = "読み込みエラー";
  elements.pages.innerHTML = `<div class="reader-message reader-error">${escapeHtml(error.message)}<br><small>GitHub PagesまたはLive Serverで開いてください。</small></div>`;
  elements.app.setAttribute("aria-busy", "false");
}

elements.prev.addEventListener("click", () => goToPage(currentPage - 1));
elements.next.addEventListener("click", () => goToPage(currentPage + 1));
elements.progress.addEventListener("input", event => goToPage(Number(event.target.value) - 1));
elements.pages.addEventListener("scroll", () => {
  clearTimeout(scrollTimer);
  scrollTimer = setTimeout(() => {
    if (!currentBook) return;
    const viewportCenter = elements.pages.getBoundingClientRect().left + elements.pages.clientWidth / 2;
    let nearestIndex = currentPage;
    let nearestDistance = Infinity;
    [...elements.pages.children].forEach((page, index) => {
      const rect = page.getBoundingClientRect();
      const distance = Math.abs(rect.left + rect.width / 2 - viewportCenter);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });
    currentPage = nearestIndex;
    updateControls();
  }, 80);
}, { passive: true });

elements.pages.addEventListener("pointerdown", event => {
  if (event.pointerType === "mouse" && event.button !== 0) return;
  pointerStart = { x: event.clientX, y: event.clientY, id: event.pointerId };
}, { passive: true });

elements.pages.addEventListener("pointerup", event => {
  if (!pointerStart || pointerStart.id !== event.pointerId) return;
  const moved = Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y);
  pointerStart = null;
  if (moved > TAP_MOVE_LIMIT || event.target.closest("button, a, input")) return;

  const now = performance.now();
  const isDoubleTap = lastTap &&
    now - lastTap.time <= DOUBLE_TAP_DELAY &&
    Math.hypot(event.clientX - lastTap.x, event.clientY - lastTap.y) <= 36;

  if (isDoubleTap) {
    clearTimeout(tapTimer);
    tapTimer = 0;
    lastTap = null;
    toggleZoom(event.clientX, event.clientY);
    return;
  }

  lastTap = { time: now, x: event.clientX, y: event.clientY };
  clearTimeout(tapTimer);
  tapTimer = setTimeout(() => {
    handleSingleTap(event.clientX);
    lastTap = null;
    tapTimer = 0;
  }, DOUBLE_TAP_DELAY);
}, { passive: true });

elements.pages.addEventListener("pointercancel", () => { pointerStart = null; }, { passive: true });
elements.pages.addEventListener("dragstart", event => event.preventDefault());
document.addEventListener("keydown", event => {
  if (event.key === "ArrowLeft") goToPage(currentPage + 1);
  if (event.key === "ArrowRight") goToPage(currentPage - 1);
  if (event.key === "Home") goToPage(0);
  if (event.key === "End" && currentBook) goToPage(currentBook.pages.length - 1);
  if (event.key === "Escape") resetZoom();
});
window.addEventListener("resize", () => { if (currentBook) goToPage(currentPage, "auto"); });

loadRequestedBook().then(book => { currentBook = book; renderBook(); }).catch(showError);
