# 雅思复习 PWA

手机上背单词 + 刷错题的离线网页。数据来自 Notion（`deck.json`），复习进度存在本机浏览器，**不联网、不花 API 费用**。

## 部署到 GitHub Pages（5 分钟，只做一次）

1. 打开 <https://github.com/new>，Repository name 填 `ielts-card`，选 **Public**，点 Create。
2. 进入新仓库，点 **uploading an existing file**，把本文件夹里这几个文件拖进去：
   - `index.html`
   - `deck.json`
   - `manifest.webmanifest`
   - `sw.js`
   - `icon-192.png`
   - `icon-512.png`
   - `.nojekyll`（没有就跳过）
3. 点 **Commit changes**。
4. 仓库 `Settings` → 左侧 `Pages` → Source 选 **Deploy from a branch** → Branch 选 `main` / `(root)` → Save。
5. 等 1–2 分钟，页面顶部会出现网址：`https://<你的用户名>.github.io/ielts-card/`

## 装到 iPhone 主屏

1. 用 **Safari** 打开上面的网址（不要用微信打开）。
2. 点底部 **分享** → **添加到主屏幕** → 添加。
3. 之后从主屏图标进入，全屏、无地址栏，和 App 一样。

首次打开需要联网加载一次，之后 Service Worker 会缓存，**飞行模式也能背**。

## 每天怎么用

- 首页显示「今日待背」张数（默认 20，可在设置里改）
- 点卡片翻面 → 看释义、原文例句、搭配
- 三个按钮：**不会**（明天再来）/ **模糊**（保持间隔）/ **会了**（间隔 ×2）
- 背满 20 张，首页变成「今日已完成」，当天不再出题
- 「刷错题」是独立队列：先看题干，翻面看答案和当时错在哪，标「会了 / 还是错」

## 更新词库

我在本地跑 `python notion-kit/sync_deck.py` 重新生成 `deck.json`，然后：

**方法一（网页）**：仓库里点开 `deck.json` → 右上铅笔图标 → 全选删掉 → 粘贴新内容 → Commit。
**方法二（git）**：`git clone` 一次，之后 `copy deck.json` + `git commit + push`。

进度不会丢：进度在手机浏览器里，换 `deck.json` 不影响。

## 几个技术细节

- 发音用系统 TTS（iOS 的英文语音），不需要联网
- 间隔算法：不会 → 明天；模糊 → 按当前阶段；会了 → 1/2/4/7/15/30/60 天
- 进度导出：设置 → 导出进度 JSON（可发给我合回 Notion）
- 换手机/清缓存会丢进度，**建议每周导出一次**

## 文件说明

| 文件 | 作用 |
| --- | --- |
| `index.html` | 全部界面与逻辑（单文件） |
| `deck.json` | 词库快照，由 Notion 导出 |
| `sw.js` | 离线缓存 |
| `manifest.webmanifest` | 主屏图标与全屏配置 |
| `test_app.mjs` | 逻辑自测（`node test_app.mjs`） |
