import * as vscode from 'vscode';

interface ModelRemains {
  model_name: string;
  remains_time: number;
  current_interval_total_count: number;
  current_interval_usage_count: number;
  current_weekly_total_count: number;
  current_weekly_usage_count: number;
  weekly_remains_time: number;
}

interface ApiResponse {
  model_remains: ModelRemains[];
}

let statusBarItem: vscode.StatusBarItem;
let refreshTimer: NodeJS.Timeout | undefined;
let outputChannel: vscode.OutputChannel;

export function activate(context: vscode.ExtensionContext) {
  outputChannel = vscode.window.createOutputChannel('MiniMax Usage Monitor');
  
  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  statusBarItem.command = 'minimax-usage.refresh';
  statusBarItem.text = "$(loading~spin) MiniMax: 加载中...";
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  const refreshCommand = vscode.commands.registerCommand('minimax-usage.refresh', () => {
    updateUsageInfo();
  });
  context.subscriptions.push(refreshCommand);

  const configChangeListener = vscode.workspace.onDidChangeConfiguration(e => {
    if (e.affectsConfiguration('minimaxUsage')) {
      restartTimer();
      updateUsageInfo();
    }
  });
  context.subscriptions.push(configChangeListener);

  updateUsageInfo();
  startTimer();
}

function startTimer(): void {
  const config = vscode.workspace.getConfiguration('minimaxUsage');
  const interval = config.get<number>('refreshInterval', 30) * 1000;
  
  if (refreshTimer) {
    clearInterval(refreshTimer);
  }
  
  refreshTimer = setInterval(() => {
    updateUsageInfo();
  }, interval);
}

function restartTimer(): void {
  if (refreshTimer) {
    clearInterval(refreshTimer);
  }
  startTimer();
}

async function updateUsageInfo(): Promise<void> {
  try {
    const config = vscode.workspace.getConfiguration('minimaxUsage');
    const apiKey = config.get<string>('apiKey');
    const showNotifications = config.get<boolean>('showNotifications', true);
    
    if (!apiKey) {
      statusBarItem.text = "$(warning) MiniMax: 未配置API密钥";
      statusBarItem.tooltip = "请在设置中配置minimaxUsage.apiKey";
      if (showNotifications) {
        vscode.window.showWarningMessage('MiniMax: 请先配置API密钥', '打开设置').then(selection => {
          if (selection === '打开设置') {
            vscode.commands.executeCommand('workbench.action.openSettings', 'minimaxUsage.apiKey');
          }
        });
      }
      return;
    }

    const apiUrl = "https://www.minimaxi.com/v1/api/openplatform/coding_plan/remains";
    
    outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] 正在获取MiniMax使用情况...`);
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json() as ApiResponse;
    
    const model = data.model_remains.find(m => m.model_name === "MiniMax-M2.7");
    
    if (!model) {
      statusBarItem.text = "$(error) MiniMax: 未找到模型";
      statusBarItem.tooltip = "未找到MiniMax-M2.7模型";
      outputChannel.appendLine('未找到MiniMax-M2.7模型');
      return;
    }

    const remainMs = model.remains_time;
    const remainHours = Math.floor(remainMs / (1000 * 60 * 60));
    const remainMinutes = Math.floor((remainMs % (1000 * 60 * 60)) / (1000 * 60));
    const remainText = remainHours > 0 ? `${remainHours}h${remainMinutes}m` : `${remainMinutes}m`;

    // 使用次数和百分比（参考插件逻辑：剩余次数 = 总次数 - 使用次数）
    const totalCount = model.current_interval_total_count;
    const usedCount = totalCount - model.current_interval_usage_count;
    const usedPercentage = totalCount > 0 ? Math.round((usedCount / totalCount) * 100) : 0;

    // 周使用次数和百分比
    const weeklyTotal = model.current_weekly_total_count;
    const weeklyUsed = weeklyTotal - model.current_weekly_usage_count;
    const weeklyPercentage = weeklyTotal > 0 ? Math.round((weeklyUsed / weeklyTotal) * 100) : 0;

    // 根据使用百分比设置颜色
    if (usedPercentage < 60) {
      statusBarItem.color = new vscode.ThemeColor('charts.green');
    } else if (usedPercentage < 85) {
      statusBarItem.color = new vscode.ThemeColor('charts.yellow');
    } else {
      statusBarItem.color = new vscode.ThemeColor('errorForeground');
    }

    // 状态栏显示格式：剩余时间 使用百分比 · 周 百分比
    const weeklyText = weeklyTotal > 0 ? ` · 周${weeklyPercentage}%` : '';
    statusBarItem.text = `$(clock) ${remainText} ${usedPercentage}%${weeklyText}`;

    statusBarItem.tooltip = new vscode.MarkdownString(
      `**MiniMax-M2.7 使用情况**\n\n` +
      `- 使用进度: ${usedPercentage}% (${usedCount.toLocaleString()}/${totalCount.toLocaleString()})\n` +
      `- 剩余时间: ${remainText}后重置\n` +
      `- 周用量: ${weeklyPercentage}% (${weeklyUsed.toLocaleString()}/${weeklyTotal.toLocaleString()})`
    );

    outputChannel.appendLine(`更新成功: 已用${usedCount}/${totalCount} (${usedPercentage}%), ${remainText}后重置`);

  } catch (error) {
    console.error('获取MiniMax使用情况失败:', error);
    statusBarItem.text = "$(error) MiniMax: 请求失败";
    statusBarItem.tooltip = `错误: ${error instanceof Error ? error.message : String(error)}`;
    
    const config = vscode.workspace.getConfiguration('minimaxUsage');
    const showNotifications = config.get<boolean>('showNotifications', true);
    
    if (showNotifications) {
      vscode.window.showErrorMessage(`MiniMax: 请求失败 - ${error instanceof Error ? error.message : String(error)}`);
    }
    
    outputChannel.appendLine(`请求失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function deactivate() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
  }
}
