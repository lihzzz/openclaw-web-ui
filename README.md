# OpenClaw Web UI

支付体验 Agent 的 Web 管理界面，提供聊天、会话管理、模型配置、统计数据等功能。

## 功能特性

- **聊天界面** - 与 Agent 实时对话，支持 Markdown 渲染和工具调用展示
- **Agent 管理** - 查看和管理所有 Agent 的状态和配置
- **会话管理** - 查看和管理用户会话，支持会话测试
- **模型配置** - 管理模型提供商和模型配置
- **统计数据** - 查看使用统计、Token 消耗、响应时间等
- **技能管理** - 浏览和管理 Agent 技能文件
- **配置热重载** - 支持配置文件的实时热重载

## 技术栈

- **前端**: Vue 3 + TypeScript + Vite
- **状态管理**: Pinia
- **样式**: SCSS
- **后端**: Express.js
- **通信**: WebSocket (与 Agent Gateway 通信)

## 项目结构

```
gui-web/
├── src/                    # 前端源码
│   ├── components/         # Vue 组件
│   ├── views/              # 页面视图
│   ├── stores/             # Pinia 状态管理
│   ├── services/           # API 服务
│   ├── router/             # 路由配置
│   └── utils/              # 工具函数
├── server/                 # 后端 API 服务
│   ├── api/                # API 路由
│   └── lib/                # 后端工具库
└── public/                 # 静态资源
```

## 快速开始

### 安装依赖

```bash
npm install
```

### 开发模式

启动前端开发服务器：

```bash
npm run dev
```

启动后端 API 服务器：

```bash
npm run dev:server
```

同时启动前后端：

```bash
npm run dev:all
```

### 生产构建

```bash
npm run build
```

## 配置

### 前端配置

前端默认连接到 `http://localhost:3000` 的 Agent Gateway。可在设置界面中修改：

- Gateway 地址
- 认证 Token
- 连接超时时间

### 后端配置

后端 API 服务器默认运行在 `3001` 端口，可通过环境变量 `API_PORT` 修改。

## API 端点

| 端点 | 描述 |
|------|------|
| `/api/config` | 获取 Agent 配置 |
| `/api/stats` | 获取统计数据 |
| `/api/sessions` | 会话管理 |
| `/api/agent-status` | Agent 状态 |
| `/api/skills` | 技能管理 |
| `/api/test-*` | 各类测试接口 |

## 环境要求

- Node.js >= 18
- npm >= 9

## License

MIT
