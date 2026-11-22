import { formatSql, tokenizeSql } from './src/format.js';
import { checkSql } from './src/check.js';

const get = id => document.getElementById(id);
const input = get('input');
const output = get('output');
const message = get('message');
const copy = get('copy');
const download = get('download');
let editRevision = 0;
let fileRequest = 0;
let outputRevision = 0; // Avoid claiming that a stale async clipboard write copied the current SQL.
function changedSource() {
  editRevision++;
  invalidate();
}
const example = [
  "select u.id,u.name,u.email, count(o.id) as orders,sum(o.total) as revenue",
  "from users u left join orders o on u.id=o.user_id and o.status='paid'",
  "where u.active=true and u.created_at>='2026-01-01'",
  "group by u.id,u.name,u.email having count(o.id)>3",
  "order by revenue desc limit 25;",
  "",
  "-- Comments and strings should be kept as written",
  "select 'FROM clause; SELECT *' as example, coalesce(null,'a,b') as fallback;",
].join('\n');

function setMessage(text, cls = '') {
  message.textContent = text;
  message.className = cls;
}
function getOptions() {
  return { keywordCase: get('keyword-case').value, indent: Number(get('indent').value) };
}
function updateStats() {
  get('input-stats').textContent = input.value.length.toLocaleString() + ' characters';
  get('output-stats').textContent = output.value.trim()
    ? output.value.trimEnd().split(/\r\n?|\n/).length.toLocaleString() + ' lines' : '0 lines';
}
function invalidate() {
  outputRevision++;
  output.value = '';
  copy.disabled = download.disabled = true;
  get('output-hint').textContent = 'Ready to format';
  updateStats();
}
function format() {
  if (!input.value.trim()) {
    invalidate();
    setMessage('Paste SQL or open a local file to begin.', 'error');
    return;
  }
  try {
    const formatted = formatSql(input.value, getOptions());
    outputRevision++;
    output.value = formatted;
    get('output-hint').textContent = 'Formatted without changing quoted text';
    copy.disabled = download.disabled = !output.value;
    setMessage('Formatted ' + tokenizeSql(input.value).length.toLocaleString() + ' SQL tokens locally.', 'success');
    updateStats();
  } catch (error) {
    invalidate();
    setMessage(error.message, 'error');
  }
}
get('format').addEventListener('click', format);
get('check-format').addEventListener('click', () => {
  // Read-only check: neither SQL editor nor formatted-output preview changes.
  // Report coordinates and lengths only; do not echo confidential SQL text.
  if (!input.value.trim()) {
    setMessage('Paste SQL or open a local file before checking formatting.', 'error');
    return;
  }
  try {
    const result = checkSql(input.value, getOptions());
    if (result.unchanged) {
      setMessage('Formatting check passed. The input already matches the selected style.', 'success');
    } else {
      const { line, column } = result.firstDifference;
      setMessage('Formatting differs at line ' + line + ', column ' + column +
        ' (original: ' + result.originalLength + ' characters; canonical: ' +
        result.formattedLength + '). The input was not changed.', 'error');
    }
  } catch (error) {
    setMessage('Formatting check failed: ' +
      (error instanceof Error ? error.message : 'Invalid SQL input.'), 'error');
  }
});
get('sample').addEventListener('click', () => {
  input.value = example;
  changedSource();
  format();
});
get('clear').addEventListener('click', () => {
  input.value = '';
  changedSource();
  setMessage('Editor cleared. Paste a new SQL query.');
  input.focus();
});
input.addEventListener('input', () => {
  changedSource();
  setMessage('Press Format SQL or Ctrl / ⌘ + Enter when ready.');
});
for (const id of ['keyword-case', 'indent']) {
  get(id).addEventListener('change', () => {
    if (input.value.trim()) format();
  });
}
document.addEventListener('keydown', event => {
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
    event.preventDefault();
    format();
  }
});
get('file').addEventListener('change', async event => {
  const selected = event.target.files?.[0];
  // Allow choosing the same file again after editing or a failed import.
  event.target.value = '';
  if (!selected) return;
  const request = ++fileRequest;
  const revision = editRevision;
  if (selected.size > 1_000_000) {
    setMessage('Please choose a SQL file smaller than 1 MB.', 'error');
    return;
  }
  try {
    const bytes = await selected.arrayBuffer();
    // The user can change the SQL, clear it, or select a newer file while
    // File.arrayBuffer() is pending. Never overwrite newer editor content.
    if (request !== fileRequest) return;
    if (revision !== editRevision) {
      setMessage('The editor changed while the file was being read. Import cancelled to preserve your edits.', 'error');
      return;
    }
    if (bytes.byteLength > 1_000_000) {
      throw new RangeError('SQL file exceeds the 1 MB input limit.');
    }
    const decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    input.value = decoded;
    changedSource();
    format();
  } catch (error) {
    if (request === fileRequest && revision === editRevision) {
      setMessage(error instanceof RangeError ? error.message :
        'Could not read the file as valid UTF-8 SQL.', 'error');
    }
  }
});
copy.addEventListener('click', async () => {
  if (!output.value) return;
  const revision = outputRevision;
  const snapshot = output.value;
  try {
    await navigator.clipboard.writeText(snapshot);
    if (revision !== outputRevision) {
      setMessage('Copy finished for a previous formatted result. The clipboard may still contain outdated SQL.', 'error');
      return;
    }
    setMessage('Formatted SQL copied to the clipboard.', 'success');
  } catch {
    if (revision !== outputRevision) return;
    output.focus();
    output.select();
    setMessage('Clipboard access was blocked. The output is selected for manual copying.', 'error');
  }
});
download.addEventListener('click', () => {
  if (!output.value) return;
  const blob = new Blob([output.value], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'formatted.sql';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
updateStats();
