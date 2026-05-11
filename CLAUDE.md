# startup-techritual

版本：v1.1.0
最後更新：2026-05-11

## 項目簡介

`startups.techritual.com` — 香港・台灣獨立 App / SaaS / 工具目錄網站。內容由 `gmail-auto-techritual` Firestore `article_submissions` collection 嘅 published submission 自動產出。

兩個主要 page：

| URL | 用途 |
|-----|------|
| `/` | Catalogue 目錄 — 由 Firestore live fetch 公開 read 嘅 published submissions，按 category filter |
| `/submit` | 投稿表單 — 由 `gmail-automation-cf/hkapp-form/index.html` port 過嚟，靜態 serve（`public/submit/index.html`） |

舊 `hkapp.techritual.com` 已經 301 redirect 過嚟 `/submit`（Cloudflare Page Rule 在 techritual.com zone 設定）。

## 技術架構

- **Framework**：Astro 4（static SSG）
- **Host**：Cloudflare Pages（free tier，繼承 techritual.com zone）
- **Domain**：startups.techritual.com（custom domain，CF auto-managed SSL）
- **GitHub**：https://github.com/Stoneip/startup-techritual
- **AdSense**：繼承 techritual.com publisher `ca-pub-3665735472523700`（auto-ads）
- **Data**：Firestore REST API（gmail-auto-techritual project，public read，無 auth）
- **Refresh**：每次 git push → CF Pages auto re-build；同時有 GitHub Actions weekly cron refresh snapshot

## 兩個 page 結構

### `/` — Catalogue

- Astro page：`src/pages/index.astro`
- 數據：`src/lib/firestore.js` 嘅 `fetchPublishedSubmissions()`
  - 嘗試 live Firestore REST fetch（10s timeout）
  - 成功 → parse + filter（`status === 'published'` AND `wordpressPostUrl` 非空）+ 寫入 `public/data/snapshot.json` 做下次 fallback
  - 失敗 → 讀 bundled snapshot.json
- 顯示：3-col grid（mobile 1-col），每張 card 帶 featured image + product name + tagline + category badge + region badge + developer name
- `pickImage(s)` priority：`featuredImageGcsUrl → appIconUrl → ogImage`
- Schema.org：ItemList + SoftwareApplication per item（rich results）

### `/submit` — Investor 表單

- 純 static HTML：`public/submit/index.html`（116KB single-file）
- 由 `gmail-automation-cf/hkapp-form/index.html` 1:1 copy，加 minor tweak：
  - `og:url` + canonical 改 `https://startups.techritual.com/submit`
  - 加 AdSense script
  - Header nav 由「返回 TechRitual」單 link 改為兩個 link：「Startups 目錄」（→ `/`）+「返回 TechRitual」（→ www.techritual.com）
  - 新 i18n key `nav.directory`（三語 hk / tw / en 齊全）
- Form submit 去 `submitArticle` Cloud Function — CORS allow-list 已加 `startups.techritual.com` + `startup-techritual.pages.dev`（v4.26.0 backend update）

## 部署

```bash
# 本地開發
npm install
npm run dev          # http://localhost:4321
npm run build        # 產出 dist/
npm run preview      # 預覽 dist/

# Manual snapshot refresh（即時拎 Firestore 最新數據）
npm run snapshot

# Production deploy — git push 即可，Cloudflare Pages auto deploy
git push origin main
```

每次 push main → Cloudflare Pages 自動 trigger build → 約 1-2 分鐘上線。

## CF Pages 設定（已完成）

| 項目 | Value |
|------|-------|
| Account | Stoneip@gmail.com (id `b4812f835e4370782067c26d741714f3`) |
| Project name | `startup-techritual` |
| Production branch | `main` |
| Framework preset | Astro |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Custom domain | `startups.techritual.com` |
| Preview URL | `startup-techritual.pages.dev` |

## hkapp.techritual.com → /submit 301 redirect

設定喺 **techritual.com zone** 嘅 Page Rules（legacy，Pro plan 包 20 條）：

| Target | Action | Status |
|--------|--------|--------|
| `hkapp.techritual.com/*` | Forward URL → `https://startups.techritual.com/submit` | 301 active |

加之前要將 `hkapp.techritual.com` DNS record proxied=true（之前係 grey cloud），否則 redirect rule fire 唔到。

⚠️ Legacy Page Rules **唔保留 query string** — input `?utm=foo` 會 lost。Future migration 去 Single Redirects (Rulesets) 可以保留，但要 token 有 ruleset edit permission。

## Backend dependency

呢個 repo 嘅 `/submit` form 提交去 `gmail-automation-cf` repo 嘅 `submitArticle` Cloud Function（asia-east1）。Backend CORS 必須允許呢個 origin：

```js
// gmail-automation-cf/index.js submitArticle handler
const allowedOrigins = [
  'https://www.techritual.com',
  'https://techritual.com',
  'https://hkapp.techritual.com',
  'https://hkapp-techritual.web.app',
  'https://startups.techritual.com',
  'https://startup-techritual.pages.dev'
];
```

對應 backend：v4.26.0 起 enforce。

## Firestore data dependency

Catalogue 讀緊 `gmail-auto-techritual` 嘅 Firestore default DB `article_submissions` collection。Public read rule（無 auth），write 要 admin。

| Field | 用途 |
|-------|------|
| `status === 'published'` | Filter |
| `wordpressPostUrl` | Card click destination |
| `productName` | Card title |
| `tagline` | Card description |
| `category` | Filter chip + badge |
| `featuredImageGcsUrl` | Card image source (priority 1) |
| `appIconUrl` | Card image fallback (priority 2) |
| `websiteMeta.ogImage` | Card image fallback (priority 3) |
| `developerName` / `developerType` | Card byline |
| `region` | Region badge |
| `publishedAt` | Sort key（newest first） |

## SEO

- ✅ Server-rendered HTML（build-time SSG）
- ✅ Title / meta / OG / Twitter Card 全 set
- ✅ Schema.org ItemList + SoftwareApplication（rich results）
- ✅ Auto sitemap.xml + robots.txt
- ✅ Mobile responsive 3/2/1 col
- ✅ Lazy-load images + aspect-ratio anti-CLS

部署後一次性：

1. Google Search Console add property → URL inspection → Request indexing
2. Submit sitemap: `https://startups.techritual.com/sitemap-index.xml`
3. Rich Results Test 驗證 ItemList markup

## 檔案結構

```
startup-techritual/
├── package.json                     # version + npm scripts
├── astro.config.mjs                 # Astro + integrations 配置
├── CLAUDE.md                        # 本檔案
├── README.md                        # zh-hk 開發文件
├── TODO.md                          # roadmap / pending tasks
├── changelog/CHANGELOG.md           # 詳細版本記錄
├── .github/workflows/refresh.yml    # weekly snapshot cron
├── scripts/
│   └── fetch-snapshot.js            # manual snapshot refresh CLI
├── src/
│   ├── env.d.ts
│   ├── layouts/
│   │   └── Layout.astro             # 共用 header / footer / styles / OG meta
│   ├── lib/
│   │   ├── firestore.js             # build-time Firestore REST + snapshot fallback
│   │   └── labels.js                # category / region 中文 label
│   └── pages/
│       └── index.astro              # catalogue 主頁
└── public/
    ├── data/
    │   └── snapshot.json            # cached Firestore result (fallback)
    └── submit/
        └── index.html               # 投稿表單（port from hkapp-form/index.html）
```

## Git 工作流程

1. 開工前：`git pull origin main`
2. 完成後：`git add .` → `git commit` → `git push origin main`
3. 部署或重大更新：
   - Bump `package.json` version（semver）
   - 更新 CLAUDE.md
   - 更新 changelog/CHANGELOG.md
   - `git tag -a vX.Y.Z -m "..."` + `git push origin vX.Y.Z`
4. GitHub 係唯一 source of truth — 任何 push 自動 trigger CF Pages re-build
5. 敏感檔案（service account keys 等）必須喺 .gitignore（呢個 repo 暫時冇）

## 版本歷史摘要

- **v1.0.0**（2026-05-11 早）：初版 scaffold — Astro 4 + Firestore live fetch + snapshot fallback + AdSense + Schema.org rich results. Catalogue / 主頁。
- **v1.1.0**（2026-05-11 下午）：加 `/submit` page（port from hkapp form），Layout header nav 由純「主站 / 免費投稿 / Startups」改為直接 link 去 `/submit`。submit form header 加「Startups 目錄」tab。同期 hkapp.techritual.com 301 redirect 過嚟 `/submit`。
