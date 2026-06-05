# Set up

## 结构

| 路径 | 含义 |
| --- | --- |
| `projects/app` | 核心代码 |
| `projects/sandbox` | 沙盒项目 |
| `projects/code-sandbox` | 沙盒项目 |
| `projects/marketplace` | 核心代码 |
| `projects/mcp_server` | 核心代码 |
| `projects/volume-manager` | 核心代码 |

### app 依赖 

同一版本来源 `pnpm-workspace.yaml` 的 `catalog` 与 `catalog:lint`.

**核心框架**

| 依赖 | 说明 |
| --- | --- |
| next | Next.js 框架, React 全栈框架,支持 SSR/SSG |
| react/react-dom | React 核心库 |
| @chakra-ui | Chakra UI 组件库,包含(anatomy,icons,next-js,styled-system,system) |
| @emotion | CSS-in-JS 样式方案(Chakra 的底层依赖) |

**状态管理与数据获取**

| 依赖 | 说明 |
| --- | --- |
| @tanstack/react-query | 服务端状态管理,数据请求缓存 |
| immer | 不可变数据操作工具 |
| ahooks | React Hooks 工具库 |
| use-context-selector | 优化 context 性能,避免不必要的渲染 |

**UI 组件与交互**

| 依赖 | 说明 |
| --- | --- |
| framer-motion | 动画库 |
| @dnd-kit/core | 拖拽功能核心库 |
| reactflow | 流程图编辑器 |
| @dagrejs/dagre | 有向图自动布局算法 |
| react-hook-form | 表单处理库 |
| react-textarea-autosize | 自动调整高度的文本域 |
| react-syntax-highlighter | 代码语法高亮 |
| nprogress | 页面顶部加载进度条 |

**图表和可视化**

| 依赖 | 说明 |
| --- | --- |
| echarts | 百度 ECharts 图表 |
| echarts-gl | ECharts 3D/WebGL 扩展 |
| recharts | React 原生图表库 |
| mermaid | 流程图/时序图/Markdown 图表 |
| @monaco-editor/react | Monaco 代码编辑器 |

**Markdown 与文档处理**

| 依赖 | 说明 |
| --- | --- |
| react-markdown | Markdown 渲染 |
| remark-gfm | Github Flavored Markdown 支持 |
| remark-breaks | 支持 Markdown 换行 |
| remark-math | Markdown 数学公式 |
| rehype-katex | KaTeX 数学公式渲染 |
| rehype-external-links | 外部连接自动加 target=_blank |
| kates | 数学公式渲染引擎 |
| hyperdown | 轻量级 Markdown 解析器 |
 
**i18n**

| 依赖 | 说明 |
| --- | --- |
| i18next | 国际化框架核心 |
| react-i18next | React 绑定 |
| next-i18next | Next.js 集成 |

**HTTP 与网络**

| 依赖 | 说明 |
| --- | --- |
| axios | HTTP 请求库 |
| @fortaine/fetch-event-source | Server-Sent Events(SSE) 客户端 |
| undici | Node.js HTTP 客户端 |

**数据序列化与存储**

| 依赖 | 说明 |
| --- | --- |
| zod | 数据校验 Schema 库 |
| json5 | JSON 超集 |
| js-yaml | YAML 解析 |
| jsonwebtoken | JWT 令牌处理 |
| jsondiffpatch | JSON 差异对比 |
| jszip | ZIP 压缩/解压 |
| qrcode | 二维码生成 |
| mime | MIME 类型检测 |

**数据库与存储**

| 依赖 | 说明 |
| --- | --- |
| mongoose | MongoDB ODM |
| minio | MinIO 对象存储客户端 |
| ip2region.js | JS 地址位置定位 |
| archiver | 文档归档(压缩) |

**工具库**

| 依赖 | 说明 |
| --- | --- |
| lodash | JavaScript 工具函数 |
| date-fns | 日期处理(函数式) |
| dayjs | 轻量级日期库 |
| nanoid | 生成唯一 ID |
| p-limit | 并发控制 |
| esbuild | 高性能打包工具 |
| sass | SCSS 预处理器 |
| @node-es/jieba | Rust 实现的中文分词 |
| @t3-oss/env-core | 环境变量类型安全 |

**特殊依赖**

| 依赖 | 说明 |
| --- | --- |
| @modelcontextprotocol/sdk | MCP(Model Context Protocol) SDK 用于 AI 模型上下文交互 |
| @scalar/api-reference-react | API 文档参考工具 |
| @fastgpt* | 工作空间内部包 |


### app 路由

入口为: `projects/app/src/pages/_app.tsx`.

外层为: `projects/app/src/pages/_document.tsx`.

| 路由 | 文件 |
| --- | --- |
| / | projects/app/src/pages/index.tsx |
| /404 | projects/app/src/pages/404.tsx |
| /account/apikey | projects/app/src/pages/account/apikey.tsx |
| /account/bill | projects/app/src/pages/account/bill/index.tsx |
| /account/customDomain | projects/app/src/pages/account/customDomain/index.tsx |
| /account/info | projects/app/src/pages/account/info/index.tsx |
| /account/inform | projects/app/src/pages/account/info/index.tsx |
| /account/model | projects/app/src/pages/account/info/index.tsx |
| /account/promotion | projects/app/src/pages/account/info/index.tsx |
| /account/setting | projects/app/src/pages/account/info/index.tsx |
| /account/team | projects/app/src/pages |
| /account/thirdParty | projects/app/src/pages |
| /account/usage | projects/app/src/pages |
| /app/detail | projects/app/src/pages |
| /chat/usage | projects/app/src/pages |


## 技术栈

- NextJS
- TypeScript
- ChakraUI(React 组件库)
- MongoDB(数据库存储)
- PostgreSQL (PG Vector)(向量检索)
- Milvus(向量检索)

## 启动

**文档**

```bash
# 安装依赖
> cd document && pnpm install

# 启动文档
> cd document && pnpm dev
```

**服务**

```bash
# 启动 NextJS 开发服务器
> cd projects/app && pnpm dev

# 构建 NextJS 应用
> cd projects/app && pnpm build

# 启动生成服务器
> cd projects/app && pnpm start

# 以监视模式启动(Bun)
> cd projects/code-sandbox && pnpm dev

# 运行沙箱服务
> cd projects/code-sandbox && pnpm build

# 运行 Vitest 测试
> cd projects/code-sandbox && pnpm build

# 使用 Bun 以监视模式启动
> cd projects/mcp-server && bun dev

# 构建 MCP 服务器
> cd projects/mcp-server && bun build

# 启动 MCP 服务器
> cd projects/mcp-server && bun start
```

## 本地开发

```bash
> cd deploy/dev
> docker compose up -d
> cd projects/app
> cp .env.template .env.local
> cp data/config.json data/config.local.json

# 修改 .env.local
FILE_TOKEN_KEY=dwadwadwadawdwadwa
PLUGIN_ACCESS_TOKEN_EXPIRES_IN=3600
PG_URL=postgresql://blog:secret_password@localhost:5432/blog

> cd FastGPT
> pnpm i
> cd projects/app
> pnpm dev

# 浏览器访问，用户名：root，密码为 .env.local 中的DEFAULT_ROOT_PSW
localhost:3000
root
123456


# 配置 LLM
DeepSeek -> deepseek-v4-flash
    Custom url: https://api.deepseek.com/v1/chat/completions
    Custom key:
# 配置 Other
Model Id: embedding-3
Alias: embedding-3
Provider: Other
Number of concurrent request: 1
Default tokens: 512
Max Content: 8000
Custom url: https://open.bigmodel.cn/api/paas/v4/embeddings
Custom key:
```

