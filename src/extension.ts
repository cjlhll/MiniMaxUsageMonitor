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
let configChangeTimer: NodeJS.Timeout | undefined;

async function fetchModelList(apiKey: string): Promise<string[]> {
  const apiUrl = 'https://www.minimaxi.com/v1/api/openplatform/coding_plan/remains';
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  const response = await fetch(apiUrl, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    signal: controller.signal
  });

  clearTimeout(timeoutId);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const data = await response.json() as ApiResponse;
  return data.model_remains.map(m => m.model_name);
}

async function selectModel(): Promise<void> {
  const config = vscode.workspace.getConfiguration('minimaxUsage');
  const apiKey = config.get<string>('apiKey');

  if (!apiKey) {
    vscode.window.showWarningMessage('请先配置API密钥', '打开设置').then(selection => {
      if (selection === '打开设置') {
        vscode.commands.executeCommand('workbench.action.openSettings', 'minimaxUsage.apiKey');
      }
    });
    return;
  }

  try {
    const models = await fetchModelList(apiKey);
    outputChannel.appendLine(`获取到可用模型: ${models.join(', ')}`);

    if (models.length === 0) {
      vscode.window.showWarningMessage('未获取到可用模型');
      return;
    }

    const currentModel = config.get<string>('modelName', '');
    const items = models.map(m => ({
      label: m,
      description: m === currentModel ? '(当前选择)' : ''
    }));

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: '选择要监控的模型'
    });

    if (selected) {
      await config.update('modelName', selected.label, vscode.ConfigurationTarget.Global);
      vscode.window.showInformationMessage(`已切换到模型: ${selected.label}`);
    }
  } catch (error) {
    vscode.window.showErrorMessage(`获取模型列表失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function activate(context: vscode.ExtensionContext) {
  outputChannel = vscode.window.createOutputChannel('MiniMax Usage Monitor');

  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  statusBarItem.command = 'minimax-usage.refresh';
  statusBarItem.text = '$(loading~spin) MiniMax: 加载中...';
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  const refreshCommand = vscode.commands.registerCommand('minimax-usage.refresh', () => {
    updateUsageInfo();
  });
  context.subscriptions.push(refreshCommand);

  const selectModelCommand = vscode.commands.registerCommand('minimax-usage.selectModel', () => {
    selectModel();
  });
  context.subscriptions.push(selectModelCommand);

  const configChangeListener = vscode.workspace.onDidChangeConfiguration(e => {
    if (e.affectsConfiguration('minimaxUsage.apiKey')) {
      const config = vscode.workspace.getConfiguration('minimaxUsage');
      const apiKey = config.get<string>('apiKey');
      if (apiKey) {
        updateUsageInfo();
        fetchModelList(apiKey).then(models => {
          outputChannel.appendLine(`API密钥已配置，可用模型: ${models.join(', ')}`);
          const currentModel = config.get<string>('modelName', '');
          if (!models.includes(currentModel)) {
            vscode.window.showInformationMessage(
              `当前模型"${currentModel}"不在可用列表中，请选择一个模型`,
              '选择模型'
            ).then(selection => {
              if (selection === '选择模型') {
                selectModel();
              }
            });
          }
        }).catch(() => {});
      }
    } else if (e.affectsConfiguration('minimaxUsage')) {
      restartTimer();
      if (configChangeTimer) {
        clearTimeout(configChangeTimer);
      }
      configChangeTimer = setTimeout(() => {
        updateUsageInfo();
      }, 500);
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
    const modelName = config.get<string>('modelName', '');
    const showNotifications = config.get<boolean>('showNotifications', true);

    if (!apiKey) {
      statusBarItem.text = '$(warning) MiniMax: 未配置API密钥';
      statusBarItem.tooltip = '请在设置中配置minimaxUsage.apiKey';
      if (showNotifications) {
        vscode.window.showWarningMessage('MiniMax: 请先配置API密钥', '打开设置').then(selection => {
          if (selection === '打开设置') {
            vscode.commands.executeCommand('workbench.action.openSettings', 'minimaxUsage.apiKey');
          }
        });
      }
      return;
    }

    const apiUrl = 'https://www.minimaxi.com/v1/api/openplatform/coding_plan/remains';

    outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] 正在获取MiniMax使用情况...`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json() as ApiResponse;

    outputChannel.appendLine(`可用模型: ${data.model_remains.map(m => m.model_name).join(', ')}`);
    outputChannel.appendLine(`当前模型: "${modelName}"`);

    if (!modelName) {
      statusBarItem.text = '$(warning) MiniMax: 请选择模型';
      statusBarItem.tooltip = `点击选择要监控的模型。可用: ${data.model_remains.map(m => m.model_name).join(', ')}`;
      statusBarItem.command = 'minimax-usage.selectModel';
      return;
    }

    const model = data.model_remains.find(m => m.model_name === modelName);

    if (!model) {
      statusBarItem.text = '$(error) MiniMax: 模型不存在';
      statusBarItem.tooltip = `模型"${modelName}"不存在。点击选择其他模型`;
      statusBarItem.command = 'minimax-usage.selectModel';
      outputChannel.appendLine(`模型"${modelName}"不存在。可用: ${data.model_remains.map(m => m.model_name).join(', ')}`);
      return;
    }

    statusBarItem.command = 'minimax-usage.refresh';

    const remainMs = model.remains_time;
    const remainHours = Math.floor(remainMs / (1000 * 60 * 60));
    const remainMinutes = Math.floor((remainMs % (1000 * 60 * 60)) / (1000 * 60));
    const remainText = remainHours > 0 ? `${remainHours}h${remainMinutes}m` : `${remainMinutes}m`;

    const totalCount = model.current_interval_total_count;
    const usedCount = totalCount - model.current_interval_usage_count;
    const usedPercentage = totalCount > 0 ? Math.round((usedCount / totalCount) * 100) : 0;

    const weeklyTotal = model.current_weekly_total_count;
    const weeklyUsed = weeklyTotal - model.current_weekly_usage_count;
    const weeklyPercentage = weeklyTotal > 0 ? Math.round((weeklyUsed / weeklyTotal) * 100) : 0;

    if (usedPercentage < 60) {
      statusBarItem.color = new vscode.ThemeColor('charts.green');
    } else if (usedPercentage < 85) {
      statusBarItem.color = new vscode.ThemeColor('charts.yellow');
    } else {
      statusBarItem.color = new vscode.ThemeColor('errorForeground');
    }

    const weeklyText = weeklyTotal > 0 ? ` · 周${weeklyPercentage}%` : '';
    statusBarItem.text = `$(clock) ${remainText} ${usedPercentage}%${weeklyText}`;

    const tooltipWeekly = weeklyTotal > 0 ? `\n周用量: ${weeklyPercentage}% (${weeklyUsed.toLocaleString()}/${weeklyTotal.toLocaleString()})` : '';
    statusBarItem.tooltip = `${modelName} 使用情况\n使用进度: ${usedPercentage}% (${usedCount.toLocaleString()}/${totalCount.toLocaleString()})\n剩余时间: ${remainText}后重置${tooltipWeekly}`;

    outputChannel.appendLine(`更新成功: 已用${usedCount}/${totalCount} (${usedPercentage}%), ${remainText}后重置`);

  } catch (error) {
    console.error('获取MiniMax使用情况失败:', error);
    statusBarItem.text = '$(error) MiniMax: 请求失败';
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
  if (configChangeTimer) {
    clearTimeout(configChangeTimer);
  }
}
