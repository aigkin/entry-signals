# 买点观察

关注标的的价格位置、趋势结构和研究依据。当前版本为线上 v38，对应源提交 `47241f4ddfd6731de4932e60778a47a28f1cfa8b`。

## 功能
- 缓存列表先显示、后台更新行情。
- SMA50 规则参考区间与距离；到价、接近、观察三个价格状态。
- 持仓标记与筛选，仅存各自浏览器。
- 标的详情：趋势、量能、财务、事件、走势及来源。
- 人工研究记录，公开只读，保存需要所有者授权。

## 源码入口
- `dist/index.html` / `dist/watch.js` / `dist/theme.css`：首页和详情。
- `dist/watch-model.js` / `dist/engine.js`：规则计算。
- `watchlist.mjs` / `storage.mjs` / `research.mjs`：服务端数据。
- `drizzle/`：D1 数据库迁移。
- `tests/`：自动测试；`docs/`：实现和数据口径说明。

## 验证
使用 Node.js 22.16 或兼容的新版本：

```sh
node --test tests/*.test.*
```

## 独立部署
本仓库不包含生产数据库、发布凭证或原站点绑定。请先配置自己的 `.openai/hosting.json`（自己的 Sites project_id 与 `DB` D1 绑定），再运行 `node build.mjs`。完整接口需要 Cloudflare Worker 与 D1 环境，直接打开 HTML 无法获得完整行情。

保存研究前，必须在服务端运行环境配置 `RESEARCH_OWNER_EMAIL` 为所有者邮箱；不配置时默认拒绝所有写入。该值通过 Worker 环境变量传入，不写进源码或提交历史。身份来自 Sites 提供的可信请求头，并保留服务端写入校验。

“到价”仅表示达到实验规则的价格范围，不代表已确认买点。新增指标没有自动改变买点条件，阈值尚未经过完整样本外验证。
