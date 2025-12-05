# 🎨 FLUX.2 [dev] 智能图像生成器

基于 Cloudflare Workers AI 的高性能 FLUX.2 [dev] 模型图像生成服务，提供完整的 Web UI 和 RESTful API。

## ✨ 核心特性

### 🖼️ 五大生成模式

**1. 基础文本生成**
- 简单文本描述即可生成高质量图像
- 支持中文、英文等多语言提示词
- 可调节宽度、高度、steps、guidance 等参数

**2. 多图参考生成 (Multi-Reference)**
- 最多支持 4 张参考图像（512×512）
- 自然语言引用图像：`image 0`, `image 1`, `image 2`, `image 3`
- 应用场景：
  - 角色一致性生成
  - 风格融合
  - 场景组合

**3. JSON 精细控制**
- 使用结构化 JSON 定义图像的每个细节
- 支持设置：场景、主体、风格、色板、光照、镜头参数、特效
- 适合专业创作和精确控制需求

**4. 风格迁移 (Style Transfer)**
- 将一张图的艺术风格应用到另一张图上
- 保持内容主体，改变视觉风格
- 适合艺术创作、滤镜效果

**5. 产品拍摄 (Product Shot)**
- 保持产品一致性，改变背景环境
- 预设多种环境：办公桌、海滩、奢华展示、太空、咖啡馆
- 适合电商、广告、产品展示

## 🚀 技术架构

### 技术栈
- **运行环境**: Cloudflare Workers（Edge Runtime）
- **AI 模型**: `@cf/black-forest-labs/flux-2-dev`
- **前端**: 原生 HTML5 + Vanilla JavaScript
- **API 格式**: multipart/form-data
- **部署**: 一键部署到 Cloudflare Workers

### 架构优势
- ⚡ **全球边缘加速**: Cloudflare 全球节点，低延迟响应
- 💰 **成本优化**: 按需付费，无服务器架构
- 🔒 **安全可靠**: 内置 CORS 支持，完善的错误处理
- 📱 **响应式设计**: 支持桌面和移动设备

## 📡 API 端点

### API 列表

| 端点 | 方法 | 功能 |
|------|------|------|
| `/` | GET | Web UI 界面 |
| `/api/generate` | POST | 基础文本生成 |
| `/api/multi-reference` | POST | 多图参考生成 |
| `/api/json-prompt` | POST | JSON 精细控制 |
| `/api/style-transfer` | POST | 风格迁移 |
| `/api/product-shot` | POST | 产品拍摄 |
| `/health` | GET | 健康检查 |

### API 调用示例

#### 基础生成
```bash
curl -X POST https://your-worker.workers.dev/api/generate \
  -F "prompt=A futuristic cyberpunk cityscape" \
  -F "width=1024" \
  -F "height=1024" \
  -F "steps=20" \
  -F "guidance=7.5"
```

#### 多图参考
```bash
curl -X POST https://your-worker.workers.dev/api/multi-reference \
  -F "prompt=take the subject of image 1 and style it like image 0" \
  -F "input_image_0=@style.png" \
  -F "input_image_1=@content.png"
```

#### JSON 控制
```bash
curl -X POST https://your-worker.workers.dev/api/json-prompt \
  -F 'json_prompt={"scene":"Futuristic city","subjects":[{"type":"Cyberpunk character"}],"style":"neon noir"}' \
  -F "steps=30"
```

## 🛠️ 部署指南

### 前置要求
- Cloudflare 账号
- Wrangler CLI 工具

### 部署步骤

```bash
# 1. 克隆仓库
git clone https://github.com/kinai9661/flux.git
cd flux

# 2. 安装 Wrangler (如未安装)
npm install -g wrangler

# 3. 登录 Cloudflare
wrangler login

# 4. 创建 wrangler.toml 配置文件
cat > wrangler.toml << EOF
name = "flux2-image-generator"
main = "Worker.js"
compatibility_date = "2025-12-06"
workers_dev = true

[ai]
binding = "AI"
EOF

# 5. 部署到 Workers
wrangler deploy

# 6. 查看实时日志
wrangler tail
```

### 配置说明

创建 `wrangler.toml` 文件：

```toml
name = "flux2-image-generator"
main = "Worker.js"
compatibility_date = "2025-12-06"
workers_dev = true

[ai]
binding = "AI"

# 生产环境配置（可选）
[[env.production]]
name = "flux2-prod"
route = { pattern = "yourdomain.com/*", zone_name = "yourdomain.com" }
```

## 🎯 使用场景

### 创意设计
- 概念艺术创作
- 角色设计与一致性保持
- 场景设计与变体生成

### 电商与营销
- 产品展示图生成
- 多场景产品拍摄
- 广告素材创作

### 开发集成
- API 集成到现有应用
- 批量图像生成
- 自动化内容生成

## 💡 高级特性

### Hex 颜色精确控制
直接在提示词中使用十六进制颜色代码：
```
"背景使用 #F48120 橙色光效和 #667eea 紫色渐变"
```

### 多语言支持
原生支持中文、英文等多种语言提示词，无需翻译。

### 智能参数优化
自动根据图像尺寸调整生成参数，确保最佳效果。

## 📊 性能与限制

- **最大分辨率**: 2048×2048（推荐 1024×1024）
- **参考图像**: 最多 4 张，每张 512×512
- **生成时间**: 通常 10-30 秒（取决于复杂度）
- **缓存策略**: 生成图像缓存 1 小时

## 📖 JSON 提示词示例

```json
{
  "scene": "A neon-lit futuristic street market on an alien planet",
  "subjects": [
    {
      "type": "Cyberpunk character",
      "description": "Female with black armor and glowing blue trim",
      "pose": "Standing confidently",
      "position": "foreground"
    }
  ],
  "style": "noir sci-fi digital painting",
  "color_palette": ["deep indigo", "electric blue", "#F48120"],
  "lighting": "dramatic neon reflections",
  "mood": "Gritty and atmospheric",
  "composition": "dynamic off-center",
  "camera": {
    "angle": "eye level",
    "lens": "35mm",
    "f-number": "f/1.4"
  },
  "effects": ["film grain", "neon glow"]
}
```

## 🔗 相关资源

- [Cloudflare Workers AI 文档](https://developers.cloudflare.com/workers-ai/)
- [FLUX.2 模型介绍](https://developers.cloudflare.com/workers-ai/models/flux-2-dev/)
- [FLUX.2 发布公告](https://developers.cloudflare.com/changelog/2025-11-25-flux-2-dev-workers-ai/)
- [Black Forest Labs 官方](https://blackforestlabs.ai/)

## 📝 文件结构

```
flux/
├── Worker.js          # 主要 Worker 代码
├── wrangler.toml      # Cloudflare Workers 配置
└── README.md          # 项目文档
```

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

### 开发建议
1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 📄 许可证

本项目采用 MIT 许可证。

## 🎉 快速开始

部署后访问 `https://your-worker.workers.dev/` 立即体验！

---

**Made with ❤️ by kinai9661**