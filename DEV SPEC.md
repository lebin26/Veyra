如果你是要把 `README.md` 当成 **Vibe Coding 项目的“AI 开发规范 / 总规则文件”**，建议不要把它写成普通项目介绍，而是写成一份 **AI Agent Development Contract（AI 开发契约）**。

核心原则：

* **README 可以告诉 AI：项目怎么做**
* **README 不应该告诉 AI：你的秘密是什么**
* **所有敏感资料都必须通过环境变量 / Secret 管理**
* **AI 修改代码前必须理解现有架构**
* **禁止 AI 擅自改变技术栈、数据库结构、API 契约**
* **每次修改必须可追踪、可回滚**

下面这份可以直接作为你的通用模板。

# AI Vibe Coding Development Specification

> 本文件是本项目提供给 AI Coding Agent 的最高级开发规范之一。
> AI 在修改、创建、删除或重构代码前，必须先阅读并遵守本文件。

---

# 1. Project Rules

## 1.1 AI 必须遵守

AI 在执行任何开发任务时：

1. 必须先理解现有项目结构。
2. 必须优先复用现有代码、组件、工具函数和数据库结构。
3. 不得无理由重写现有功能。
4. 不得无理由更换技术栈。
5. 不得删除现有功能，除非用户明确要求。
6. 不得修改数据库结构，除非用户明确要求。
7. 不得修改 API Contract，除非用户明确要求。
8. 不得修改认证、权限、安全机制，除非用户明确要求。
9. 不得为了“优化代码”而进行大范围重构。
10. 不得创建重复功能或重复组件。
11. 不得生成无法维护的大型单文件代码。
12. 必须保持现有 UI/UX 风格一致。
13. 必须考虑已有数据的兼容性。
14. 必须考虑错误处理。
15. 必须考虑 Loading、Empty、Error 状态。
16. 必须避免引入不必要的依赖。

---

# 2. Development Philosophy

本项目采用 Vibe Coding + AI Agent 开发模式。

AI 不是单纯的代码生成器，而是项目开发助手。

AI 必须遵循：

> Understand → Plan → Implement → Verify → Report

执行流程：

1. Understand

   * 阅读相关文件
   * 理解现有架构
   * 找到数据流
   * 找到相关组件
   * 找到相关 API
   * 找到相关数据库表

2. Plan

   * 明确需要修改哪些文件
   * 明确修改原因
   * 判断是否会影响其他功能

3. Implement

   * 最小范围修改
   * 优先复用现有代码
   * 保持项目结构稳定

4. Verify

   * 检查语法
   * 检查 TypeScript / JavaScript 错误
   * 检查 API
   * 检查数据库操作
   * 检查 UI
   * 检查相关功能是否受到影响

5. Report

   * 汇报修改了什么
   * 汇报修改了哪些文件
   * 汇报测试结果
   * 汇报剩余问题

---

# 3. Information Classification

所有项目资料必须按照以下等级处理。

## PUBLIC

可以出现在：

* README
* 前端代码
* GitHub Repository
* 文档
* UI
* Public API

例如：

* 项目名称
* 功能说明
* UI 规范
* 技术栈名称
* 非敏感配置
* 开源依赖

---

## INTERNAL

只能用于项目开发，不应主动公开。

例如：

* 内部架构说明
* 数据库结构说明
* 内部 API 设计
* 内部业务逻辑
* 开发流程
* 内部命名规则

如果项目 Repository 是 Public，这些内容必须谨慎处理。

---

## CONFIDENTIAL

禁止写入公开 Repository。

例如：

* API Key
* Access Token
* Secret Key
* JWT Secret
* Database Password
* Cloudflare Secret
* OAuth Client Secret
* Webhook Secret
* Encryption Key
* Private credentials
* 第三方服务认证信息
* 私人服务器地址
* 私有 API Endpoint
* 用户个人资料
* 真实账号资料

---

## NEVER COMMIT

以下内容绝对不能提交到 Git：

```text
.env
.env.*
*.key
*.pem
*.p12
*.pfx
credentials.json
service-account.json
secrets.json
token.json
private-key.*
```

除非明确要求，否则 AI 不得创建、修改或提交真实 Secret。

---

# 4. Secrets Management

任何 Secret 必须通过环境变量或 Secret Manager 提供。

错误做法：

```javascript
const API_KEY = "xxxxxxxxxxxxxxxx";
```

正确做法：

```javascript
const API_KEY = process.env.API_KEY;
```

前端项目必须特别注意：

> 前端代码中的环境变量不等于 Secret。

任何最终发送到 Browser 的变量，都必须视为 PUBLIC。

因此：

* API Key 如果必须保密，不得直接放在前端。
* Secret API 必须通过 Backend / Worker / Server API 调用。
* Database credential 不得暴露给 Browser。
* Private token 不得暴露给 Client。

---

# 5. Git Security Rules

AI 禁止：

* 提交 `.env`
* 提交 API Key
* 提交 Password
* 提交 Token
* 提交 Private Key
* 提交真实用户资料
* 提交生产数据库备份
* 提交包含 Secret 的日志
* 提交真实认证 Cookie
* 提交浏览器 Session
* 提交 SSH Key

AI 修改 `.gitignore` 时必须确保敏感文件仍然被排除。

---

# 6. User Data Protection

AI 不得在代码、日志、README、测试数据中硬编码真实用户资料。

包括：

* 姓名
* 电话
* Email
* 地址
* 身份证号码
* 银行资料
* 支付资料
* 账户号码
* Authentication Token
* Session Token
* 私人文件

开发测试必须使用：

```text
dummy@example.com
Test User
TEST_ACCOUNT
TEST_DATA
```

等假数据。

---

# 7. Database Rules

数据库属于核心基础设施。

AI 修改数据库前必须：

1. 检查现有 Schema。
2. 检查相关 API。
3. 检查现有数据。
4. 检查 Foreign Key。
5. 检查 Index。
6. 检查 Migration。
7. 考虑旧数据兼容性。

禁止：

* 随意删除 Column
* 随意删除 Table
* 随意改变 Column Type
* 随意改变 Primary Key
* 随意改变 Foreign Key
* 删除生产数据
* 清空数据库

如果必须进行破坏性数据库修改，必须明确说明：

```text
BREAKING DATABASE CHANGE
```

并解释：

* 修改内容
* 影响范围
* 数据迁移方式
* 回滚方式

---

# 8. API Rules

修改 API 时必须保持：

```text
Request
↓
Validation
↓
Business Logic
↓
Database
↓
Response
```

API 必须考虑：

* Authentication
* Authorization
* Input Validation
* Error Handling
* HTTP Status
* Response Format
* Rate Limiting（如适用）
* Logging（不得记录 Secret）

不得因为修改前端 UI 而随意修改后端 API。

---

# 9. Frontend Rules

前端开发必须保持：

* Responsive Design
* Accessibility
* Loading State
* Empty State
* Error State
* Success State
* Mobile Compatibility
* Desktop Compatibility

UI 修改必须优先复用：

* Existing Components
* Existing CSS
* Existing Design Tokens
* Existing Utility Functions

禁止为了一个小功能创建一套完全不同的 UI 风格。

---

# 10. Component Rules

创建 Component 前必须检查项目中是否已经存在类似 Component。

优先：

```text
Reuse existing component
        ↓
Extend existing component
        ↓
Create new component
```

而不是：

```text
Create duplicate component
```

组件必须尽可能做到：

* Single Responsibility
* Reusable
* Predictable
* Easy to maintain

---

# 11. Code Quality

代码必须：

* 易读
* 易维护
* 清晰命名
* 避免重复
* 避免过度抽象
* 避免不必要的复杂度

禁止：

```text
Huge functions
Huge components
Duplicate logic
Dead code
Unused imports
Unused variables
Hardcoded secrets
Magic numbers
```

---

# 12. Error Handling

任何可能失败的操作都必须考虑错误处理。

例如：

```text
API Request
Database Query
Authentication
File Upload
External Service
User Input
Network Request
```

错误信息必须：

* 对用户：友好
* 对开发者：足够诊断
* 对攻击者：不泄露内部信息

禁止向用户暴露：

```text
Database credentials
Stack traces
Secret values
Internal filesystem paths
Private API information
```

---

# 13. Dependency Rules

添加新的 npm / pip / library / package 前必须判断：

1. 现有项目是否已经有类似功能。
2. 是否可以使用原生功能。
3. 是否真的需要新依赖。
4. 依赖是否仍在维护。
5. 是否会增加 Bundle Size。
6. 是否存在安全风险。

不要为了简单功能引入大型依赖。

---

# 14. File Modification Rules

AI 修改文件时：

### 可以

* 修改与任务直接相关的文件
* 修复必要的相关 Bug
* 添加必要的测试
* 添加必要的类型定义

### 不可以

* 无理由格式化整个项目
* 无理由重命名大量文件
* 无理由改变目录结构
* 无理由升级所有 dependencies
* 无理由重构整个项目
* 删除“看起来没用”的代码

---

# 15. Before Editing

执行任务前必须回答：

```text
What is the requested change?

Which files are relevant?

What existing code handles this functionality?

What dependencies exist?

Will this change affect database/API/authentication?

Will this change break existing functionality?
```

如果任务范围不明确：

> 不得自行扩大任务范围。

---

# 16. After Editing

完成修改后必须检查：

```text
[ ] Syntax
[ ] Type errors
[ ] Runtime errors
[ ] API errors
[ ] Database errors
[ ] UI errors
[ ] Existing functionality
[ ] Responsive layout
[ ] Authentication
[ ] Authorization
[ ] Security
```

---

# 17. Testing Rules

新增功能至少需要考虑：

### Normal Case

正常输入是否工作。

### Empty Case

没有数据时是否正常。

### Error Case

错误输入是否正常处理。

### Edge Case

极端数据是否正常。

### Permission Case

不同权限是否能够正确访问。

---

# 18. AI Must Not Guess

如果代码中存在不确定信息：

AI 不得：

* 猜 API Endpoint
* 猜 Database Schema
* 猜 Environment Variable
* 猜 Authentication Flow
* 猜 Business Rule
* 猜用户数据
* 猜第三方服务配置

必须优先检查项目现有代码和配置。

如果仍然无法确认，应明确标记：

```text
UNKNOWN
```

而不是编造。

---

# 19. Existing Architecture Has Priority

如果当前项目已经存在某种实现方式：

> Existing Architecture > AI Preference

AI 不得因为自己“认为另一种方式更好”而自动改变架构。

例如：

如果项目使用：

```text
Cloudflare Workers
SQLite
Vanilla JavaScript
```

AI 不得因为个人偏好自动改成：

```text
Node.js
PostgreSQL
React
```

除非用户明确要求。

---

# 20. Change Scope

每次任务必须遵循：

```text
Smallest Safe Change
```

优先：

```text
1 feature
→ minimum files
→ minimum code changes
→ minimum risk
```

避免：

```text
1 feature
→ rewrite architecture
→ modify unrelated files
→ introduce new dependencies
```

---

# 21. Breaking Changes

以下属于 Breaking Change：

* API Response 改变
* API Request 改变
* Database Schema 改变
* Authentication 改变
* Permission 改变
* Environment Variable 改变
* URL / Route 改变
* Existing Component API 改变

如果发生 Breaking Change，必须明确标记。

---

# 22. Environment Variables

Environment Variables 必须区分：

```text
PUBLIC
PRIVATE
SECRET
```

示例：

```env
PUBLIC_APP_NAME=
PUBLIC_API_URL=

DATABASE_URL=
API_SECRET=
JWT_SECRET=
```

实际 Secret 不得写入 README。

README 只允许记录：

```text
Variable Name
Purpose
Required / Optional
Example Format
```

例如：

```text
API_SECRET
Purpose: Server-side API authentication
Required: Yes
Example: <secret>
```

---

# 23. Logging Rules

日志不得包含：

* Password
* Token
* API Key
* Cookie
* Session
* Credit Card
* Bank Account
* Personal Identity Information

允许：

```text
Request ID
Error Code
Timestamp
Operation Name
Non-sensitive User ID
```

---

# 24. Authentication & Authorization

AI 不得降低权限要求。

禁止：

```text
Remove authentication
Disable authorization
Allow unrestricted admin access
Expose admin API
Expose private database
```

任何权限相关修改必须明确说明影响范围。

---

# 25. Admin Rules

Admin 功能必须与普通 User 权限明确区分。

必须检查：

```text
Authentication
+
Authorization
+
Role
+
Resource Ownership
```

不能仅依赖前端隐藏按钮来保护 Admin 功能。

错误：

```javascript
if (isAdmin) {
    showAdminButton();
}
```

这只能控制 UI。

真正权限必须在 Server / API 层验证。

---

# 26. Security Priority

安全优先级：

```text
Authentication
Authorization
Data Protection
Input Validation
Secret Protection
Database Security
API Security
Frontend Security
```

如果发现明显安全问题，即使用户当前任务与安全无关，也必须指出。

但是：

> 不得擅自扩大修改范围。

---

# 27. Performance

优化必须建立在实际问题基础上。

禁止为了“感觉更快”而：

* 添加复杂缓存
* 添加大型依赖
* 重写架构
* 增加复杂状态管理
* 增加数据库索引
* 添加复杂后台任务

除非存在明确的性能问题或用户明确要求。

---

# 28. Documentation

重要架构、API、数据库和部署规则必须有文档。

至少应该说明：

```text
Project Architecture
Environment Variables
Database
API
Authentication
Deployment
Development
Testing
Known Limitations
```

但是：

> 文档不得包含真实 Secret。

---

# 29. Git Commit Rules

Commit 应该做到：

```text
Small
Focused
Descriptive
Reversible
```

推荐：

```text
feat: add monthly financial summary
fix: resolve transaction calculation error
refactor: simplify dashboard data loader
docs: update deployment instructions
```

避免：

```text
update
fix
test
changes
final
new version
```

---

# 30. AI Response Format

完成任务后，AI 应使用以下格式汇报：

```text
## Summary

What was changed.

## Files Changed

- file/path
- file/path

## Implementation

Short explanation of the implementation.

## Verification

- Syntax: PASS / FAIL
- Build: PASS / FAIL
- Tests: PASS / FAIL
- Database: PASS / FAIL
- API: PASS / FAIL

## Risks

Known risks or limitations.

## Security

Whether secrets / authentication / permissions were affected.

## Breaking Changes

YES / NO

If YES:
Explain the impact.
```

---

# 31. Forbidden Actions

除非用户明确要求，AI 不得：

* 删除数据库
* 清空数据库
* 删除 Git History
* Force Push
* 修改 Production Data
* 暴露 Secret
* 绕过 Authentication
* 绕过 Authorization
* 删除 Security Controls
* 修改 Production Configuration
* 更换核心技术栈
* 大规模重构
* 删除现有功能
* 提交 `.env`
* 提交 Private Key
* 提交真实用户数据

---

# 32. Sensitive Information Policy

以下信息永远不应该出现在公开 README：

```text
API Keys
Passwords
Tokens
Private Keys
Database Credentials
OAuth Secrets
Webhook Secrets
JWT Secrets
Encryption Keys
Cloud Provider Credentials
GitHub Tokens
SSH Keys
Production Credentials
Real User Data
Personal Financial Data
Private Addresses
Private Emails
Internal Security Configuration
```

README 可以写：

```text
DATABASE_URL is required.
API_SECRET is required.
```

但不能写：

```text
DATABASE_URL=actual-production-password
API_SECRET=actual-secret
```

---

# 33. Public Repository Rule

如果 Repository 是 Public：

默认假设：

> 所有提交到 Repository 的内容最终都可能被任何人看到。

因此：

```text
Frontend Code = Public
README = Public
Git History = Potentially Public
Build Output = Potentially Public
Client-side Environment Variables = Public
```

不要把“隐藏在前端代码里”当作安全措施。

---

# 34. AI Instruction Priority

当规则发生冲突时：

```text
User's Explicit Requirement
        ↓
Security Requirements
        ↓
Existing Architecture
        ↓
This README
        ↓
AI Preference
```

AI 的个人偏好不得覆盖项目现有规则。

---

# 35. Golden Rule

开发任何功能前：

> Understand the existing system before changing it.

开发任何功能时：

> Make the smallest safe change.

处理任何 Secret 时：

> Never hardcode secrets.

修改任何数据库时：

> Protect existing data.

修改任何权限时：

> Never weaken security.

完成任何任务后：

> Verify before reporting completion.

---

# 36. Final AI Rule

如果一个操作可能：

* 泄露数据
* 泄露 Secret
* 删除数据
* 降低安全性
* 破坏现有功能
* 修改生产环境
* 产生 Breaking Change

AI 必须先停止自动执行，并明确说明风险以及需要确认的内容。

不要猜测。

不要隐藏问题。

不要为了完成任务而牺牲安全性。

---

# END OF AI DEVELOPMENT SPECIFICATION
