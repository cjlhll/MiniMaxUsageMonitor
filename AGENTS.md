# AGENTS.md - MiniMax Usage Monitor VS Code Extension

监控 MiniMax API 使用情况并在状态栏显示剩余次数和时间的 VS Code 扩展。

## Build & Lint Commands

| Command | Description |
|---------|-------------|
| `npm run compile` | TypeScript 类型检查并编译到 `dist/` |
| `npm run package` | 完整构建：compile + esbuild 打包压缩 |
| `npm run lint` | ESLint 检查 `src/` 目录下的 TypeScript 文件 |
| `npm run watch` | 开发用 watch 模式 |

- 每次修改代码后必须运行 `npm run lint`。
- 项目没有测试框架，也没有任何测试文件。
- 扩展入口是 `dist/extension.js`，由 esbuild 打包。

## Project Structure

```
src/extension.ts    - 唯一的源文件，包含所有扩展逻辑
dist/               - 编译/打包输出（不要手动编辑）
package.json        - 扩展清单：命令、配置 schema
tsconfig.json       - TypeScript 配置（strict 模式）
.vscodeignore       - 发布时排除的文件
```

## Code Style

### TypeScript
- tsconfig 中 `"strict": true`，所有类型检查启用。
- 函数参数和返回值必须有显式类型标注。
- 用 `interface` 定义对象结构（参考 `ModelRemains`、`ApiResponse`）。
- `as` 类型断言仅用于 JSON 响应，其他场景避免使用。
- 优先用 `const`，其次 `let`，禁止 `var`。

### Imports
- vscode API 导入方式：`import * as vscode from 'vscode';`
- 无其他运行时依赖，仅使用 `vscode` 和 Node 内置模块。

### Naming
- 接口：PascalCase（`ModelRemains`、`ApiResponse`）
- 函数：camelCase（`updateUsageInfo`、`startTimer`）
- 变量：camelCase（`statusBarItem`、`refreshTimer`）
- 配置键：带命名空间前缀的 camelCase（`minimaxUsage.apiKey`）

### Error Handling
- API 调用必须用 try/catch 包裹。
- 错误消息提取：`error instanceof Error ? error.message : String(error)`
- 错误同时输出到 `outputChannel` 和 `console.error`。
- 当 `showNotifications` 为 true 时，通过 `vscode.window.showErrorMessage` 通知用户。

### Formatting
- 2 空格缩进。
- 字符串使用单引号。
- 行尾必须有分号。
- 无行尾空格。

### VS Code Extension Patterns
- 所有 disposable 通过 `context.subscriptions.push(...)` 注册。
- 配置读取使用 `vscode.workspace.getConfiguration('minimaxUsage').get<type>('key')`。
- 状态栏 UI 用 `vscode.StatusBarItem`。
- 日志输出用 `vscode.OutputChannel`。
- `deactivate()` 函数中必须清理定时器。

### Comments
- 仅对复杂逻辑写注释，使用中文以匹配现有代码风格。
- 不要添加 JSDoc 或文件级注释。

## Key Configuration (package.json contributes)

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `minimaxUsage.apiKey` | string | `""` | MiniMax API 密钥 |
| `minimaxUsage.modelName` | string | `"MiniMax-M2.7"` | 要监控的模型名称 |
| `minimaxUsage.refreshInterval` | number | `30` | 刷新间隔（秒），范围 10-3600 |
| `minimaxUsage.showNotifications` | boolean | `true` | 是否显示错误通知 |

## Common Tasks

- **添加新配置项**：先在 `package.json` 的 `contributes.configuration.properties` 中注册，然后用 `vscode.workspace.getConfiguration('minimaxUsage').get<type>('key')` 读取。
- **添加新命令**：先在 `package.json` 的 `contributes.commands` 中注册，然后在 `activate()` 中用 `vscode.commands.registerCommand()` 实现。
- **修改状态栏**：编辑 `updateUsageInfo()` 函数。
- **修改 API 请求**：编辑 `updateUsageInfo()` 中的 fetch 调用部分。

## API Integration

扩展调用 MiniMax API 获取使用情况：

```
GET https://www.minimaxi.com/v1/api/openplatform/coding_plan/remains
Authorization: Bearer {apiKey}
Content-Type: application/json
```

响应结构（`ApiResponse` 接口）：
```typescript
{
  model_remains: ModelRemains[]  // 每个模型的使用数据
}
```

`ModelRemains` 字段说明：
| 字段 | 类型 | 说明 |
|------|------|------|
| `model_name` | string | 模型名称 |
| `remains_time` | number | 剩余重置时间（毫秒） |
| `current_interval_total_count` | number | 当前区间总次数 |
| `current_interval_usage_count` | number | 当前区间已用次数 |
| `current_weekly_total_count` | number | 周总次数 |
| `current_weekly_usage_count` | number | 周已用次数 |

## Status Bar Display Logic

状态栏文本格式：`$(clock) {剩余时间} {使用百分比} · 周{周百分比}%`

颜色根据使用百分比变化：
- `< 60%`：绿色（`charts.green`）
- `60-84%`：黄色（`charts.yellow`）
- `≥ 85%`：红色（`errorForeground`）

## Extension Lifecycle

```
activate()
  ├── 创建 OutputChannel
  ├── 创建 StatusBarItem（右侧，优先级 100）
  ├── 注册命令 'minimax-usage.refresh'
  ├── 监听配置变化（onDidChangeConfiguration）
  ├── 首次调用 updateUsageInfo()
  └── 启动定时器 startTimer()

deactivate()
  └── 清理定时器 clearInterval(refreshTimer)
```

## Debugging

- 查看日志：VS Code 输出面板 → "MiniMax Usage Monitor" 频道
- 手动刷新：命令面板 → "刷新MiniMax使用情况"
- 检查配置：确保 `minimaxUsage.apiKey` 已正确设置
- 网络问题：检查 API URL 是否可达，HTTP 状态码是否为 200

## Build Artifacts

打包后的文件结构：
```
dist/extension.js     - esbuild 生成的单文件 bundle
dist/extension.js.map - source map（调试用）
```

发布时 `.vscodeignore` 会排除源码和开发文件，只打包 `dist/`、`package.json`、`icon.png` 等必要文件。

## TypeScript Strict Mode Notes

tsconfig 启用了完整 strict 模式，常见注意事项：
- 可能为 `undefined` 的值必须做空值检查
- `config.get<T>()` 返回 `T | undefined`，需要提供默认值或判空
- 接口字段必须完整实现，不能有多余字段
- 函数必须有明确的返回类型标注
