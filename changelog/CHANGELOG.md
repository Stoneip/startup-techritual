# Changelog — startup-techritual

所有版本紀錄。格式基於 [Keep a Changelog](https://keepachangelog.com/)。

---

## v1.3.0 - 2026-05-17 (Snapshot refresh：5 → 11 published submissions)

### Why
User 報 `startups.techritual.com` 只有 5 篇 article，但 `/submissions` dashboard 顯示 11 個 published submission。

### Root cause
呢個 site 係 **Astro SSG**：`fetchPublishedSubmissions()` 喺 **build time** 由 Firestore REST API 攞數據（兼帶 update snapshot.json fallback）。Cloudflare Pages 只喺 `git push origin main` 嗰陣先 trigger rebuild。

最後 commit `v1.2.0` 喺 2026-05-12。之後 6 個 published submission 喺 2026-05-13 ~ 2026-05-16 之間加入：
- Picki（2026-05-13）
- 3ook.com / Furwise / Should I Take Taxi?（2026-05-14）
- NoSleep / TwistMeet（2026-05-16）

呢 6 個冇 trigger rebuild → static dist 仍然只有 5 個。

### Fix
- `npm run snapshot` refresh `public/data/snapshot.json` (5 → 11 items)
- Git commit + push 觸發 Cloudflare Pages auto rebuild

### Long-term fix (TODO)
依賴 manual git push 觸發 rebuild 唔 sustainable。建議：
- GitHub Actions cron job，每日掃 Firestore 有冇新 published submission，有就 auto-push commit 觸發 rebuild
- OR `gmail-auto-techritual` `finalPublish` Cloud Function 完成 publish 後 webhook 觸發 Cloudflare Pages Deploy Hook

---

## v1.2.0 - 2026-05-12 (/submit 圖片 URL 加 viewer-URL blocklist — 真正擋 Dropbox / Drive / Notion)

### Why

User report：表單仲收到 Dropbox 連結例如：

```
https://www.dropbox.com/scl/fi/ldrtn6xhs6vrfwlrzk4uo/ev-boy-logo-blue.png?rlkey=...&dl=0
```

舊 regex `var imgRe = /\.(jpe?g|png|webp)(\?.*)?$/i;`（`public/submit/index.html:1175`）只睇 path 末段有冇 `.png/.jpg/.webp` + optional `?query`。Dropbox 上述 URL 真係喺 path 入面有 `.png`，後面 `?rlkey=...&dl=0` 又啱 query string pattern — 所以**通過** regex。

但 `?dl=0`（Dropbox default）返 **HTML preview page**，唔係 raw image bytes。Editor / image generator fetch 嗰陣攞到 HTML，brand featured image fail。i18n 文字明明寫住 ⛔ 唔可以用 viewer URL，但 client 冇真正 enforce。

### Changed

- `public/submit/index.html:1170-1220` — 換 image-URL validation block：
  - 新 helper `detectViewerUrl(url)`：用 `URL` constructor parse hostname，回傳 platform name string（`"Dropbox"` / `"Google Drive"` / `"Notion"` / `"OneDrive"`）或 `null`
    - **Dropbox**：`www.dropbox.com` / `dropbox.com` → 必須 `?dl=1` 或 `?raw=1`，否則 reject
    - **Google Drive**：`drive.google.com` / `docs.google.com` → 一律 reject（無 raw image URL pattern）
    - **Notion**：`notion.so` / `*.notion.so` / `*.notion.site` → reject
    - **OneDrive**：`1drv.ms` / `onedrive.live.com` → reject
  - 新 helper `validateImgUrl(value, labelKey)`：先 call `detectViewerUrl`，命中就用 `err.imageViewer` 顯示「呢個係 X 嘅 viewer 連結」+ 教用 `?dl=1` 或 host 喺 Imgur / GitHub / Cloudinary。冇命中 fallback `imgRe` extension check
  - 原本 inline 兩個 for-loop 簡化用 `validateImgUrl` helper，行為一致

### Added

- 3 個 i18n key（hk / tw / en）：`err.imageViewer` — `{label}：「{url}」係 {platform} 嘅 viewer 連結...`

### 唔變

- Backend `submitArticle` CF / Firestore schema / regex extension check
- 已 submitted 嘅舊 submission 唔受影響
- Step 1-2-4 validation 邏輯不變

### 驗證

1. Open `https://startups.techritual.com/submit/` Mode 1（自己填寫） Step 3
2. App icon URL 試 `https://www.dropbox.com/scl/fi/xxx/foo.png?dl=0` → 應該見「Dropbox 嘅 viewer 連結」error
3. 改為 `?dl=1` → 通過
4. 試 `https://drive.google.com/file/d/abc/view` → 「Google Drive 嘅 viewer 連結」error
5. 試 `https://i.imgur.com/abc.png` → 通過

---

## v1.1.2 - 2026-05-12 (/submit 表單 reject emoji + CJK Ext B+ 罕字)

### Why

techritual.com WordPress `wp_posts` table 係 `utf8mb3`，存唔到 4-byte UTF-8 字符
（emoji 😀📱 / Ext B+ 罕字 𠺘𥚃 等）。投稿時若含呢類字符 → 後端 WP REST API
返「無法將文章資料插入至資料庫」500，用戶 confused。

### Changed

- `public/submit/index.html` `submitProduct()` 加 client-side regex 檢查 12 個
  text field（產品名稱 / 標語 / 描述 / 獨特賣點 / 使用方法 / 競品 / Launch
  comment / 更多補充 / Traction / 開發者名稱 / 聯絡人 / AI 整合答案）
- Regex：`/[\u{10000}-\u{10FFFF}]/u`
- 觸發時：showMsg('error', '唔接受 emoji 或罕用漢字 ...')，列出有問題嘅欄位，
  唔向後端 submit

### Notes

- 純 client-side validation。Backend `submitArticle` CF 同時有 server-side
  safety net（gmail-automation-cf v4.32.0）— 即使有人 bypass JS 都 reject
- 唔影響 emoji-free 投稿
- BMP 範圍嘅繁體中文（U+4E00–U+9FFF，~25K 常用漢字）100% 保留

---

## v1.1.1 - 2026-05-12 (移除 /submit page Google AdSense)

### Removed

- `public/submit/index.html` 移除 AdSense auto-ads `<script>` (line 15-16)

### Why

`/submit` 係 conversion-focused 表單頁，廣告會分散投稿者注意力 + 拖慢首屏。

### Notes

- Catalogue (`/`) 仍保留 AdSense（透過 `Layout.astro`）— 唔受影響
- AdSense publisher account `ca-pub-3665735472523700` 仍有效，淨係呢一頁唔載 ad

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
