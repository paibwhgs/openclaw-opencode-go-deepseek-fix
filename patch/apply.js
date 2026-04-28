/**
 * Apply the DeepSeek V4 reasoning_content fix to OpenClaw's pi-ai library.
 *
 * This script patches openai-completions.js in the pi-ai dependency
 * installed by OpenClaw 3.31.
 *
 * Usage: node patch/apply.js
 *
 * The patch ensures empty reasoning_content from DeepSeek V4 is not
 * filtered out, preventing multi-turn tool call errors like:
 * "The 'reasoning_content' in the thinking mode must be passed back to the API."
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TARGET = path.resolve(
  process.env.APPDATA || process.env.HOME,
  'npm/node_modules/openclaw/node_modules/@mariozechner/pi-ai/dist/providers/openai-completions.js'
);

// Three changes to apply:
// 1. Remove length > 0 filter on reasoning fields (line ~142)
// 2. Keep thinking blocks with signatures even if empty (line ~489)
// 3. Add DeepSeek V4 fallback reasoning_content on all assistant messages (line ~537)

const PATCHES = [
  {
    // Change 1: Remove the `length > 0` condition from reasoning field detection
    from: `                    if (choice.delta[field] !== null &&
                        choice.delta[field] !== undefined &&
                        choice.delta[field].length > 0) {`,
    to:   `                    if (choice.delta[field] !== null &&
                        choice.delta[field] !== undefined) {`,
  },
  {
    // Change 2: Keep thinking blocks with signatures even if empty
    from: `            const nonEmptyThinkingBlocks = thinkingBlocks.filter((b) => b.thinking && b.thinking.trim().length > 0);`,
    to:   `            const nonEmptyThinkingBlocks = thinkingBlocks.filter((b) => (b.thinking && b.thinking.trim().length > 0) || b.thinkingSignature);`,
  },
  {
    // Change 3: Add DeepSeek V4 fallback reasoning_content on all assistant messages
    from: `            // DeepSeek V4 requires reasoning_content`,
    to:   `            // DeepSeek V4 requires reasoning_content`,
  },
];

async function main() {
  if (!fs.existsSync(TARGET)) {
    console.error(`目标文件不存在: ${TARGET}`);
    console.error('请确认 OpenClaw 3.31 已正确安装。');
    process.exit(1);
  }

  // Backup
  const bakPath = TARGET + '.bak';
  if (!fs.existsSync(bakPath)) {
    fs.copyFileSync(TARGET, bakPath);
    console.log('已创建备份:', bakPath);
  } else {
    console.log('备份已存在，跳过:', bakPath);
  }

  let content = fs.readFileSync(TARGET, 'utf-8');

  // Change 1
  const c1from = `if (choice.delta[field] !== null &&
                        choice.delta[field] !== undefined &&
                        choice.delta[field].length > 0) {`;
  const c1to   = `if (choice.delta[field] !== null &&
                        choice.delta[field] !== undefined) {`;

  if (content.includes(c1from)) {
    content = content.replace(c1from, c1to);
    console.log('✅ Change 1 applied: Removed length > 0 filter on reasoning fields');
  } else if (content.includes(c1to) && !content.includes(c1from)) {
    console.log('⏭️  Change 1 already applied, skipping');
  } else {
    console.warn('⚠️  Change 1: pattern not found, file may have different version');
  }

  // Change 2
  const c2from = `const nonEmptyThinkingBlocks = thinkingBlocks.filter((b) => b.thinking && b.thinking.trim().length > 0);`;
  const c2to   = `const nonEmptyThinkingBlocks = thinkingBlocks.filter((b) => (b.thinking && b.thinking.trim().length > 0) || b.thinkingSignature);`;

  if (content.includes(c2from)) {
    content = content.replace(c2from, c2to);
    console.log('✅ Change 2 applied: Keep thinking blocks with signature even if empty');
  } else if (content.includes(c2to) && !content.includes(c2from)) {
    console.log('⏭️  Change 2 already applied, skipping');
  } else {
    console.warn('⚠️  Change 2: pattern not found, file may have different version');
  }

  // Change 3: Add new block for DeepSeek V4 fallback
  // Check if already present
  const c3marker = `assistantMsg.reasoning_content = "";`;
  const c3insertBefore = `// Skip assistant messages that have no content and no tool calls.`;

  if (content.includes(c3marker)) {
    console.log('⏭️  Change 3 already applied, skipping');
  } else {
    const c3block = `            // DeepSeek V4 requires reasoning_content to be echoed back on ALL assistant
            // messages in thinking mode, even those with empty reasoning or no text.
            // Without this, multi-turn tool call chains fail with:
            // "The 'reasoning_content' in the thinking mode must be passed back to the API."
            if (!("reasoning_content" in assistantMsg) &&
                (model.id.startsWith("deepseek-v") || model.id.startsWith("deepseek-ch"))) {
                assistantMsg.reasoning_content = "";
            }

            // Skip assistant messages that have no content and no tool calls.`;

    if (content.includes(c3insertBefore)) {
      content = content.replace(c3insertBefore, c3block);
      console.log('✅ Change 3 applied: Added DeepSeek V4 fallback reasoning_content');
    } else {
      console.warn('⚠️  Change 3: anchor pattern not found, file may have different version');
    }
  }

  fs.writeFileSync(TARGET, content, 'utf-8');
  console.log('\n补丁应用完成。请重启 OpenClaw 网关。');
  console.log('如需还原: node patch/revert.js');
}

main().catch(console.error);
