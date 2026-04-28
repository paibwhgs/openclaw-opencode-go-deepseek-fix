# OpenClaw opencode-go DeepSeek V4 reasoning_content 补丁

修复 OpenClaw 3.31 + opencode-go provider 使用 DeepSeek V4 模型时，多轮 tool call 链报错的问题。

## 问题

通过 opencode-go 使用 DeepSeek V4 模型时，多轮 tool call（函数调用）会报错：

> `The 'reasoning_content' in the thinking mode must be passed back to the API.`

这是因为 DeepSeek 在 thinking 模式下严格要求：**所有 assistant 消息都必须携带 `reasoning_content` 字段**，即使内容是空字符串。

## 根因分析

问题出在 pi-ai 库（`@mariozechner/pi-ai`）的 `openai-completions.js` 中，有两处过滤点会丢弃空字符串：

### 过滤点 1：Streaming 响应解析

```js
// 原代码：空字符串被 length > 0 过滤掉
if (choice.delta[field] !== null &&
    choice.delta[field] !== undefined &&
    choice.delta[field].length > 0) {  // ← "" 被跳过
```

当 DeepSeek 返回 `reasoning_content: ""` 时，不会创建 thinking block，导致后续无法识别需要回传该字段。

### 过滤点 2：请求消息构建

```js
// 原代码：空 thinking block 被 filter 移除
const nonEmptyThinkingBlocks = thinkingBlocks.filter(
    (b) => b.thinking && b.thinking.trim().length > 0  // ← "" 被滤掉
);
```

即使第一个过滤点创建了空 thinking block，在这里也会被移除，最终发回给 DeepSeek 的消息**没有 `reasoning_content` 字段**。

## 修复内容

三个修改点，全部在 `openai-completions.js` 中：

### 修改 1：允许空 `reasoning_content` 通过 streaming 过滤

去掉 `length > 0` 条件，让空字符串也能触发 thinking block 的创建。

### 修改 2：保留有 signature 的空 thinking block

```js
const nonEmptyThinkingBlocks = thinkingBlocks.filter(
    (b) => (b.thinking && b.thinking.trim().length > 0) || b.thinkingSignature
);
```

### 修改 3：DeepSeek V4 兜底

在所有 assistant 消息构建完成后，如果模型是 DeepSeek V4 且没有设置 `reasoning_content`，自动补充空字符串：

```js
if (!("reasoning_content" in assistantMsg) &&
    (model.id.startsWith("deepseek-v") || model.id.startsWith("deepseek-ch"))) {
    assistantMsg.reasoning_content = "";
}
```

## 使用方式

### 应用补丁

```bash
node patch/apply.js
```

脚本会自动：
1. 备份原文件为 `openai-completions.js.bak`
2. 应用三个修改点
3. 提示完成

### 还原补丁

```bash
node patch/revert.js
```

或者重新安装 OpenClaw：

```bash
npm install -g openclaw@2026.3.31
```

### 手工打补丁

也可以直接用 `patch/openai-completions.js` 覆盖目标文件（**不推荐**，建议使用脚本）：

```bash
cp patch/openai-completions.js "目标路径"
```

## 兼容性

- 仅影响有 `thinkingSignature` 的 thinking block
- 不影响普通文本/text 消息
- 经测试不影响 opencode-go 其他模型（kimi-k2.5、glm-5）

## 注意事项

- pi-ai 文件位于 `node_modules/` 下，npm reinstall 或 OpenClaw 升级后会丢失补丁
- 此修复基于 OpenClaw 3.31 + pi-ai 0.64.0，后续版本可能已修复此问题

## 环境

- OpenClaw 3.31（`npm install -g openclaw@2026.3.31`）
- pi-ai 0.64.0（`@mariozechner/pi-ai`）
- DeepSeek V4（通过 opencode-go provider）
