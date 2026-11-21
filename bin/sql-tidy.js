#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { formatSql } from '../src/format.js';
import { checkSql } from '../src/check.js';

const HELP = [
  'sql-tidy — format SQL safely without changing quoted text',
  '',
  'Usage: sql-tidy [options] [file.sql]',
  '       cat query.sql | sql-tidy --lower --indent=4',
  '',
  'Options:',
  '  --upper       Uppercase recognized keywords (default)',
  '  --lower       Lowercase recognized keywords',
  '  --preserve    Keep keyword case from the input',
  '  --indent=2    Indent with 2 spaces (default)',
  '  --indent=4    Indent with 4 spaces',
  '  --json        Print {"formatted":"..."}',
  '  --check       Exit 1 if formatting differs, 0 if already formatted',
  '  -o, --output  Write to a file instead of stdout',
  '  -h, --help    Print usage information',
  '',
  'Check mode prints no SQL values. Exit codes: 0 pass, 1 differs, 2 error.',
].join('\n');

async function stdinText() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}
async function main(argv) {
  const options = { keywordCase: 'upper', indent: 2 };
  let input = '', output = '', json = false, help = false, check = false;
  for (let i = 0; i < argv.length; i++) {
    const value = argv[i];
    if (value === '--help' || value === '-h') help = true;
    else if (value === '--upper') options.keywordCase = 'upper';
    else if (value === '--lower') options.keywordCase = 'lower';
    else if (value === '--preserve') options.keywordCase = 'preserve';
    else if (value === '--indent=2') options.indent = 2;
    else if (value === '--indent=4') options.indent = 4;
    else if (value === '--json') json = true;
    else if (value === '--check') check = true;
    else if (value === '-o' || value === '--output') {
      output = argv[++i];
      if (!output) throw new Error('Missing output filename.');
    } else if (value.startsWith('-')) throw new Error('Unknown option: ' + value);
    else if (!input) input = value;
    else throw new Error('Only one input filename is supported.');
  }
  if (help) { process.stdout.write(HELP + '\n'); return; }
  if (check && (json || output)) throw new Error('--check cannot be combined with --json or --output.');
  if (output && input && output === input) throw new Error('Refusing to overwrite the input file.');
  if (!input && process.stdin.isTTY) throw new Error('Provide a file or pipe SQL through stdin.');
  const sql = input ? await readFile(input, 'utf8') : await stdinText();
  if (!sql.trim()) throw new Error('No SQL to format.');
  if (check) {
    const result = checkSql(sql, options);
    if (result.unchanged) {
      process.stdout.write('SQL Tidy: already formatted.\n');
    } else {
      const at = result.firstDifference;
      process.stderr.write('SQL Tidy: formatting differs at line ' + at.line + ', column ' + at.column + '.\n');
      process.exitCode = 1;
    }
    return;
  }
  const formatted = formatSql(sql, options);
  const result = json ? JSON.stringify({ formatted }) + '\n' : formatted;
  if (output) await writeFile(output, result, 'utf8');
  else process.stdout.write(result);
}

main(process.argv.slice(2)).catch(error => {
  process.stderr.write('sql-tidy: ' + error.message + '\n');
  process.exitCode = 2;
});
