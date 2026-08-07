"use strict";

/* ==========================================================
   catalog.js
   ----------------------------------------------------------
   本棚ページ用JavaScript

   ・books.json の読み込み
   ・検索 / カテゴリ絞り込み
   ・新しい順 / 古い順
   ・お気に入り順
   ・閲覧数順
   ・お気に入り登録
   ・閲覧数の保存
   ・三本線メニュー

   GitHub Pagesのみで動かすため、
   お気に入りと閲覧数はこの端末の localStorage に保存します。
========================================================== */

const STORAGE_KEYS = {
  favorites: "library:favorites",
  views: "library:views"
};

const state = {
  books: [],
  category: "すべて",
  search: "",
  sort: "newest",
  favorites: new Set(),
  views: {}
};

const elements = {
  grid: document.getElementById("bookGrid"),
  filters: document.getElementById("categoryFilters"),
  search: document.getElementById("searchInput"),
  sort: document.getElementById("sortSelect"),
  count: document.getElementById("resultCount"),
  reset: document.getElementById("resetButton"),
  message: document.getElementById("catalogMessage"),
  menuToggle: document.getElementById("menuToggle"),
  headerMenu: document.getElementById("headerMenu")
};


/* ==========================================================
   01. 共通処理
========================================================== */

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;"
  })[char]);
}

function readJsonStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveFavorites() {
  localStorage.setItem(STORAGE_KEYS.favorites, JSON.stringify([...state.favorites]));
}

function saveViews() {
  localStorage.setItem(STORAGE_KEYS.views, JSON.stringify(state.views));
}

function initializeLocalData() {
  state.favorites = new Set(readJsonStorage(STORAGE_KEYS.favorites, []));
  state.views = readJsonStorage(STORAGE_KEYS.views, {});
}


/* ==========================================================
   02. お気に入り / 閲覧数
========================================================== */

function isFavorite(bookId) {
  return state.favorites.has(String(bookId));
}

function getFavoriteCount(book) {
  const base = Number(book.favoriteCount ?? 0);
  return base + (isFavorite(book.id) ? 1 : 0);
}

function getViewCount(book) {
  const base = Number(book.views ?? 0);
  const local = Number(state.views[String(book.id)] ?? 0);
  return base + local;
}

function toggleFavorite(bookId) {
  const id = String(bookId);

  if (state.favorites.has(id)) {
    state.favorites.delete(id);
  } else {
    state.favorites.add(id);
  }

  saveFavorites();
  renderBooks();
}

function addView(bookId) {
  const id = String(bookId);
  state.views[id] = Number(state.views[id] ?? 0) + 1;
  saveViews();
}


/* ==========================================================
   03. カテゴリフィルター
========================================================== */

function createFilters() {
  const categories = [
    "すべて",
    ...new Set(state.books.map(book => book.category).filter(Boolean))
  ];

  elements.filters.innerHTML = categories.map(category => `
    <button
      class="category-button ${category === state.category ? "active" : ""}"
      type="button"
      data-category="${escapeHtml(category)}">
      ${escapeHtml(category)}
    </button>
  `).join("");
}


/* ==========================================================
   04. 並び替え
   ----------------------------------------------------------
   新しい順 / 古い順
   ・publishedAt があれば日付を使用
   ・なければ books.json の並び順を使用
   ========================================================== */

function bookTime(book) {
  if (book.publishedAt) {
    const time = Date.parse(book.publishedAt);
    if (!Number.isNaN(time)) return time;
  }
  return Number(book.__catalogIndex ?? 0);
}

function newestFirst(a, b) {
  return bookTime(b) - bookTime(a);
}

function getFilteredBooks() {
  const keyword = state.search.trim().toLowerCase();

  const books = state.books.filter(book => {
    const categoryMatch =
      state.category === "すべて" || book.category === state.category;

    const target = [
      book.title,
      book.category,
      book.level,
      book.description
    ].filter(Boolean).join(" ").toLowerCase();

    return categoryMatch && (!keyword || target.includes(keyword));
  });

  books.sort((a, b) => {
    switch (state.sort) {
      case "oldest":
        return bookTime(a) - bookTime(b);

      case "favorites":
        return (
          getFavoriteCount(b) - getFavoriteCount(a) ||
          newestFirst(a, b)
        );

      case "views":
        return (
          getViewCount(b) - getViewCount(a) ||
          newestFirst(a, b)
        );

      case "newest":
      default:
        return newestFirst(a, b);
    }
  });

  return books;
}


/* ==========================================================
   05. 書籍カード生成
========================================================== */

function renderBooks() {
  const books = getFilteredBooks();

  elements.count.textContent = String(books.length);
  elements.message.hidden = books.length !== 0;

  if (!books.length) {
    elements.message.textContent = "条件に合う書籍が見つかりませんでした。";
  }

  elements.grid.innerHTML = books.map(book => {
    const readerUrl = `./viewer.html?id=${encodeURIComponent(book.id)}`;
    const favorite = isFavorite(book.id);
    const favoriteCount = getFavoriteCount(book);
    const viewCount = getViewCount(book);

    return `
      <article class="book-card">

        <button
          class="favorite-button ${favorite ? "active" : ""}"
          type="button"
          data-favorite-id="${escapeHtml(book.id)}"
          aria-pressed="${favorite}"
          aria-label="${favorite ? "お気に入りから外す" : "お気に入りに追加"}">
          <span class="favorite-heart" aria-hidden="true">${favorite ? "♥" : "♡"}</span>
          <span class="favorite-count">${favoriteCount}</span>
        </button>

        <a
          class="book-cover"
          href="${readerUrl}"
          data-read-id="${escapeHtml(book.id)}"
          aria-label="${escapeHtml(book.title)}を読む">
          <img
            class="book-cover-image"
            src="${escapeHtml(book.cover)}"
            alt="${escapeHtml(book.title)}の表紙"
            loading="lazy"
            decoding="async">
        </a>

        <div class="book-info">
          <div class="book-meta">
            ${book.category ? `<span class="tag">${escapeHtml(book.category)}</span>` : ""}
            ${book.level ? `<span class="tag">${escapeHtml(book.level)}</span>` : ""}
          </div>

          <h3>${escapeHtml(book.title)}</h3>

          <p class="book-description">
            ${escapeHtml(book.description || "")}
          </p>

          <div class="book-stats">
            <span>♥ ${favoriteCount}</span>
            <span>閲覧 ${viewCount}</span>
          </div>

          <div class="book-bottom">
            <span class="free-label">無料で読む</span>
            <a
              class="read-button"
              href="${readerUrl}"
              data-read-id="${escapeHtml(book.id)}">
              この本を読む
            </a>
          </div>
        </div>
      </article>
    `;
  }).join("");
}


/* ==========================================================
   06. books.json 読み込み
========================================================== */

async function loadCatalog() {
  try {
    const response = await fetch("./books.json", { cache: "no-cache" });

    if (!response.ok) {
      throw new Error(`books.jsonを読み込めませんでした (${response.status})`);
    }

    const books = await response.json();

    if (!Array.isArray(books)) {
      throw new Error("books.jsonは配列形式にしてください。");
    }

    state.books = books.map((book, index) => ({
      ...book,
      __catalogIndex: index
    }));

    elements.message.hidden = true;

    createFilters();
    renderBooks();
  } catch (error) {
    console.error(error);
    elements.message.hidden = false;
    elements.message.innerHTML =
      `書籍一覧の読み込みに失敗しました。<br>
       <small>GitHub PagesまたはLive Serverで開いてください。</small>`;
  }
}


/* ==========================================================
   07. 検索 / フィルター / 並び替え
========================================================== */

elements.filters.addEventListener("click", event => {
  const button = event.target.closest("[data-category]");
  if (!button) return;

  state.category = button.dataset.category;
  createFilters();
  renderBooks();
});

elements.search.addEventListener("input", event => {
  state.search = event.target.value;
  renderBooks();
});

elements.sort.addEventListener("change", event => {
  state.sort = event.target.value;
  renderBooks();
});

elements.reset.addEventListener("click", () => {
  state.category = "すべて";
  state.search = "";
  state.sort = "newest";

  elements.search.value = "";
  elements.sort.value = "newest";

  createFilters();
  renderBooks();
});


/* ==========================================================
   08. 書籍カード操作
========================================================== */

elements.grid.addEventListener("click", event => {
  const favoriteButton = event.target.closest("[data-favorite-id]");

  if (favoriteButton) {
    event.preventDefault();
    toggleFavorite(favoriteButton.dataset.favoriteId);
    return;
  }

  const readLink = event.target.closest("[data-read-id]");

  if (readLink) {
    addView(readLink.dataset.readId);
  }
});


/* ==========================================================
   09. 三本線メニュー
========================================================== */

function closeMenu() {
  if (!elements.menuToggle || !elements.headerMenu) return;

  elements.menuToggle.setAttribute("aria-expanded", "false");
  elements.menuToggle.setAttribute("aria-label", "メニューを開く");
  elements.headerMenu.classList.remove("open");
}

function toggleMenu() {
  if (!elements.menuToggle || !elements.headerMenu) return;

  const willOpen =
    elements.menuToggle.getAttribute("aria-expanded") !== "true";

  elements.menuToggle.setAttribute("aria-expanded", String(willOpen));
  elements.menuToggle.setAttribute(
    "aria-label",
    willOpen ? "メニューを閉じる" : "メニューを開く"
  );

  elements.headerMenu.classList.toggle("open", willOpen);
}

if (elements.menuToggle && elements.headerMenu) {
  elements.menuToggle.addEventListener("click", event => {
    event.stopPropagation();
    toggleMenu();
  });

  elements.headerMenu.addEventListener("click", event => {
    if (event.target.closest("a")) closeMenu();
  });

  document.addEventListener("click", event => {
    if (!event.target.closest(".header-menu-wrap")) closeMenu();
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") closeMenu();
  });
}


/* ==========================================================
   10. 初期化
========================================================== */

initializeLocalData();
loadCatalog();
