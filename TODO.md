# TODO — Pending work for startups.techritual.com

呢個檔案 record 等待執行嘅 setup steps + roadmap。完成一項就刪一項或者 mark `[x]`。

---

## Phase A — Cloudflare Pages initial setup（要 Cloudflare admin 權限）

> 狀態：等 user 有 Cloudflare 權限後執行。Astro repo 已準備好 + 推上 GitHub。

### A.1 Connect GitHub repo to Cloudflare Pages

1. 開 https://dash.cloudflare.com → Workers & Pages → Create → Pages tab → Connect to Git
2. 揀 GitHub account `Stoneip` → 選 `startup-techritual` repo
3. Build settings：
   - **Project name**: `startup-techritual`
   - **Production branch**: `main`
   - **Framework preset**: `Astro`
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
   - **Root directory**: `/`
   - **Environment variables**: 唔需要（Firestore 公開 read）
4. Click **Save and Deploy** → 等 ~2 分鐘 first build
5. Verify: 第一個 deploy URL 例如 `https://startup-techritual.pages.dev/` 應該見到 catalogue（2 個 cards）

### A.2 Custom domain `startups.techritual.com`

1. CF Pages project → **Custom domains** → **Set up a custom domain**
2. 輸入 `startups.techritual.com` → Continue
3. CF 自動 detect `techritual.com` 已喺 CF DNS，prompt 加 CNAME → **Activate**
4. 等 ~5 分鐘 SSL（Let's Encrypt 自動 provision）
5. Verify: 開 `https://startups.techritual.com/` 應該 redirect 到 production deploy

### A.3 Google Search Console（可選但建議）

1. 開 https://search.google.com/search-console
2. 加 `https://startups.techritual.com/` property（DNS verify 或 HTML meta tag）
3. URL Inspection → 撳 **Request Indexing**
4. Submit sitemap：`https://startups.techritual.com/sitemap.xml`

### A.4 24-48 小時後監察

- ✅ AdSense auto-ads 開始派廣告（無需 dashboard 設定，繼承 techritual.com 嘅 publisher ID `ca-pub-3665735472523700`）
- ✅ Search Console 見到 `/` indexed
- ✅ Rich Results Test 通過：https://search.google.com/test/rich-results?url=https%3A%2F%2Fstartups.techritual.com%2F

---

## Phase B — 將 hkapp.techritual.com 表單搬到 startups.techritual.com/submit

> 狀態：未執行。Phase A 完成 + custom domain live 之後再做。

### B.1 加新 page `/submit` 落 Astro repo

- 將 `gmail-automation-cf/hkapp-form/index.html` 嘅完整 form 由 plain HTML 轉做 Astro page
- Path: `src/pages/submit.astro`
- 保留：
  - 三語 i18n 系統（hk / tw / en）
  - Mode tabs（自己填 / AI 協助）
  - 三步 / 兩步 wizard + 27 條問題清單
  - Image URL 驗證
  - Showcase grid（重用 `fetchPublishedSubmissions`）
- 設計選擇：
  - **A**：將 plain HTML 包入 single Astro page（最快，~1 hour）
  - **B**：拆做多個 Astro components（更乾淨但花時間）
- 推薦 **選擇 A** 先 ship，重構 later

### B.2 確認所有 backend endpoints 仍 work

- `submitArticle` CF CORS 而家限 `techritual.com` + `hkapp-techritual.web.app` + `hkapp.techritual.com`
- **要加** `https://startups.techritual.com` 落 allow-list
- File: `gmail-automation-cf/index.js` line ~720 嘅 `submitArticle` handler
- 同時 `subscribeNewsletter` CF CORS 都要加（呢個 form 入面有 newsletter section）

### B.3 Set up redirect `hkapp.techritual.com` → `startups.techritual.com/submit`

兩個 option：

**Option 1：Cloudflare Page Rules**（最快）
- Cloudflare DNS dashboard → Rules → Page Rules（或 Bulk Redirects）
- Rule: `hkapp.techritual.com/*` → 301 → `https://startups.techritual.com/submit`

**Option 2：Cloudflare Worker**（更靈活，可以 preserve query string）
- 寫一個 Worker route on `hkapp.techritual.com/*`
- Return `Response.redirect('https://startups.techritual.com/submit', 301)`

**Option 3：Firebase Hosting redirects**（unlikely needed since 我哋 hkapp 喺 Firebase）
- 喺 `firebase.json` 加 `"redirects": [{"source": "**", "destination": "https://startups.techritual.com/submit", "type": 301}]`
- Deploy

推薦 **Option 1**（最簡單，無 Worker overhead）。

### B.4 驗證

| Check | Expected |
|-------|----------|
| `https://startups.techritual.com/submit` | Form 完全正常 work，三語切換 OK，提交成功 |
| `https://hkapp.techritual.com/` | 301 redirect 到 `/submit` |
| `https://hkapp.techritual.com/?utm_source=threads` | 301 保留 query string（如果用 Worker option） |
| Submit form → `submitArticle` CF | 接收到 + 寫入 Firestore + admin email 收到 |
| Submit Mode 2 (AI assisted) | Backend extract PRODUCT_NAME / TAGLINE / WEBSITE 仍 work |
| Showcase grid（同一個 Astro site）| 顯示 published submissions |

### B.5 更新 DM 邀請範本

- File: `stoneip-dashboard-/dashboard/js/pages/submissions.js`
- 兩個範本（中 + 英）入面：`hkapp.techritual.com` → `startups.techritual.com/submit`
- 新中文版：

```
Hi! 我哋係 TechRitual.com 嘅編輯團隊 👋

我哋留意到你嘅 App / 產品，想免費幫你做一篇專業嘅產品介紹文章，發佈到 TechRitual.com。

你會得到：
📌 一篇專業編輯撰寫嘅深度介紹文章
🔗 永久 SEO backlink，提升你嘅 Google 搜尋排名
📈 觸及每月逾百萬香港/台灣科技讀者，幫你獲取更多用戶
📰 文章永久收錄，持續帶來自然流量

兩個填寫方式任你揀：
✏️ 自己逐項填（約 5 分鐘）
🤖 AI 協助填寫：將問題清單交畀 ChatGPT / Claude / Gemini，貼返一條完整答案就得（約 1 分鐘）

填寫表單：
👉 startups.techritual.com/submit
```

新英文版：將原英文版尾部 `hkapp.techritual.com` 改為 `startups.techritual.com/submit`。

### B.6 後續 cleanup（B.5 deploy 後 30 日）

- Update `gmail-auto-techritual` repo CLAUDE.md：mark hkapp 為 deprecated alias
- 唔急住 sunset hkapp Firebase site — 留住做 redirect target，避免任何 deep-link / bookmark 失效
- Search Console：URL inspection submit `startups.techritual.com/submit` for indexing
- 如果有 backlinks 指 hkapp.techritual.com，301 redirect 自動 transfer link juice，但可以 manually outreach 大型來源更新

---

## Phase C — Future ideas（idle backlog）

- [ ] 個別 category landing pages：`/ai-tool/` / `/saas/` etc.（Astro `getStaticPaths`）
- [ ] Search box（純 client-side filter on existing data）
- [ ] Submitter testimonials carousel
- [ ] 「Editor's picks」每月 spotlight section
- [ ] 加 RSS feed `/rss.xml`（俾科技 aggregator）
- [ ] OG image auto-generate per category（用 Cloudflare Workers 做 image generation）
- [ ] AdSense placement A/B test（after 3 個月 baseline data）

---

## Cross-reference

- Astro repo: https://github.com/Stoneip/startup-techritual
- Backend (gmail-auto-techritual): https://github.com/Stoneip/Gmail-Auto-Techritual
- Dashboard (stoneip-dashboard): https://github.com/Stoneip/stoneip-dashboard-90866826
- Source form (current hkapp): `gmail-automation-cf/hkapp-form/index.html`
- DM template location: `stoneip-dashboard-/dashboard/js/pages/submissions.js` line ~73-91
- Backend CORS: `gmail-automation-cf/index.js` `submitArticle` + `subscribeNewsletter` handlers
