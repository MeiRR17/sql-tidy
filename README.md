# SQL Tidy

A dependency-free SQL formatter for the browser, Node.js, and the command line. It adds readable whitespace and normalizes recognized keywords while preserving quoted strings, quoted identifiers, parameters, and SQL comments.

## Browser

Serve this repository as a static site. You can run a local server from the repository root:

    python3 -m http.server 8000

Open http://localhost:8000. Paste SQL, click **Format SQL** (or Ctrl / Cmd + Enter), select keyword casing and indentation, then copy or download the result. Use **Check formatting** for a separate read-only comparison against the selected style; it reports pass/fail and first differing line/column plus text lengths **without changing either editor or echoing SQL values**. Afterwards the **Check JSON** button downloads an explicit content-free format report locally, without SQL source or formatted query. Editor edits or style setting changes disable the report until checked again. Coordinates and lengths can still reveal document structure. When formatting differs, **Go to difference** focuses the first mismatch in the original SQL editor, selecting one UTF-16 code unit (or placing the caret at EOF). This is navigation only: it does not rewrite SQL, reveal it in the status message, or change the formatted output. The action is disabled for passing checks and immediately invalidated by editor edits or style changes. Keyboard shortcuts: **Ctrl/Cmd+Enter** formats; **Ctrl/Cmd+Shift+Enter** performs the read-only formatting check. The check runs locally, and its status is replaced when you edit or format again. A sample query is included. SQL files up to 1 MB may be imported locally. Browser import uses strict UTF-8 decoding and rejects malformed bytes instead of silently replacing SQL characters. If the SQL editor is modified or another file is selected while a file is being read, the earlier import is cancelled rather than overwriting newer edits. The browser app makes no network requests with your SQL. A pending asynchronous clipboard copy retains its original output snapshot and revision: if the SQL is edited, cleared, or reformatted before the browser completes the copy, the UI warns that the clipboard may contain the earlier version rather than claiming the current output was copied. This cannot revoke a clipboard write that already happened.

## Node.js API

Requires Node.js 22 or newer. No installation of external dependencies is required.

    import { formatSql, tokenizeSql } from './src/format.js';
    const formatted = formatSql('select id,name from users where active=true;', {
      keywordCase: 'upper',
      indent: 2,
    });

Keyword case may be upper (default), lower, or preserve. Indentation may be 2 (default) or 4 spaces.

Read-only formatting checks are also available:

    import { checkSql, checkSqlReport } from './src/check.js';
    const result = checkSql('select * from users;', { keywordCase: 'upper', indent: 2 });
    if (!result.unchanged) console.error(result.firstDifference);
    const redacted = checkSqlReport('select * from users;', { keywordCase: 'upper', indent: 2 });
    // Metadata only; no source or formatted SQL text.

The package exposes these APIs as the `sql-tidy/check` export subpath. `checkSqlReport()` creates the same redacted JSON object used by the CLI and the browser's explicit Check JSON export. `firstDifference` reports an index, line and column, not SQL contents.

## CLI

Invoke the CLI directly with Node.js:

    node bin/sql-tidy.js --help
    node bin/sql-tidy.js query.sql
    node bin/sql-tidy.js --lower --indent=4 query.sql
    node bin/sql-tidy.js query.sql -o formatted.sql
    cat query.sql | node bin/sql-tidy.js --json
    node bin/sql-tidy.js --check query.sql
    node bin/sql-tidy.js --check --json query.sql

Available flags: --upper, --lower, --preserve, --indent=2, --indent=4, --json, **--check**, -o/--output, **--force**, -h/--help. By default, formatted SQL goes to stdout; diagnostics go to stderr. `--check` compares the original SQL to SQL Tidy's canonical formatting **without writing a file or printing SQL contents**. It reports the first mismatching line/column. Add `--json` to produce a machine-readable **redacted check report** with `unchanged`, the first differing index/line/column, source/formatted character lengths when different, and requested keyword-case/indent options. Unlike standalone `--json`, which intentionally prints formatted SQL, `--check --json` never includes source or formatted SQL. The check result goes to stdout whether formatting matches or differs; the exit status remains authoritative. Exit codes in check mode: **0** already formatted, **1** differs, **2** invalid input or runtime error. `--check` may be combined with `--json` for redacted CI metadata, but not with `--output`. Output files are created exclusively (`wx`), so existing files are **never overwritten by default**. To replace an unrelated output file explicitly, use `--force --output path.sql`; `--force` without `--output` is an error. Even with force, the CLI refuses output paths that resolve to the input through a relative path, symbolic link or hard link. `--check` cannot be combined with `--force`.

## Supported SQL forms

- Queries with SELECT, FROM, WHERE, JOIN, GROUP BY, ORDER BY, HAVING, LIMIT, OFFSET, UNION, INSERT, UPDATE, DELETE, RETURNING and WITH clauses.
- Common SQL quoted strings and identifiers (single/double quotes, bracket identifiers, backticks), PostgreSQL dollar-quoted strings and positional parameters, and named parameters.
- SQL line comments, block comments and nested block-comment delimiters.
- Scientific numeric literals such as `1e-3` and `2.5E+4`, leading-decimal values such as `.75`, and dialect-specific hexadecimal/binary integer literals are retained as single tokens rather than split around exponent signs.
- Prefix-quoted literals such as PostgreSQL `E'escaped'`, national string literals `N'text'` and Unicode quoted identifiers `U&"name"` are kept contiguous without inserting a semantic-changing space.
- Known PostgreSQL JSON/JSONPath operators `#>`, `#>>`, `#-`, `->`, `->>`, `@?`, `@@`, `@>`, `<@`, `?|` and `?&` are preserved as whole tokens rather than split into comments, positional parameters or multiple symbols.
- Parenthesized subqueries, function calls, clause indentation and keyword case options.
- Multiple SQL statements and semicolon-separated input.

## Limits

This formatter is intentionally conservative but does **not** parse or validate SQL semantics. Dialects differ in quoting and operator rules; review formatted results before using them in production. Standalone `#` remains ambiguous between dialects (for example MySQL comments and PostgreSQL operators). A leading `#-` is treated as a PostgreSQL JSONB operator, although MySQL may interpret `#` as a comment marker; users should not assume full MySQL/PostgreSQL dialect auto-detection or semantic equivalence for ambiguous syntax. SQL is never executed by the formatter. The formatter has not undergone the owner's separate centralized test cycle.

CLI input is bounded to **1 MB of UTF-8 bytes** while being read (including piped stdin) and rejects malformed UTF-8 instead of silently replacing bytes. A leading UTF-8 BOM is accepted. The formatter still limits decoded SQL to 250,000 characters. Malformed unclosed quotes or comments produce errors rather than partially rewritten SQL. Do not run SQL without reviewing it.

## Project structure

- index.html, styles.css, app.js — static browser interface
- src/format.js — lexer, formatter, public JavaScript exports
- src/check.js — read-only formatting check and content-free report shared by browser and CLI
- src/input.js — bounded, strict UTF-8 CLI input reader
- bin/sql-tidy.js — Node.js CLI
- package.json — ESM package metadata
- LICENSE — MIT license

## Author

Built by Meir Dvir · https://github.com/MeiRR17
