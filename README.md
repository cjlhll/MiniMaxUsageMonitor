# MiniMax Usage Monitor

VS Code 扩展，在状态栏实时监控 MiniMax API 使用情况。

![icon](icon.png)

## 功能

- 状态栏显示模型剩余重置时间和使用百分比
- 支持监控任意 MiniMax 模型
- 颜色随使用量变化：绿色（<60%）→ 黄色（<85%）→ 红色
- 鼠标悬停查看详细用量信息（日/周使用量）
- 可自定义刷新间隔

## 安装

从 VSIX 文件安装：

```bash
code --install-extension minimax-usage-monitor-0.0.1.vsix
```

## 配置

在 VS Code 设置中搜索 `MiniMax Usage Monitor`：

| 设置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `minimaxUsage.apiKey` | string | `""` | MiniMax API 密钥 |
| `minimaxUsage.modelName` | string | `MiniMax-M2.7` | 监控的模型名称 |
| `minimaxUsage.refreshInterval` | number | `30` | 刷新间隔（秒），范围 10-3600 |
| `minimaxUsage.showNotifications` | boolean | `true` | 是否显示错误通知 |

## 使用

1. 配置 API 密钥后插件自动开始监控
2. 点击状态栏图标可手动刷新
3. 通过命令面板执行 `刷新MiniMax使用情况`

## 开发

```bash
npm install
npm run compile    # 编译
npm run watch      # 监听模式
npm run package    # 打包
```
