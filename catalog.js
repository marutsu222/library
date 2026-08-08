(() => {
  "use strict";

  const elements = {
    grid: document.querySelector("#bookGrid"),
    message: document.querySelector("#catalogMessage"),
    count: document.querySelector("#resultCount"),
    search: document.querySelector("#searchInput"),
    categories: document.querySelector("#categoryFilters"),
    sort: document.querySelector("#sortSelect"),
    reset: document.querySelector("#resetButton"),
    menuToggle: document.querySelector("#menuToggle"),
    menu: document.querySelector("#headerMenu")
  };

  let books = [];
  let selectedCategory = "すべて";

  const categoriesOf = (book) => {
    if (Array.isArray(book.category)) return book.category.filter(Boolean);
    return book.category ? [book.category] : [];
  };

  const openBook = (book) => {
    const params = new URLSearchParams({ book: book.bookData, id: book.id });
    window.location.href = `./viewer.html?${params.toString()}`;
  };

  function renderCategories() {
    const values = ["すべて", ...new Set(books.flatMap(categoriesOf))];
    elements.categories.replaceChildren(...values.map((category) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `category-button${category === selectedCategory ? " active" : ""}`;
      button.textContent = category;
      button.addEventListener("click", () => {
        selectedCategory = category;
        renderCategories();
        renderBooks();
      });
      return button;
    }));
  }

  function filteredBooks() {
    const query = elements.search.value.trim().toLocaleLowerCase("ja");
    const result = books.filter((book) => {
      const categories = categoriesOf(book);
      const categoryMatches = selectedCategory === "すべて" || categories.includes(selectedCategory);
      const searchable = [book.title, book.description, ...categories].filter(Boolean).join(" ").toLocaleLowerCase("ja");
      return categoryMatches && (!query || searchable.includes(query));
    });

    return result.sort((a, b) => {
      const direction = elements.sort.value === "oldest" ? 1 : -1;
      return direction * String(a.publishedAt || "").localeCompare(String(b.publishedAt || ""));
    });
  }

  function createBookCard(book) {
    const card = document.createElement("article");
    card.className = "book-card";
    card.tabIndex = 0;
    card.setAttribute("role", "link");
    card.setAttribute("aria-label", `${book.title}を読む`);

    const cover = document.createElement("div");
    cover.className = "book-cover";
    const image = document.createElement("img");
    image.className = "book-cover-image";
    image.src = book.cover;
    image.alt = `${book.title}の表紙`;
    image.loading = "lazy";
    image.decoding = "async";
    cover.append(image);

    const info = document.createElement("div");
    info.className = "book-info";
    const meta = document.createElement("div");
    meta.className = "book-meta";
    categoriesOf(book).forEach((category) => {
      const tag = document.createElement("span");
      tag.className = "tag";
      tag.textContent = category;
      meta.append(tag);
    });
    const title = document.createElement("h3");
    title.textContent = book.title;
    const description = document.createElement("p");
    description.className = "book-description";
    description.textContent = book.description || "";
    info.append(meta, title, description);
    card.append(cover, info);

    card.addEventListener("click", () => openBook(book));
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openBook(book);
      }
    });
    return card;
  }

  function renderBooks() {
    const visible = filteredBooks();
    elements.count.textContent = String(visible.length);
    elements.grid.replaceChildren(...visible.map(createBookCard));
    elements.message.hidden = visible.length > 0;
    elements.message.textContent = visible.length ? "" : "条件に合う書籍がありません。";
  }

  function setupControls() {
    elements.search.addEventListener("input", renderBooks);
    elements.sort.addEventListener("change", renderBooks);
    elements.reset.addEventListener("click", () => {
      elements.search.value = "";
      elements.sort.value = "newest";
      selectedCategory = "すべて";
      renderCategories();
      renderBooks();
    });

    elements.menuToggle?.addEventListener("click", () => {
      const open = elements.menuToggle.getAttribute("aria-expanded") !== "true";
      elements.menuToggle.setAttribute("aria-expanded", String(open));
      elements.menuToggle.setAttribute("aria-label", open ? "メニューを閉じる" : "メニューを開く");
      elements.menu?.classList.toggle("open", open);
    });
    elements.menu?.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => {
      elements.menuToggle?.setAttribute("aria-expanded", "false");
      elements.menu?.classList.remove("open");
    }));
  }

  async function init() {
    setupControls();
    try {
      const response = await fetch("./books.json", { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (!Array.isArray(data)) throw new Error("books.json must contain an array");
      books = data;
      renderCategories();
      renderBooks();
    } catch (error) {
      console.error(error);
      elements.count.textContent = "0";
      elements.message.hidden = false;
      elements.message.textContent = "書籍情報を読み込めませんでした。";
    }
  }

  init();
})();