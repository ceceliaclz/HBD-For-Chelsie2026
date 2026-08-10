# 我们的地图

一张给两个人共同点亮旅行足迹的暗夜地图。支持城市搜索、地图长按添加、兔子/小狗/一起三种足迹、标记套装、离线本地保存与 Supabase 云同步，并可作为 PWA 安装到手机桌面。

## 本地启动

环境要求：Node.js 24、npm。

```bash
npm install
cp .env.example .env.local
npm run dev
```

打开终端给出的本地地址。仅需体验单机功能时可以不配置 Supabase；地点会保存在浏览器 IndexedDB 中，但邀请、加入和跨设备同步不可用。

开发环境可在首页地址后添加 `#debug` 预览示例足迹，例如 `http://localhost:5173/#debug`。该入口不会进入生产构建。

## 配置 Supabase

1. 新建 Supabase 项目，在 SQL Editor 中完整执行 [`src/sync/schema.sql`](src/sync/schema.sql)。
2. 在 Project Settings → API 中找到 Project URL 与 anon/public key。
3. 新建 `.env.local`：

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

4. 重启 `npm run dev`。

Vite 会把 `VITE_*` 变量写入前端产物，切勿在这里放 service role key。当前 v1 没有正式账号体系，邀请码是共享入口；`schema.sql` 因此允许 anon 访问三张业务表。请勿用于存储敏感个人信息，公开上线前应评估更严格的鉴权和邀请码过期机制。

## 双人邀请流程

1. 第一位用户选择兔子或小狗，创建地图。
2. 在右上角设置中复制 6 位邀请码或邀请链接，发给另一半。
3. 对方打开链接（或进入“加入对方”手动输入邀请码），选择尚未占用的角色。
4. 加入后双方进入同一本地图；新增地点会先保存在本机，联网时同步。

同一角色不能被重复选择，每张地图最多两位成员。邀请与首次加入需要联网；离线时仍可查看、筛选和添加已有地图的足迹。

## 安装 PWA

- iPhone / iPad（Safari）：打开站点，点“分享” → “添加到主屏幕”。
- Android（Chrome）：打开站点，点右上角菜单 → “安装应用”或“添加到主屏幕”。

PWA 安装要求使用 HTTPS（`localhost` 开发环境除外）。若浏览器没有显示安装入口，先确认生产构建中的 manifest、service worker 和图标均可访问。

## 构建与部署

```bash
npm test
npm run build
npm run preview
```

可将 `dist/` 部署到任意 HTTPS 静态托管平台。部署前检查：

- [ ] 在生产环境配置 `VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY`
- [ ] 执行 `src/sync/schema.sql`，确认三张表与策略创建成功
- [ ] 配置 SPA fallback，将 `/join/*` 回退到 `index.html`
- [ ] `npm test` 与 `npm run build` 通过
- [ ] 用真实手机验证 PWA 安装、离线启动和恢复联网同步
- [ ] 用两个独立浏览器/设备走通创建、邀请、角色占用和双方加点
- [ ] 检查生产域名生成的邀请链接可以直接打开

