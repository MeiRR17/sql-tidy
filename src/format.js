/**
 * Conservative SQL tokenizer and formatter with no external dependencies.
 * Literals, quoted identifiers, parameters and comments are emitted verbatim.
 */
const MAX_LENGTH = 250_000;
const WORD_START = /[A-Za-z_\u0080-\uffff]/;
const WORD_BODY = /[A-Za-z0-9_$\u0080-\uffff]/;
const KEYWORDS = new Set(('SELECT DISTINCT ALL AS FROM WHERE GROUP BY ORDER HAVING LIMIT OFFSET FETCH FIRST NEXT ROWS ONLY ' +
  'JOIN INNER LEFT RIGHT FULL OUTER CROSS NATURAL ON USING AND OR NOT NULL IS IN EXISTS BETWEEN LIKE ILIKE ' +
  'INSERT INTO VALUES UPDATE SET DELETE RETURNING WITH RECURSIVE UNION INTERSECT EXCEPT CASE WHEN THEN ' +
  'ELSE END ASC DESC NULLS LAST TRUE FALSE COUNT SUM AVG MIN MAX COALESCE CAST OVER PARTITION ' +
  'CREATE TABLE VIEW DROP ALTER ADD PRIMARY KEY REFERENCES DEFAULT IF TOP FOR').split(' '));

const CLAUSES = [
  ['LEFT', 'OUTER', 'JOIN'], ['RIGHT', 'OUTER', 'JOIN'], ['FULL', 'OUTER', 'JOIN'],
  ['LEFT', 'JOIN'], ['RIGHT', 'JOIN'], ['FULL', 'JOIN'], ['INNER', 'JOIN'],
  ['CROSS', 'JOIN'], ['NATURAL', 'JOIN'], ['GROUP', 'BY'], ['ORDER', 'BY'],
  ['UNION', 'ALL'], ['INSERT', 'INTO'], ['DELETE', 'FROM'],
  ['SELECT'], ['FROM'], ['WHERE'], ['HAVING'], ['LIMIT'], ['OFFSET'],
  ['RETURNING'], ['JOIN'], ['ON'], ['VALUES'], ['UPDATE'], ['SET'],
  ['UNION'], ['EXCEPT'], ['INTERSECT'], ['WITH'],
];

/** Tokenize SQL without rewriting literal or quoted contents. */
export function tokenizeSql(source) {
  if (typeof source !== 'string') throw new TypeError('SQL must be text.');
  if (source.length > MAX_LENGTH) throw new RangeError('SQL exceeds 250,000 characters.');
  const tokens = [];
  let i = 0;
  const emit = (type, end) => { tokens.push({ type, value: source.slice(i, end) }); i = end; };
  while (i < source.length) {
    const char = source[i], next = source[i + 1];
    if (/\s/.test(char)) { i++; continue; }
    if ((char === '-' && next === '-') || char === '#') {
      let j = i + (char === '#' ? 1 : 2);
      while (j < source.length && !/[\r\n]/.test(source[j])) j++;
      emit('line-comment', j); continue;
    }
    if (char === '/' && next === '*') {
      let j = i + 2, depth = 1;
      while (j < source.length && depth) {
        if (source.slice(j, j + 2) === '/*') { depth++; j += 2; }
        else if (source.slice(j, j + 2) === '*/') { depth--; j += 2; }
        else j++;
      }
      if (depth) throw new SyntaxError('Unterminated block comment.');
      emit('block-comment', j); continue;
    }
    if (char === '$') {
      const marker = /^(?:\$[A-Za-z_][A-Za-z0-9_]*\$|\$\$)/.exec(source.slice(i));
      if (marker) {
        const end = source.indexOf(marker[0], i + marker[0].length);
        if (end < 0) throw new SyntaxError('Unterminated dollar-quoted string.');
        emit('quoted', end + marker[0].length); continue;
      }
      if (/\d/.test(next || '')) {
        let j = i + 2; while (j < source.length && /\d/.test(source[j])) j++;
        emit('parameter', j); continue;
      }
    }
    if (char === "'" || char === '"' || char.charCodeAt(0) === 96 || char === '[') {
      const close = char === '[' ? ']' : char;
      let j = i + 1, ended = false;
      while (j < source.length) {
        if (source[j] === close) {
          if (source[j + 1] === close) { j += 2; continue; }
          ended = true; j++; break;
        }
        if (char !== '[' && source[j] === '\\' && j + 1 < source.length) { j += 2; continue; }
        j++;
      }
      if (!ended) throw new SyntaxError('Unterminated quoted string or identifier.');
      emit('quoted', j); continue;
    }
    if (WORD_START.test(char)) {
      let j = i + 1; while (j < source.length && WORD_BODY.test(source[j])) j++;
      emit('word', j); continue;
    }
    if (/\d/.test(char)) {
      let j = i + 1; while (j < source.length && /[\d.eE]/.test(source[j])) j++;
      emit('number', j); continue;
    }
    if (char === '?' || ((char === ':' || char === '@') && WORD_START.test(next || ''))) {
      let j = i + 1; while (j < source.length && WORD_BODY.test(source[j])) j++;
      emit('parameter', j); continue;
    }
    if ('(),.;'.includes(char)) { emit('punct', i + 1); continue; }
    if ('=<>!~|&^+*/%:-'.includes(char)) {
      let j = i + 1;
      while (j < source.length && '=<>!~|&^+*/%:-'.includes(source[j])) j++;
      emit('operator', j); continue;
    }
    emit('symbol', i + 1);
  }
  return tokens;
}
const upper = token => token.value.toUpperCase();
function clauseAt(tokens, index) {
  return CLAUSES.find(phrase => phrase.every((word, offset) =>
    tokens[index + offset]?.type === 'word' && upper(tokens[index + offset]) === word)) || null;
}
const casing = (value, selected) => selected === 'upper' ? value.toUpperCase() :
  selected === 'lower' ? value.toLowerCase() : value;

/**
 * Format whitespace and recognized keywords without changing quoted SQL.
 * @param {string} sql
 * @param {{keywordCase?: 'upper'|'lower'|'preserve', indent?: 2|4}} options
 */
export function formatSql(sql, options = {}) {
  if (options === null || typeof options !== 'object' || Array.isArray(options))
    throw new TypeError('Options must be an object.');
  const keywordCase = options.keywordCase ?? 'upper';
  const indent = options.indent ?? 2;
  if (!['upper', 'lower', 'preserve'].includes(keywordCase)) throw new RangeError('Invalid keyword case.');
  if (indent !== 2 && indent !== 4) throw new RangeError('Indent must be 2 or 4 spaces.');
  const tokens = tokenizeSql(sql);
  if (!tokens.length) return '';

  const lines = [], parens = [];
  let line = '', level = 0, section = '', last = '';
  const extra = () => ['SELECT', 'SET', 'GROUP BY', 'ORDER BY', 'RETURNING', 'VALUES', 'WITH'].includes(section) ? 1 : 0;
  function finish(blank = false) {
    if (line.trim()) lines.push(line.trimEnd());
    line = ''; last = '';
    if (blank && lines[lines.length - 1] !== '') lines.push('');
  }
  function put(value, space = true, extraIndent = extra()) {
    if (!line) line = ' '.repeat(Math.max(0, level + extraIndent) * indent) + value;
    else line += (space ? ' ' : '') + value;
    last = value;
  }

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i], value = token.value;
    const prev = tokens[i - 1], next = tokens[i + 1];
    if (token.type === 'line-comment') { put(value); finish(); continue; }
    if (token.type === 'block-comment') { put(value); if (/[\r\n]/.test(value)) finish(); continue; }
    if (value === ';') { put(';', false); finish(true); section = ''; continue; }
    if (value === '(') {
      const subquery = next?.type === 'word' && ['SELECT', 'WITH'].includes(upper(next));
      const spaced = prev?.type === 'word' && ['IN', 'EXISTS', 'AS', 'VALUES', 'FROM', 'JOIN'].includes(upper(prev));
      put('(', Boolean(spaced));
      parens.push(subquery);
      if (subquery) { finish(); level++; section = ''; }
      continue;
    }
    if (value === ')') {
      const subquery = parens.pop() ?? false;
      if (subquery) { finish(); level = Math.max(0, level - 1); section = ''; put(')', false, 0); }
      else put(')', false);
      continue;
    }
    if (value === ',') {
      put(',', false);
      if (!parens.length && ['SELECT', 'SET', 'GROUP BY', 'ORDER BY', 'RETURNING', 'WITH'].includes(section)) finish();
      continue;
    }
    if (value === '.') { put('.', false); continue; }

    if (token.type === 'word') {
      const clause = clauseAt(tokens, i);
      const nestedNormal = parens.includes(false);
      if (clause && !nestedNormal && prev?.value !== '.') {
        const name = clause.join(' ');
        finish();
        section = name;
        put(tokens.slice(i, i + clause.length).map(t => casing(t.value, keywordCase)).join(' '), false, 0);
        i += clause.length - 1;
        if (['SELECT', 'WITH'].includes(name)) finish();
        continue;
      }
      const word = KEYWORDS.has(upper(token)) ? casing(value, keywordCase) : value;
      const logical = ['AND', 'OR'].includes(upper(token)) &&
        ['WHERE', 'ON', 'HAVING'].includes(section) && !parens.length;
      if (logical) finish();
      const touch = last === '.' || last === '::' || last === '(';
      put(word, !touch, logical ? 1 : extra());
      continue;
    }
    if (token.type === 'operator') {
      put(value, !['::', '->', '->>'].includes(value));
      continue;
    }
    const touch = last === '.' || last === '::' || last === '(' || prev?.value === '.';
    put(value, !touch);
  }
  finish();
  while (lines[lines.length - 1] === '') lines.pop();
  return lines.join('\n') + '\n';
}
