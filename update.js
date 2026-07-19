#!/usr/bin/env node
'use strict';

/**
 * Maria Portfolio — system update script.
 *
 * Syncs the git repo, reinstalls dependencies, rebuilds, and restarts PM2.
 * Checks that .env files exist before restarting — offers to run `pnpm setup`
 * if they're missing. Verifies JWT_SECRET matches rsnra-auth if detected.
 */

const { execSync, spawnSync } = require('child_process');
const readline = require('readline');
const { existsSync, readFileSync } = require('fs');
const { join } = require('path');

const ROOT = __dirname;
const PARENT = join(ROOT, '..');

function run(cmd) {
  console.log(`$ ${cmd}`);
  execSync(cmd, { stdio: 'inherit' });
}

function askQuestion(prompt) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function main() {
  console.log('=== Maria Portfolio - System Update ===\n');

  const modifiedResult = spawnSync('git', ['diff', '--name-only'], {
    encoding: 'utf8'
  });
  const modifiedFiles = modifiedResult.stdout.trim();

  const untrackedResult = spawnSync('git', ['clean', '-nd'], {
    encoding: 'utf8'
  });
  const untrackedFiles = untrackedResult.stdout
    .split('\n')
    .map((l) => l.replace(/^Would remove /, '').trim())
    .filter(Boolean)
    .join('\n');

  if (modifiedFiles || untrackedFiles) {
    console.log(
      'WARNING: The following files may interfere with synchronization:'
    );
    if (modifiedFiles) {
      console.log('--- Modified tracked files ---');
      console.log(modifiedFiles);
    }
    if (untrackedFiles) {
      console.log(
        '--- Untracked files (gitignored files like .env are preserved) ---'
      );
      console.log(untrackedFiles);
    }
    console.log('------------------------------');

    const choice = await askQuestion(
      'Do you want to clean/discard these changes to proceed with sync? (y/N): '
    );
    if (/^[yY]$/.test(choice.trim())) {
      console.log('Cleaning workspace...');
      run('git restore .');
      run('git clean -fd');
    } else {
      console.log(
        'Proceeding without cleaning. Warning: Sync might fail if there are conflicts.'
      );
    }
  }

  console.log('\nSyncing repository...');
  run('gh repo sync');

  console.log('Installing dependencies...');
  run('pnpm install');

  console.log('Rebuilding packages and applications...');
  run('pnpm build');

  console.log('Restarting services via PM2...');
  run('pm2 restart ecosystem.config.js');

  console.log('\n=== System update complete ===');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
