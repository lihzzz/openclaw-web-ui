# Token Usage 调试指南

## 问题描述
Chat页面的token使用量始终显示为0，无法正确统计输入/输出token。

## 根本原因分析

### 1. SessionKey过滤问题
**问题**：代码中有三处sessionKey过滤逻辑，会完全忽略sessionKey不匹配的事件：
- `handleAgentEvent` (第307-314行)
- `handleChatEvent` (第547-556行)
- `handleUsageEvent` (第663-677行)

**原因**：
- 客户端默认使用私有sessionKey：`agent:main:${deviceId}`
- Gateway可能发送不同的sessionKey或不发送sessionKey
- 导致所有usage事件被过滤掉

**已修复**：
- 放宽过滤逻辑，允许共享session (`agent:main:main`) 通过
- 添加调试日志记录被过滤的事件

### 2. Usage数据提取位置
代码尝试从三个地方提取usage：

#### a) Lifecycle事件 (第337-373行)
```typescript
// 当 state === 'done' 时
data.usage
payload.usage
data.metadata.usage
```

#### b) Chat事件 (第589-643行)
```typescript
// 当 state === 'final' 时
message.usage
payload.usage
payload.data.usage
message.metadata.usage
```

#### c) Usage事件 (第656-698行)
```typescript
// 独立的usage事件
payload.usage
payload.data.usage
```

### 3. 支持的字段名
代码支持多种usage字段名：
- `input` / `prompt_tokens` / `inputTokens`
- `output` / `completion_tokens` / `outputTokens`

## 调试步骤

### 步骤1: 检查浏览器控制台
打开浏览器开发者工具 (F12)，查看Console标签页，发送一条消息后观察日志：

#### 应该看到的日志：
```
[Chat] Event received: agent {...}
[Chat] Event received: chat {...}
[Chat] Lifecycle done payload: {...}
[Chat] Lifecycle done data: {...}
[Chat] Extracted usage data: {...}
[Chat] Chat final event payload: {...}
[Chat] Usage event received: {...}
```

#### 关键检查点：
1. **是否收到lifecycle done事件？**
   - 查找：`[Chat] Lifecycle done payload:`
   - 检查payload中是否有usage字段

2. **是否收到chat final事件？**
   - 查找：`[Chat] Chat final event payload:`
   - 检查payload中是否有usage字段

3. **是否收到usage事件？**
   - 查找：`[Chat] Usage event received:`
   - 检查是否被sessionKey过滤：`[Chat] Usage event filtered by sessionKey:`

4. **是否有未处理的事件？**
   - 查找：`[Chat] Unhandled event type:`

### 步骤2: 检查SessionKey
在控制台执行：
```javascript
// 查看当前sessionKey
localStorage.getItem('gui-web-device-id')

// 查看设置
JSON.parse(localStorage.getItem('gui-web-settings'))
```

### 步骤3: 检查Gateway版本
确认Openclaw Gateway版本：
```bash
openclaw --version
```

确保版本 >= 2026.3.x

### 步骤4: 检查Gateway配置
查看Gateway是否启用了usage统计：
```bash
cat ~/.openclaw/openclaw.json | grep -A 5 "usage"
```

## 可能的解决方案

### 方案1: 使用共享Session (推荐)
在设置中启用"使用共享会话"选项，这样sessionKey会变成`agent:main:main`，与Gateway默认配置匹配。

### 方案2: 禁用SessionKey过滤
如果确定只有一个用户使用，可以完全移除sessionKey过滤逻辑。

### 方案3: 检查Gateway配置
确保Gateway配置中启用了usage事件发送：
```json
{
  "gateway": {
    "emitUsageEvents": true
  }
}
```

### 方案4: 升级Openclaw
如果使用的是旧版本，升级到最新版本：
```bash
npm install -g openclaw@latest
```

## 已应用的修复

### 1. 放宽SessionKey过滤
修改了三处过滤逻辑，允许共享session通过：
```typescript
if (sessionKey && deviceStore.sessionKey && sessionKey !== deviceStore.sessionKey) {
  // 允许共享session的事件通过
  if (sessionKey !== 'agent:main:main') {
    return
  }
}
```

### 2. 增强调试日志
添加了以下日志：
- `[Chat] Lifecycle done data:` - 显示lifecycle事件的data字段
- `[Chat] Extracted usage data:` - 显示提取的usage数据
- `[Chat] Usage event filtered by sessionKey:` - 显示被过滤的usage事件
- `[Chat] Unhandled event type:` - 显示未处理的事件类型

### 3. 改进Usage提取
在lifecycle事件中添加了更详细的usage提取日志。

## 下一步

1. 重新构建项目：`npm run build`
2. 重启开发服务器：`npm run dev`
3. 打开浏览器控制台
4. 发送一条测试消息
5. 查看控制台日志，按照上述调试步骤检查

## 预期结果

修复后，应该能看到：
- Token使用量正确显示
- 输入/输出token分别统计
- 进度条正常显示
- 上下文使用百分比正确计算

## 如果问题仍然存在

请提供以下信息：
1. 浏览器控制台的完整日志（发送一条消息后）
2. Openclaw版本：`openclaw --version`
3. Gateway配置：`cat ~/.openclaw/openclaw.json`
4. 当前sessionKey：在控制台执行上述JavaScript代码
