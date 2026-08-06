# 吉田図書館・漫画ビューア

GitHub Pagesにそのまま置ける静的サイトです。

## ファイル構成

- `index.html`: 書籍一覧
- `catalog.js`: `books.json`から一覧を生成
- `viewer.html`: 漫画ビューア
- `viewer.js`: URLの`id`から作品を読み込み
- `viewer.css`: 一覧とビューアの共通CSS
- `books.json`: 公開する作品の一覧
- `books/book-001/book.json`: 作品ごとのページ一覧

## 作品追加

1. `books/book-002/`を作る
2. `cover.webp`, `001.webp`などを置く
3. `books/book-002/book.json`を作る
4. `books.json`に作品を1件追加する

ローカルでHTMLを直接開くとJSONを取得できません。GitHub PagesまたはVS CodeのLive Serverで確認してください。
