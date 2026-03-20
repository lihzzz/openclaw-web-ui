# OpenClaw Web UI

一个现代化的 OpenClaw 管理界面，用于监控和管理 AI Agent 系统。

## 功能特性

- **Agent 管理** - 查看和管理所有 Agent，实时监控状态
- **会话管理** - 查看和管理对话会话
- **模型统计** - Token 使用量统计，按模型、按时间分析
- **配置管理** - 热重载配置，无需重启服务
- **技能管理** - 创建、编辑和管理 Agent 技能
- **实时聊天** - WebSocket 实时通信，支持流式响应

## 技术栈

- **前端**: Vue 3 + TypeScript + Vite
- **后端**: Express.js + TypeScript
- **样式**: 原生 CSS（暗色主题）
- **通信**: WebSocket 实时通信 + REST API

## 快速开始

### 前置要求

- Node.js 18+
- npm 或 pnpm
- OpenClaw 已安装并运行

### 安装依赖

```bash
npm install
```

### 开发模式

同时启动前端和后端：

```bash
npm run dev:all
```

或分别启动：

```bash
# 终端 1 - 后端 API 服务器 (端口 3001)
npm run dev:server

# 终端 2 - 前端开发服务器 (端口 3000)
npm run dev
```

### 生产构建

```bash
npm run build
```

## 项目结构

```
├── src/
│   ├── components/     # Vue 组件
│   ├── views/          # 页面视图
│   ├── stores/         # Pinia 状态管理
│   ├── services/       # API 服务
│   ├── types/          # TypeScript 类型定义
│   └── assets/         # 静态资源
├── server/
│   ├── api/            # API 路由
│   ├── lib/            # 服务端工具库
│   └── index.ts        # 服务器入口
└── public/             # 公共静态文件
```

## 配置

### 环境变量

- `API_PORT` - 后端 API 端口（默认 3001）
- `OPENCLAW_HOME` - OpenClaw 配置目录（默认 `~/.openclaw`）

### OpenClaw 配置

确保 OpenClaw Gateway 正在运行，默认端口为 443。

## 页面说明

| 路由 | 说明 |
|------|------|
| `/` | 聊天界面 |
| `/agents` | Agent 管理和状态监控 |
| `/sessions` | 会话列表和管理 |
| `/models` | 模型使用统计 |
| `/stats` | 统计数据可视化 |
| `/config` | 配置管理和热重载 |
| `/skills` | 技能管理 |

## API 端点

| 端点 | 说明 |
|------|------|
| `GET /api/config` | 获取配置 |
| `GET /api/stats-all` | 获取所有统计数据 |
| `GET /api/agent-status` | 获取 Agent 状态 |
| `POST /api/test-agents` | 测试所有 Agent |
| `GET /api/sessions` | 获取会话列表 |
| `GET /api/skills` | 获取技能列表 |

## 开发

### 类型检查

```bash
npm run build
```

### 代码风格

项目使用 TypeScript，请确保类型正确。

## 许可证

MIT

## 相关项目

- [OpenClaw](https://github.com/your-org/openclaw) - AI Agent 框架