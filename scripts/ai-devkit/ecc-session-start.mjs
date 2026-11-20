import { statSync, realpathSync } from 'node:fs';
import { join, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

const eccDirectory = fileURLToPath(new URL('../../docs/ecc/', import.meta.url));
const requiredDocs = ['REQUIREMENTS.md', 'PLAN.md', 'PROGRESS.md'];

async function sessionStartContext() {
  let input = '';
  process.stdin.setEncoding('utf8');
  for await (const chunk of process.stdin) {
    input += chunk;
    if (input.length > 64 * 1024) return;
  }

  const event = JSON.parse(input);
  if (event?.hook_event_name !== 'SessionStart' || !['startup', 'resume'].includes(event.source)) return;
  if (typeof event.cwd !== 'string' || !isAbsolute(event.cwd)) return;
  if (realpathSync(event.cwd) !== realpathSync(eccDirectory)) return;
  if (!requiredDocs.every(file => statSync(join(eccDirectory, file)).isFile())) return;

  return {
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: 'For ECC integration, reread docs/ecc/REQUIREMENTS.md, docs/ecc/PLAN.md and docs/ecc/PROGRESS.md before each stage and after compaction. Use the latest user command to determine whether the next stage is authorized.',
    },
  };
}

try {
  const output = await sessionStartContext();
  if (output) console.log(JSON.stringify(output));
} catch {
  // The reminder is optional. Skip invalid input or missing checkpoints without logging them.
}
