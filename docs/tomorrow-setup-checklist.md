# 明天待办：云同步 + 上线（不用开电脑）

日期目标：2026-08-13

## 问题 1：配 Supabase（双人同步）

1. 打开 https://supabase.com → 登录 → New project  
2. SQL Editor 执行：`src/sync/schema.sql`（全文）  
3. Project Settings → API，复制：
   - Project URL（`https://xxxx.supabase.co`）
   - anon public key  
4. 在项目根目录写 `.env.local`：

```dotenv
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=你的anon密钥
```

5. 重启 `npm run dev`，用两个浏览器验证：创建地图 → 复制邀请码 → 另一边加入 → 双方加点能同步  

完成后可在对话里把 URL + anon key 发给我，我帮你写 `.env.local` 并验收。

## 问题 2：部署前端（手机随时打开，电脑可关机）

目标：得到一个 `https://...` 网址，手机收藏/加到主屏幕即可。

推荐（任选其一）：

- **Vercel**：导入 GitHub 仓库 `ceceliaclz/travel-itinerary-app`，分支 `feat/couple-travel-map`（或合并后的 main）  
- 环境变量填上与 `.env.local` 相同的两个 `VITE_*`  
- 构建命令默认 `npm run build`，输出 `dist`  
- 确认 SPA 回退：`/join/*` → `index.html`  

部署后检查：

- [ ] 手机用 https 打开站点正常  
- [ ] 创建/邀请/加入走通  
- [ ] Safari/Chrome「添加到主屏幕」可用  
- [ ] 电脑关机后手机仍能打开  

## 建议顺序

先做问题 1（Supabase）→ 再部署（问题 2 要用到同样的环境变量）。
