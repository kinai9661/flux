# 🚀 FLUX.2 部署指南

本项目使用纯 Cloudflare Worker.js 方案，部署简单快速。

## 📋 前置要求

1. **Cloudflare 账号**
   - 注册地址：https://dash.cloudflare.com/sign-up
   - 需要验证邮箱

2. **Node.js 和 npm**
   - Node.js 18+ 版本
   - 检查版本：`node -v` 和 `npm -v`

3. **Wrangler CLI**
   ```bash
   npm install -g wrangler
   ```

## 🎯 快速部署（3 步）

### 步骤 1: 克隆仓库

```bash
git clone https://github.com/kinai9661/flux.git
cd flux
```

### 步骤 2: 登录 Cloudflare

```bash
wrangler login
```

这会打开浏览器进行授权，完成后终端会显示登录成功。

### 步骤 3: 部署到 Workers

```bash
wrangler deploy
```

✅ 部署成功后会显示类似：
```
Total Upload: 22.45 KiB / gzip: 6.82 KiB
Your worker has been deployed to:
  https://flux.your-subdomain.workers.dev
```

## 🌐 访问您的应用

部署成功后，访问显示的 URL，例如：
- https://flux-2-ai-generator.your-subdomain.workers.dev

## ⚙️ 自定义配置

### 修改项目名称

编辑 `wrangler.toml`：

```toml
name = "your-custom-name"  # 修改这里
main = "Worker.js"
compatibility_date = "2025-12-06"
workers_dev = true

[ai]
binding = "AI"
```

### 绑定自定义域名

1. **在 Cloudflare 添加域名**
   - 登录 Cloudflare Dashboard
   - 添加您的域名
   - 更新 DNS 到 Cloudflare

2. **配置路由**

编辑 `wrangler.toml`：

```toml
name = "flux-production"
main = "Worker.js"
compatibility_date = "2025-12-06"

[ai]
binding = "AI"

# 生产环境配置
route = { pattern = "flux.yourdomain.com/*", zone_name = "yourdomain.com" }
```

3. **重新部署**

```bash
wrangler deploy
```

## 🔍 常用命令

### 查看实时日志

```bash
wrangler tail
```

按 `Ctrl+C` 退出。

### 本地开发测试

```bash
wrangler dev
```

会在本地启动开发服务器，通常是 `http://localhost:8787`

### 查看部署列表

```bash
wrangler deployments list
```

### 删除部署

```bash
wrangler delete
```

## 🐛 故障排除

### 问题 1: AI binding 错误

**错误信息：**
```
Error: AI binding not found
```

**解决方法：**

确保 `wrangler.toml` 中有 AI binding 配置：
```toml
[ai]
binding = "AI"
```

### 问题 2: 权限错误

**错误信息：**
```
Permission denied
```

**解决方法：**

重新登录 Cloudflare：
```bash
wrangler logout
wrangler login
```

### 问题 3: 部署超时

**解决方法：**

1. 检查网络连接
2. 重试部署：`wrangler deploy`
3. 如果持续失败，检查 Cloudflare 状态页：https://www.cloudflarestatus.com

### 问题 4: 找不到 Worker.js

**错误信息：**
```
Error: Could not find Worker.js
```

**解决方法：**

确保在项目根目录运行命令，并且 `Worker.js` 文件存在：
```bash
ls -la Worker.js
```

## 📊 性能优化建议

### 1. 启用缓存

已在 Worker.js 中配置：
```javascript
headers: {
  'Cache-Control': 'public, max-age=3600',
}
```

### 2. 使用 KV 存储历史

添加 KV namespace：

```toml
[[kv_namespaces]]
binding = "IMAGE_CACHE"
id = "your-kv-id"
```

在 Cloudflare Dashboard 创建 KV namespace 后获取 ID。

### 3. 限流配置

添加到 `wrangler.toml`：

```toml
[limits]
requests_per_minute = 60
```

## 💰 成本估算

### Free Plan（免费计划）
- ✅ 100,000 请求/天
- ✅ Workers AI 每日免费额度
- ✅ 无限制的静态文件服务

### Paid Plan（付费计划）
- $5/月起
- 1000万 请求/月
- Workers AI 超出部分按需计费

💡 **提示**：FLUX.2 [dev] 模型较慢，Cloudflare 预计会降价。

## 🔒 安全建议

### 1. 添加请求认证（可选）

在 Worker.js 中添加：

```javascript
const API_KEY = env.API_KEY; // 从环境变量读取

if (request.headers.get('Authorization') !== `Bearer ${API_KEY}`) {
  return new Response('Unauthorized', { status: 401 });
}
```

配置环境变量：
```bash
wrangler secret put API_KEY
```

### 2. CORS 限制

修改 Worker.js 中的 `corsHeaders()`：

```javascript
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': 'https://yourdomain.com', // 指定域名
    'Access-Control-Allow-Methods': 'POST',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
}
```

## 📱 测试部署

### 使用 curl 测试

```bash
curl -X POST https://your-worker.workers.dev/api/generate \
  -F "prompt=A cute cat with rainbow colors" \
  -F "width=1024" \
  -F "height=1024" \
  -o test-image.png
```

检查生成的图片：
```bash
open test-image.png  # macOS
xdg-open test-image.png  # Linux
start test-image.png  # Windows
```

### 使用浏览器测试

直接访问部署的 URL，会看到完整的 Web UI 界面。

## 📚 更多资源

- [Cloudflare Workers 文档](https://developers.cloudflare.com/workers/)
- [Workers AI 文档](https://developers.cloudflare.com/workers-ai/)
- [FLUX.2 模型文档](https://developers.cloudflare.com/workers-ai/models/flux-2-dev/)
- [Wrangler CLI 文档](https://developers.cloudflare.com/workers/wrangler/)

## 🎉 完成！

现在您的 FLUX.2 图像生成器已经成功部署到全球边缘网络！

如有问题，请在 GitHub 提交 Issue：
https://github.com/kinai9661/flux/issues

---

**Happy Generating! 🎨✨**