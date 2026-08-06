"use strict";

const state = { books: [], category: "すべて", search: "", sort: "recommended" };
const elements = {
  grid: document.getElementById("bookGrid"),
  filters: document.getElementById("categoryFilters"),
  search: document.getElementById("searchInput"),
  sort: document.getElementById("sortSelect"),
  count: document.getElementById("resultCount"),
  reset: document.getElementById("resetButton"),
  message: document.getElementById("catalogMessage")
};

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  })[char]);
}

function createFilters() {
  const categories = ["すべて", ...new Set(state.books.map(book => book.category).filter(Boolean))];
  elements.filters.innerHTML = categories.map(category => `
    <button class="category-button ${category === state.category ? "active" : ""}"
      type="button" data-category="${escapeHtml(category)}">${escapeHtml(category)}</button>
  `).join("");
}

function getFilteredBooks() {
  const keyword = state.search.trim().toLowerCase();
  return state.books.filter(book => {
    const categoryMatch = state.category === "すべて" || book.category === state.category;
    const target = `${book.title || ""} ${book.category || ""} ${book.level || ""} ${book.description || ""}`.toLowerCase();
    return categoryMatch && (!keyword || target.includes(keyword));
  }).sort((a, b) => state.sort === "title"
    ? String(a.title).localeCompare(String(b.title), "ja")
    : Number(a.recommended ?? 999) - Number(b.recommended ?? 999));
}

function renderBooks() {
  const books = getFilteredBooks();
  elements.count.textContent = String(books.length);
  elements.message.hidden = books.length !== 0;
  if (!books.length) elements.message.textContent = "条件に合う書籍が見つかりませんでした。";

  elements.grid.innerHTML = books.map(book => {
    const readerUrl = `./viewer.html?id=${encodeURIComponent(book.id)}`;
    return `
      <article class="book-card">
        <a class="book-cover" href="${readerUrl}" aria-label="${escapeHtml(book.title)}を読む">
          <img class="book-cover-image" src="${escapeHtml(book.cover)}" alt="${escapeHtml(book.title)}の表紙" loading="lazy" decoding="async">
        </a>
        <div class="book-info">
          <div class="book-meta">
            ${book.category ? `<span class="tag">${escapeHtml(book.category)}</span>` : ""}
            ${book.level ? `<span class="tag">${escapeHtml(book.level)}</span>` : ""}
          </div>
          <h3>${escapeHtml(book.title)}</h3>
          <p class="book-description">${escapeHtml(book.description || "")}</p>
          <div class="book-bottom">
            <span class="free-label">無料で読む</span>
            <a class="read-button" href="${readerUrl}">この本を読む</a>
          </div>
        </div>
      </article>`;
  }).join("");
}

async function loadCatalog() {
  try {
    const response = await fetch("./books.json", { cache: "no-cache" });
    if (!response.ok) throw new Error(`books.jsonを読み込めませんでした (${response.status})`);
    const books = await response.json();
    if (!Array.isArray(books)) throw new Error("books.jsonは配列形式にしてください。");
    state.books = books;
    elements.message.hidden = true;
    createFilters();
    renderBooks();
  } catch (error) {
    console.error(error);
    elements.message.hidden = false;
    elements.message.innerHTML = `書籍一覧の読み込みに失敗しました。<br><small>GitHub PagesまたはLive Serverで開いてください。</small>`;
  }
}

elements.filters.addEventListener("click", event => {
  const button = event.target.closest("[data-category]");
  if (!button) return;
  state.category = button.dataset.category;
  createFilters();
  renderBooks();
});
elements.search.addEventListener("input", event => { state.search = event.target.value; renderBooks(); });
elements.sort.addEventListener("change", event => { state.sort = event.target.value; renderBooks(); });
elements.reset.addEventListener("click", () => {
  state.category = "すべて"; state.search = ""; state.sort = "recommended";
  elements.search.value = ""; elements.sort.value = "recommended";
  createFilters(); renderBooks();
});

loadCatalog();
