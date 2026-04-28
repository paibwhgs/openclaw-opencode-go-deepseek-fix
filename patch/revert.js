/**
 * Revert the DeepSeek V4 reasoning_content fix.
 *
 * Restores the original openai-completions.js from the .bak backup.
 *
 * Usage: node patch/revert.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TARGET = path.resolve(
  process.env.APPDATA || process.env.HOME,
  'npm/node_modules/openclaw/node_modules/@mariozechner/pi-ai/dist/providers/openai-completions.js'
);
const BACKUP = TARGET + '.bak';

function main() {
  if (!fs.existsSync(BACKUP)) {
    console.error('备份文件不存在:', BACKUP);
    console.log('请通过 npm install -g openclaw@2026.3.31 重新安装来还原。');
    process.exit(1);
  }

  fs.copyFileSync(BACKUP, TARGET);
  console.log('✅ 已从备份还原:', TARGET);
  console.log('请重启 OpenClaw 网关。');
}

main();
