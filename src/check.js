import { formatSql } from './format.js';

/**
 * Check whether SQL text is already in the format produced by SQL Tidy.
 * No changes are written to disk. The result deliberately omits snippets
 * from the SQL source so CI logs don't accidentally disclose query contents.
 */
export function checkSql(sql, options = {}) {
  const formatted = formatSql(sql, options);
  const unchanged = formatted === sql;
  if (unchanged) return { unchanged: true, firstDifference: null };

  const n = Math.min(sql.length, formatted.length);
  let index = 0, line = 1, column = 1;
  while (index < n && sql[index] === formatted[index]) {
    if (sql[index] === '\n') {
      line++;
      column = 1;
    } else column++;
    index++;
  }
  return {
    unchanged: false,
    firstDifference: { index, line, column },
    originalLength: sql.length,
    formattedLength: formatted.length,
  };
}
