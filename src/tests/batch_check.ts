import { spawn } from 'child_process';

const failed: string[] = [];
const args = process.argv.slice(2);
const contestStart = parseInt(args[0]) || 400;
const contestEnd = parseInt(args[1]) || 400; // Default to single contest if not provided
const problems = ['a', 'b', 'c', 'd', 'e', 'f'];

function runCommand(taskId: string): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn('pnpm', ['run', 'check', taskId], {
      stdio: ['ignore', 'ignore', 'ignore'],
    });

    child.on('close', (code) => {
      resolve(code ?? 1);
    });

    child.on('error', () => {
      resolve(1);
    });
  });
}

(async () => {
  console.log(`Starting check from abc${contestStart} to abc${contestEnd}...`);

  for (let i = contestStart; i <= contestEnd; i++) {
    const contestId = `abc${i}`;
    for (const p of problems) {
      const taskId = `${contestId}_${p}`;
      process.stdout.write(`Checking ${taskId}... `);

      await new Promise((r) => setTimeout(r, 1000));

      const code = await runCommand(taskId);

      if (code !== 0) {
        console.log('FAILED');
        failed.push(taskId);
      } else {
        console.log('OK');
      }
    }
  }

  console.log('\nSummary of failures:');
  if (failed.length > 0) {
    console.log(failed.join('\n'));
  } else {
    console.log('No errors found.');
  }
})();
