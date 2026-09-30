# Cloudflare D1 SQLite 数据库配置指南

本项目已完全支持 Cloudflare 原生 D1 SQLite 数据库，并已经绑定您的数据库 ID：
`0f431065-816e-41e4-b428-43d59ac1a090`

---

## 步骤 1：在 Cloudflare Dashboard 中导入数据结构与初始用户

1. 打开 [Cloudflare 控制台](https://dash.cloudflare.com/)；
2. 左侧菜单进入 **Workers 和 Pages** -> **D1 SQL 数据库**；
3. 点击进入您的数据库（ID: `0f431065-816e-41e4-b428-43d59ac1a090`）；
4. 点击顶部的 **控制台 (Console)** 标签页；
5. 将 `d1/schema.sql` 中的全部 SQL 内容复制并粘贴到输入框中；
6. 点击 **执行 (Execute)** 按钮。

执行成功后，数据库将自动完成：
- 所有数据表创建（用户表、会话表、权限表、实盘与回测隔离交易表、审计日志等）；
- 初始化真实管理员账号：
  - **用户名**：`lebin26`
  - **初始密码**：`12141214@Aa`
  - **角色**：`admin`
  - **套餐**：`pro`

---

## 步骤 2：确认 Cloudflare Pages 数据库绑定

根目录下的 `wrangler.toml` 已经预设了绑定：
```toml
[[d1_databases]]
binding = "DB"
database_name = "veyra-db"
database_id = "0f431065-816e-41e4-b428-43d59ac1a090"
```

如果您是在 Cloudflare Pages 控制台中设置，请确认：
1. 进入您的 Pages 项目（例如 `veyra`）-> **设置 (Settings)** -> **函数 (Functions)**；
2. 找到 **D1 数据库绑定 (D1 database bindings)**；
3. 点击 **添加绑定 (Add binding)**：
   - **变量名称 (Variable name)**: `DB`
   - **D1 数据库 (D1 database)**: 选择您的数据库（`0f431065-816e-41e4-b428-43d59ac1a090`）
4. 保存即可。
