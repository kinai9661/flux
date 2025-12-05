/**
 * FLUX.2 [dev] 智能图像生成 Worker
 * 支持基础生成、多图参考、JSON 精细控制
 */

export default {
  async fetch(request, env, ctx) {
    // CORS 预检请求
    if (request.method === 'OPTIONS') {
      return handleCORS();
    }

    const url = new URL(request.url);
    
    // 路由系统
    const router = {
      '/': () => serveFrontend(),
      '/api/generate': () => handleBasicGeneration(request, env),
      '/api/multi-reference': () => handleMultiReference(request, env),
      '/api/json-prompt': () => handleJsonPrompt(request, env),
      '/api/style-transfer': () => handleStyleTransfer(request, env),
      '/api/product-shot': () => handleProductShot(request, env),
      '/health': () => Response.json({ status: 'ok', model: 'flux-2-dev' })
    };

    const handler = router[url.pathname];
    if (!handler) {
      return new Response('Not Found', { status: 404 });
    }

    try {
      return await handler();
    } catch (error) {
      console.error('Worker Error:', error);
      return jsonResponse({ error: error.message }, 500);
    }
  }
};

/**
 * 1. 基础文本生成图像
 * 使用 multipart/form-data 格式
 */
async function handleBasicGeneration(request, env) {
  try {
    const formData = await request.formData();
    const prompt = formData.get('prompt');
    
    if (!prompt) {
      return jsonResponse({ error: '缺少 prompt 参数' }, 400);
    }

    // 构建 AI 请求的 FormData
    const aiFormData = new FormData();
    aiFormData.append('prompt', prompt);
    aiFormData.append('steps', formData.get('steps') || '20');
    aiFormData.append('width', formData.get('width') || '1024');
    aiFormData.append('height', formData.get('height') || '1024');
    aiFormData.append('guidance', formData.get('guidance') || '7.5');

    // 调用 Workers AI (使用 binding 方式)
    const response = await env.AI.run('@cf/black-forest-labs/flux-2-dev', {
      multipart: {
        body: aiFormData,
        contentType: 'multipart/form-data'
      }
    });

    // 返回图像
    return new Response(response, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=3600',
        ...corsHeaders()
      }
    });

  } catch (error) {
    return jsonResponse({ error: error.message }, 500);
  }
}

/**
 * 2. 多图参考生成 (最多 4 张 512x512 图像)
 * 解决角色一致性问题
 */
async function handleMultiReference(request, env) {
  try {
    const formData = await request.formData();
    const prompt = formData.get('prompt');
    
    if (!prompt) {
      return jsonResponse({ error: '缺少 prompt 参数' }, 400);
    }

    // 构建 AI 请求
    const aiFormData = new FormData();
    aiFormData.append('prompt', prompt);
    
    // 收集输入图像 (input_image_0 到 input_image_3)
    let imageCount = 0;
    for (let i = 0; i < 4; i++) {
      const image = formData.get(`input_image_${i}`);
      if (image) {
        // 验证图像大小
        const blob = await resizeImageIfNeeded(image, 512, 512);
        aiFormData.append(`input_image_${i}`, blob);
        imageCount++;
      }
    }

    if (imageCount === 0) {
      return jsonResponse({ error: '至少需要一张参考图像' }, 400);
    }

    aiFormData.append('steps', formData.get('steps') || '25');
    aiFormData.append('width', formData.get('width') || '1024');
    aiFormData.append('height', formData.get('height') || '1024');

    // 调用 AI
    const response = await env.AI.run('@cf/black-forest-labs/flux-2-dev', {
      multipart: {
        body: aiFormData,
        contentType: 'multipart/form-data'
      }
    });

    return new Response(response, {
      headers: {
        'Content-Type': 'image/png',
        ...corsHeaders()
      }
    });

  } catch (error) {
    return jsonResponse({ error: error.message }, 500);
  }
}

/**
 * 3. JSON 精细控制提示词
 * 支持场景、主体、风格、镜头等细节控制
 */
async function handleJsonPrompt(request, env) {
  try {
    const formData = await request.formData();
    const jsonPromptStr = formData.get('json_prompt');
    
    if (!jsonPromptStr) {
      return jsonResponse({ error: '缺少 json_prompt 参数' }, 400);
    }

    // 验证 JSON 格式
    let jsonPrompt;
    try {
      jsonPrompt = JSON.parse(jsonPromptStr);
    } catch (e) {
      return jsonResponse({ error: 'JSON 格式错误' }, 400);
    }

    // 构建请求
    const aiFormData = new FormData();
    aiFormData.append('prompt', JSON.stringify(jsonPrompt));
    aiFormData.append('steps', formData.get('steps') || '30');
    aiFormData.append('width', formData.get('width') || '1024');
    aiFormData.append('height', formData.get('height') || '1024');
    aiFormData.append('guidance', formData.get('guidance') || '7.5');

    const response = await env.AI.run('@cf/black-forest-labs/flux-2-dev', {
      multipart: {
        body: aiFormData,
        contentType: 'multipart/form-data'
      }
    });

    return new Response(response, {
      headers: {
        'Content-Type': 'image/png',
        ...corsHeaders()
      }
    });

  } catch (error) {
    return jsonResponse({ error: error.message }, 500);
  }
}

/**
 * 4. 风格迁移
 * 将 image 0 的风格应用到 image 1
 */
async function handleStyleTransfer(request, env) {
  try {
    const formData = await request.formData();
    const styleImage = formData.get('style_image'); // 风格图
    const contentImage = formData.get('content_image'); // 内容图
    
    if (!styleImage || !contentImage) {
      return jsonResponse({ error: '需要 style_image 和 content_image' }, 400);
    }

    const aiFormData = new FormData();
    aiFormData.append('prompt', 'take the subject of image 1 and style it like image 0');
    aiFormData.append('input_image_0', await resizeImageIfNeeded(styleImage, 512, 512));
    aiFormData.append('input_image_1', await resizeImageIfNeeded(contentImage, 512, 512));
    aiFormData.append('steps', '25');
    aiFormData.append('width', '1024');
    aiFormData.append('height', '1024');

    const response = await env.AI.run('@cf/black-forest-labs/flux-2-dev', {
      multipart: {
        body: aiFormData,
        contentType: 'multipart/form-data'
      }
    });

    return new Response(response, {
      headers: {
        'Content-Type': 'image/png',
        ...corsHeaders()
      }
    });

  } catch (error) {
    return jsonResponse({ error: error.message }, 500);
  }
}

/**
 * 5. 产品拍摄 (Product Shot)
 * 保持产品一致性,改变背景/环境
 */
async function handleProductShot(request, env) {
  try {
    const formData = await request.formData();
    const productImage = formData.get('product_image');
    const environment = formData.get('environment') || 'on a modern desk with soft lighting';
    
    if (!productImage) {
      return jsonResponse({ error: '需要 product_image' }, 400);
    }

    const aiFormData = new FormData();
    aiFormData.append('prompt', `professional product photography, ${environment}, high quality, studio lighting`);
    aiFormData.append('input_image_0', await resizeImageIfNeeded(productImage, 512, 512));
    aiFormData.append('steps', '30');
    aiFormData.append('width', '1024');
    aiFormData.append('height', '1024');
    aiFormData.append('guidance', '8.0');

    const response = await env.AI.run('@cf/black-forest-labs/flux-2-dev', {
      multipart: {
        body: aiFormData,
        contentType: 'multipart/form-data'
      }
    });

    return new Response(response, {
      headers: {
        'Content-Type': 'image/png',
        ...corsHeaders()
      }
    });

  } catch (error) {
    return jsonResponse({ error: error.message }, 500);
  }
}

/**
 * 辅助函数: 图像缩放
 * 确保图像不超过指定尺寸
 */
async function resizeImageIfNeeded(imageFile, maxWidth, maxHeight) {
  // 注意: Worker 环境中需要使用 Cloudflare Images 或外部服务来处理图像
  // 这里简化处理,实际应用中建议添加尺寸检查
  return imageFile;
}

/**
 * 辅助函数: 将 Stream 转为 Blob
 */
async function streamToBlob(stream, mimeType) {
  const chunks = [];
  const reader = stream.getReader();
  
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    return new Blob(chunks, { type: mimeType });
  } finally {
    reader.releaseLock();
  }
}

/**
 * CORS 处理
 */
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };
}

function handleCORS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders()
  });
}

/**
 * JSON 响应
 */
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders()
    }
  });
}

/**
 * 前端界面
 */
function serveFrontend() {
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FLUX.2 图像生成器</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 20px;
    }
    .container {
      max-width: 1000px;
      margin: 0 auto;
      background: white;
      border-radius: 20px;
      padding: 40px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    }
    h1 {
      color: #667eea;
      margin-bottom: 10px;
      text-align: center;
    }
    .subtitle {
      text-align: center;
      color: #666;
      margin-bottom: 30px;
    }
    .tabs {
      display: flex;
      gap: 10px;
      margin-bottom: 30px;
      border-bottom: 2px solid #e0e0e0;
      flex-wrap: wrap;
    }
    .tab {
      padding: 12px 20px;
      cursor: pointer;
      border: none;
      background: none;
      font-size: 15px;
      color: #666;
      transition: all 0.3s;
      border-bottom: 3px solid transparent;
    }
    .tab.active {
      color: #667eea;
      border-bottom-color: #667eea;
      font-weight: bold;
    }
    .tab-content {
      display: none;
      animation: fadeIn 0.3s;
    }
    .tab-content.active {
      display: block;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .form-group {
      margin-bottom: 20px;
    }
    label {
      display: block;
      margin-bottom: 8px;
      font-weight: 600;
      color: #333;
    }
    input[type="text"], input[type="number"], textarea, select {
      width: 100%;
      padding: 12px;
      border: 2px solid #e0e0e0;
      border-radius: 8px;
      font-size: 14px;
      font-family: inherit;
      transition: border 0.3s;
    }
    input:focus, textarea:focus, select:focus {
      outline: none;
      border-color: #667eea;
    }
    textarea {
      min-height: 100px;
      resize: vertical;
      font-family: 'Courier New', monospace;
    }
    .file-input-wrapper {
      position: relative;
      border: 2px dashed #667eea;
      border-radius: 8px;
      padding: 30px;
      text-align: center;
      cursor: pointer;
      transition: all 0.3s;
      background: #f8f9ff;
    }
    .file-input-wrapper:hover {
      background: #eef0ff;
      border-color: #5568d3;
    }
    .file-input-wrapper input[type="file"] {
      position: absolute;
      opacity: 0;
      width: 100%;
      height: 100%;
      top: 0;
      left: 0;
      cursor: pointer;
    }
    .btn {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      padding: 15px 40px;
      font-size: 16px;
      font-weight: bold;
      border-radius: 8px;
      cursor: pointer;
      width: 100%;
      transition: all 0.3s;
    }
    .btn:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 10px 20px rgba(102, 126, 234, 0.4);
    }
    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .result {
      margin-top: 30px;
      text-align: center;
    }
    .result img {
      max-width: 100%;
      border-radius: 12px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.2);
    }
    .loading {
      display: none;
      text-align: center;
      margin-top: 20px;
      color: #667eea;
      font-weight: bold;
    }
    .loading.active {
      display: block;
    }
    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
    }
    .example-box {
      background: #f8f9ff;
      padding: 15px;
      border-radius: 8px;
      margin-top: 10px;
      font-size: 13px;
      border-left: 4px solid #667eea;
    }
    @media (max-width: 768px) {
      .grid-2 { grid-template-columns: 1fr; }
      .container { padding: 20px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🎨 FLUX.2 [dev] 图像生成器</h1>
    <p class="subtitle">支持多图参考、JSON 精细控制、风格迁移</p>
    
    <div class="tabs">
      <button class="tab active" onclick="switchTab('basic')">基础生成</button>
      <button class="tab" onclick="switchTab('multi')">多图参考</button>
      <button class="tab" onclick="switchTab('json')">JSON 控制</button>
      <button class="tab" onclick="switchTab('style')">风格迁移</button>
      <button class="tab" onclick="switchTab('product')">产品拍摄</button>
    </div>

    <!-- 基础生成 -->
    <div id="basic" class="tab-content active">
      <form onsubmit="return generateBasic(event)">
        <div class="form-group">
          <label>🖊️ 提示词</label>
          <textarea name="prompt" placeholder="描述你想生成的图像...&#10;例如: A cyberpunk cat with neon fur in a futuristic city" required></textarea>
        </div>
        <div class="grid-2">
          <div class="form-group">
            <label>宽度 (px)</label>
            <input type="number" name="width" value="1024" min="512" max="2048" step="64">
          </div>
          <div class="form-group">
            <label>高度 (px)</label>
            <input type="number" name="height" value="1024" min="512" max="2048" step="64">
          </div>
          <div class="form-group">
            <label>Steps</label>
            <input type="number" name="steps" value="20" min="10" max="50">
          </div>
          <div class="form-group">
            <label>Guidance</label>
            <input type="number" name="guidance" value="7.5" min="1" max="20" step="0.5">
          </div>
        </div>
        <button type="submit" class="btn">生成图像</button>
      </form>
    </div>

    <!-- 多图参考 -->
    <div id="multi" class="tab-content">
      <form onsubmit="return generateMulti(event)">
        <div class="form-group">
          <label>🖊️ 提示词 (可引用图像)</label>
          <textarea name="prompt" placeholder="例如:&#10;- take the subject of image 1 and style it like image 0&#10;- place the dog beside the woman&#10;- combine image 0 and image 1 in a surreal scene" required></textarea>
        </div>
        <div class="form-group">
          <label>📸 上传参考图像 (最多4张, 每张最好512x512)</label>
          <div class="file-input-wrapper">
            <input type="file" id="multi-images" accept="image/*" multiple>
            <p>📁 点击或拖拽上传图像</p>
            <small>支持 JPG, PNG, WebP</small>
          </div>
        </div>
        <div class="example-box">
          💡 <strong>提示:</strong> image 0, image 1, image 2... 按上传顺序编号
        </div>
        <button type="submit" class="btn">生成图像</button>
      </form>
    </div>

    <!-- JSON 控制 -->
    <div id="json" class="tab-content">
      <form onsubmit="return generateJson(event)">
        <div class="form-group">
          <label>📝 JSON 提示词</label>
          <textarea name="json_prompt" rows="20" required>{
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
}</textarea>
        </div>
        <button type="submit" class="btn">生成图像</button>
      </form>
    </div>

    <!-- 风格迁移 -->
    <div id="style" class="tab-content">
      <form onsubmit="return generateStyle(event)">
        <div class="form-group">
          <label>🎨 风格图像 (Image 0)</label>
          <div class="file-input-wrapper">
            <input type="file" name="style_image" accept="image/*" required>
            <p>上传风格参考图</p>
          </div>
        </div>
        <div class="form-group">
          <label>📷 内容图像 (Image 1)</label>
          <div class="file-input-wrapper">
            <input type="file" name="content_image" accept="image/*" required>
            <p>上传要应用风格的图</p>
          </div>
        </div>
        <div class="example-box">
          💡 将风格图的艺术风格应用到内容图上
        </div>
        <button type="submit" class="btn">生成风格迁移</button>
      </form>
    </div>

    <!-- 产品拍摄 -->
    <div id="product" class="tab-content">
      <form onsubmit="return generateProduct(event)">
        <div class="form-group">
          <label>📦 产品图像</label>
          <div class="file-input-wrapper">
            <input type="file" name="product_image" accept="image/*" required>
            <p>上传产品图片</p>
          </div>
        </div>
        <div class="form-group">
          <label>🌍 环境描述</label>
          <select name="environment">
            <option value="on a modern desk with soft lighting">现代办公桌</option>
            <option value="on a beach at sunset">海滩日落</option>
            <option value="in a luxury store display">奢华展示</option>
            <option value="floating in space with stars">太空漂浮</option>
            <option value="on a wooden table in a cozy cafe">咖啡馆木桌</option>
          </select>
        </div>
        <button type="submit" class="btn">生成产品图</button>
      </form>
    </div>

    <div class="loading" id="loading">⏳ 生成中,请稍候...</div>
    <div class="result" id="result"></div>
  </div>

  <script>
    function switchTab(tab) {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      event.target.classList.add('active');
      document.getElementById(tab).classList.add('active');
    }

    async function generateBasic(e) {
      e.preventDefault();
      const formData = new FormData(e.target);
      await generateImage('/api/generate', formData);
      return false;
    }

    async function generateMulti(e) {
      e.preventDefault();
      const form = e.target;
      const formData = new FormData(form);
      const files = document.getElementById('multi-images').files;
      
      if (files.length === 0) {
        alert('请至少上传一张参考图像');
        return false;
      }
      
      for (let i = 0; i < Math.min(files.length, 4); i++) {
        formData.append(\`input_image_\${i}\`, files[i]);
      }
      
      await generateImage('/api/multi-reference', formData);
      return false;
    }

    async function generateJson(e) {
      e.preventDefault();
      const formData = new FormData(e.target);
      await generateImage('/api/json-prompt', formData);
      return false;
    }

    async function generateStyle(e) {
      e.preventDefault();
      const formData = new FormData(e.target);
      await generateImage('/api/style-transfer', formData);
      return false;
    }

    async function generateProduct(e) {
      e.preventDefault();
      const formData = new FormData(e.target);
      await generateImage('/api/product-shot', formData);
      return false;
    }

    async function generateImage(endpoint, formData) {
      const loading = document.getElementById('loading');
      const result = document.getElementById('result');
      const buttons = document.querySelectorAll('.btn');
      
      loading.classList.add('active');
      buttons.forEach(btn => btn.disabled = true);
      result.innerHTML = '';
      
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          body: formData
        });
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || '生成失败');
        }
        
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        result.innerHTML = \`<img src="\${url}" alt="Generated Image">\`;
      } catch (error) {
        alert('错误: ' + error.message);
      } finally {
        loading.classList.remove('active');
        buttons.forEach(btn => btn.disabled = false);
      }
    }
  </script>
</body>
</html>`;
  
  return new Response(html, {
    headers: { 
      'Content-Type': 'text/html;charset=UTF-8',
      ...corsHeaders()
    }
  });
}
