"use strict";

const gallery = {
  track: document.getElementById("galleryTrack"),
  dots: document.getElementById("galleryDots"),
  prev: document.getElementById("galleryPrev"),
  next: document.getElementById("galleryNext"),
  counter: document.getElementById("galleryCounter"),
  lightbox: document.getElementById("galleryLightbox"),
  lightboxImage: document.getElementById("galleryLightboxImage"),
  lightboxCaption: document.getElementById("galleryLightboxCaption"),
  lightboxClose: document.getElementById("galleryLightboxClose")
};

let galleryItems = [];
let galleryIndex = 0;
let galleryScrollTimer = 0;

function galleryEscape(value) {
  return String(value ?? "").replace(/[&<>'"]/g, char => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;"
  })[char]);
}

function renderGallery() {
  if (!galleryItems.length) {
    gallery.track.innerHTML = '<div class="gallery-empty">現在、展示準備中です。</div>';
    gallery.dots.innerHTML = "";
    gallery.counter.textContent = "0 / 0";
    gallery.prev.disabled = true;
    gallery.next.disabled = true;
    return;
  }

  gallery.track.innerHTML = galleryItems.map((item, index) => `
    <figure class="gallery-card" data-gallery-index="${index}" tabindex="0" aria-label="${galleryEscape(item.title || `イラスト ${index + 1}`)}を拡大表示">
      <div class="gallery-image-frame">
        <img src="${galleryEscape(item.image)}" alt="${galleryEscape(item.alt || item.title || `イラスト ${index + 1}`)}" loading="lazy" decoding="async">
      </div>
      <figcaption class="gallery-caption">
        <strong>${galleryEscape(item.title || `Illustration ${String(index + 1).padStart(2, "0")}`)}</strong>
        ${item.caption ? `<span>${galleryEscape(item.caption)}</span>` : ""}
      </figcaption>
    </figure>
  `).join("");

  gallery.dots.innerHTML = galleryItems.map((_, index) => `
    <button class="gallery-dot ${index === 0 ? "active" : ""}" type="button" data-gallery-dot="${index}" aria-label="${index + 1}枚目へ"></button>
  `).join("");

  gallery.track.querySelectorAll("img").forEach(img => {
    img.addEventListener("error", () => {
      img.closest(".gallery-image-frame").innerHTML = '<div class="gallery-empty">画像を追加してください</div>';
    }, { once: true });
  });

  updateGalleryControls();
}

function getGalleryCards() {
  return [...gallery.track.querySelectorAll(".gallery-card")];
}

function goGallery(index, behavior = "smooth") {
  if (!galleryItems.length) return;
  galleryIndex = Math.max(0, Math.min(index, galleryItems.length - 1));
  const card = getGalleryCards()[galleryIndex];
  if (card) card.scrollIntoView({ behavior, inline: "center", block: "nearest" });
  updateGalleryControls();
}

function updateGalleryControls() {
  const total = galleryItems.length;
  gallery.counter.textContent = total ? `${galleryIndex + 1} / ${total}` : "0 / 0";
  gallery.prev.disabled = galleryIndex <= 0;
  gallery.next.disabled = galleryIndex >= total - 1;
  gallery.dots.querySelectorAll(".gallery-dot").forEach((dot, index) => {
    dot.classList.toggle("active", index === galleryIndex);
  });
}

function syncGalleryIndexFromScroll() {
  const cards = getGalleryCards();
  if (!cards.length) return;
  const trackCenter = gallery.track.scrollLeft + gallery.track.clientWidth / 2;
  let closest = 0;
  let closestDistance = Infinity;
  cards.forEach((card, index) => {
    const center = card.offsetLeft + card.offsetWidth / 2;
    const distance = Math.abs(center - trackCenter);
    if (distance < closestDistance) {
      closestDistance = distance;
      closest = index;
    }
  });
  galleryIndex = closest;
  updateGalleryControls();
}

function openGalleryLightbox(index) {
  const item = galleryItems[index];
  if (!item) return;
  gallery.lightboxImage.src = item.image;
  gallery.lightboxImage.alt = item.alt || item.title || `イラスト ${index + 1}`;
  gallery.lightboxCaption.textContent = [item.title, item.caption].filter(Boolean).join(" — ");
  gallery.lightbox.showModal();
}

async function loadGallery() {
  try {
    const response = await fetch("./gallery.json", { cache: "no-cache" });
    if (!response.ok) throw new Error(`gallery.jsonを読み込めませんでした (${response.status})`);
    const data = await response.json();
    if (!Array.isArray(data)) throw new Error("gallery.jsonは配列形式にしてください。");
    galleryItems = data;
    renderGallery();
  } catch (error) {
    console.error(error);
    gallery.track.innerHTML = '<div class="gallery-empty">ギャラリーを読み込めませんでした。</div>';
  }
}

gallery.prev.addEventListener("click", () => goGallery(galleryIndex - 1));
gallery.next.addEventListener("click", () => goGallery(galleryIndex + 1));
gallery.dots.addEventListener("click", event => {
  const dot = event.target.closest("[data-gallery-dot]");
  if (dot) goGallery(Number(dot.dataset.galleryDot));
});
gallery.track.addEventListener("click", event => {
  const card = event.target.closest("[data-gallery-index]");
  if (card) openGalleryLightbox(Number(card.dataset.galleryIndex));
});
gallery.track.addEventListener("keydown", event => {
  if ((event.key === "Enter" || event.key === " ") && event.target.matches("[data-gallery-index]")) {
    event.preventDefault();
    openGalleryLightbox(Number(event.target.dataset.galleryIndex));
  }
});
gallery.track.addEventListener("scroll", () => {
  clearTimeout(galleryScrollTimer);
  galleryScrollTimer = setTimeout(syncGalleryIndexFromScroll, 80);
}, { passive: true });

gallery.lightboxClose.addEventListener("click", () => gallery.lightbox.close());
gallery.lightbox.addEventListener("click", event => {
  if (event.target === gallery.lightbox) gallery.lightbox.close();
});
document.addEventListener("keydown", event => {
  if (event.key === "Escape" && gallery.lightbox.open) gallery.lightbox.close();
});

loadGallery();
