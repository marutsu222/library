"use strict";

const elements = {
  app: document.getElementById("readerApp"),
  pages: document.getElementById("readerPages"),
  title: document.getElementById("readerBookTitle"),
  hint: document.getElementById("readerHint"),
  prev: document.getElementById("readerPrev"),
  next: document.getElementById("readerNext"),
  progress: document.getElementById("readerProgress"),
  counter: document.getElementById("readerCounter"),
  fullscreen: document.getElementById("readerFullscreen")
};

let currentBook = null;
let currentPage = 0;
let scrollTimer = 0;

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
  currentPage = Math.max(0, Math.min(index, currentBook.pages.length - 1));
  const page = elements.pages.children[currentPage];
  if (page) page.scrollIntoView({ behavior, inline: "start", block: "nearest" });
  updateControls();
}

function renderBook() {
  const title = currentBook.title || "漫画";
  document.title = `${title}｜吉田図書館`;
  elements.title.textContent = title;
  elements.hint.textContent = currentBook.readingDirection === "rtl"
    ? "右から左へ横にスワイプして読めます"
    : "横にスワイプして読めます";
  elements.pages.dataset.direction = currentBook.readingDirection || "ltr";
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

function showError(error) {
  console.error(error);
  elements.title.textContent = "読み込みエラー";
  elements.pages.innerHTML = `<div class="reader-message reader-error">${escapeHtml(error.message)}<br><small>GitHub PagesまたはLive Serverで開いてください。</small></div>`;
  elements.app.setAttribute("aria-busy", "false");
}

async function toggleFullscreen() {
  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
    else await document.exitFullscreen();
  } catch (error) {
    console.warn("全画面表示を開始できませんでした。", error);
  }
}

elements.prev.addEventListener("click", () => goToPage(currentPage - 1));
elements.next.addEventListener("click", () => goToPage(currentPage + 1));
elements.progress.addEventListener("input", event => goToPage(Number(event.target.value) - 1));
elements.pages.addEventListener("scroll", () => {
  clearTimeout(scrollTimer);
  scrollTimer = setTimeout(() => {
    if (!currentBook || !elements.pages.clientWidth) return;
    currentPage = Math.round(elements.pages.scrollLeft / elements.pages.clientWidth);
    updateControls();
  }, 80);
}, { passive: true });
elements.fullscreen.addEventListener("click", toggleFullscreen);
document.addEventListener("keydown", event => {
  if (event.key === "ArrowLeft") goToPage(currentPage - 1);
  if (event.key === "ArrowRight") goToPage(currentPage + 1);
  if (event.key === "Home") goToPage(0);
  if (event.key === "End" && currentBook) goToPage(currentBook.pages.length - 1);
});
window.addEventListener("resize", () => { if (currentBook) goToPage(currentPage, "auto"); });

loadRequestedBook().then(book => { currentBook = book; renderBook(); }).catch(showError);
