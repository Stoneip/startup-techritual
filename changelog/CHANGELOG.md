# Changelog — startup-techritual

所有版本紀錄。格式基於 [Keep a Changelog](https://keepachangelog.com/)。

---

## v1.1.0 - 2026-05-11 (加 /submit page + Startups 目錄 nav tab)

### 背景

`startups.techritual.com` v1.0.0 只有 catalogue 主頁 `/`。同時 `hkapp.techritual.com` 仍係 Firebase Hosting 上嘅獨立投稿表單。本版將兩個 surface 統一去同一個 origin：

- 投稿表單從 `hkapp.techritual.com` 搬到 `startups.techritual.com/submit`
- `hkapp.techritual.com/*` 設 301 redirect 過嚟（在 Cloudflare techritual.com zone Page Rules 設定，唔係 repo 內代碼）

### 新增

- **`public/submit/index.html`** — 由 `gmail-automation-cf/hkapp-form/index.html` 1:1 copy 過嚟，作為 Cloudflare Pages 嘅 static asset 直接 serve。Astro `public/` 入面嘅檔案會原樣 copy 落 build output。Form size：~116KB。
  - 改動：`og:url` 由 `https://hkapp.techritual.com` 改為 `https://startups.techritual.com/submit`
  - 新加 canonical link `<link rel="canonical" href="https://startups.techritual.com/submit">`
  - 新加 AdSense script `pagead2.googlesyndication.com/.../adsbygoogle.js?client=ca-pub-3665735472523700`
  - Header nav 由原本嘅 1 link 改為 2 links：
    - `<a href="https://startups.techritual.com/" data-i18n="nav.directory">Startups 目錄</a>` (NEW)
    - `<a href="https://www.techritual.com" data-i18n="nav.back">返回 TechRitual</a>` (existing)
  - i18n 三語齊全：`nav.directory` = `Startups 目錄` (hk/tw) / `Startups Directory` (en)
- **`src/layouts/Layout.astro` header nav update**：「免費投稿」嘅 link 由 `hkapp.techritual.com` 改為 `/submit`（內部 link，唔再 cross-domain）
- **`CLAUDE.md`** — 新增 project 全方位文件
- **`changelog/CHANGELOG.md`** — 新增（本檔案）

### 修改

- `src/lib/firestore.js` 嘅 catalogue filter 條件唔變（`status === 'published'` AND `wordpressPostUrl` 非空），但今日有 2 個 legacy submissions doc 手動 PATCH 過：
  - **InPark 易泊** (`DVrpPhFqg0JwORQlYY9Q`)：`featuredImageGcsUrl` 補上 WP featured_media URL（之前空，導致 card 圖 fallback 用 broken Google Drive viewer URL）
  - **香港小一 PrimaryHK** (`26nX0zxixEWnNVCm43EQ`)：`status` 由 `drafted` 改為 `published` + 補 `wordpressPostUrl` + `publishedAt`（呢個 doc 係手動喺 WP publish，跳過咗 finalPublish CF flow，所以呢三個 field 一直空）
- Patch script 留低喺 `gmail-automation-cf/scripts/one-time-fix-legacy-records.js`，將來唔需要再 run（pipeline 將來經 finalPublish path 嘅 doc 唔會有呢類問題）

### Backend dependency

呢個 release 需要 `gmail-automation-cf` 已上線 v4.26.0（submitArticle + subscribeNewsletter CORS allow-list 加咗 `startups.techritual.com`）。

### Infrastructure changes（喺 Cloudflare dashboard / API 設定，唔在本 repo）

- Cloudflare Pages：建 `startup-techritual` project，connect GitHub `Stoneip/startup-techritual`，custom domain `startups.techritual.com` (auto SSL)
- Cloudflare Page Rule：`hkapp.techritual.com/*` → 301 → `https://startups.techritual.com/submit`
- DNS：`hkapp.techritual.com` CNAME → `hkapp-techritual.web.app` 改 proxied=true（之前係 grey cloud，redirect rule fire 唔到）

### Verify after deploy

- `https://startups.techritual.com/` → catalogue（3 cards：InPark / Movfolio / PrimaryHK）
- `https://startups.techritual.com/submit/` → 投稿表單，header 有兩個 tab
- `https://hkapp.techritual.com/anything` → 301 → `https://startups.techritual.com/submit`

---

## v1.0.0 - 2026-05-11 (初版 scaffold)

### 新增

- **Astro 4 SSG project**
  - `src/pages/index.astro` — catalogue 主頁
  - `src/layouts/Layout.astro` — 共用 header / footer / styles / OG meta
  - `src/lib/firestore.js` — build-time Firestore REST fetch + snapshot fallback
  - `src/lib/labels.js` — category / region 中文 label
- **Data pipeline**
  - Build 時 fetch `gmail-auto-techritual` Firestore `article_submissions` collection（public read）
  - Filter `status === 'published'` AND `wordpressPostUrl` 非空，sort by `publishedAt` desc
  - 寫入 `public/data/snapshot.json` 作為 fallback；live fetch 失敗時讀 snapshot
- **AdSense auto-ads**：`<head>` 加 publisher script `ca-pub-3665735472523700`，繼承 techritual.com 嘅 account
- **SEO**：
  - Schema.org `ItemList` + `SoftwareApplication` per item（rich results）
  - Auto-sitemap (`@astrojs/sitemap`)
  - robots.txt allow all + sitemap reference
  - Open Graph / Twitter Card / canonical 全 set
- **Mobile responsive**：3/2/1 col grid
- **GitHub Actions weekly cron**：每星期一 00:00 UTC refresh snapshot.json + commit + push（auto-trigger CF Pages re-deploy）
- **README.md**（zh-hk）：完整開發 + 部署文件
- **TODO.md**：roadmap / pending Cloudflare setup steps

### 設計決定

- 揀 Astro over Next.js：純靜態，build output 細，Cloudflare Pages free tier 完美 fit
- 揀 Firestore REST over Admin SDK：build time 唔需要 service account credential，public read 就夠
- 揀 snapshot.json fallback：avoid build break 當 Firestore 暫時 down
- AdSense 用 root publisher 繼承：唔需要 separate AdSense application，content 一上線就會被 scan + 派廣告
