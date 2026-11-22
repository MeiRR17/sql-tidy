# SQL Tidy

A dependency-free SQL formatter for the browser, Node.js, and the command line. It adds readable whitespace and normalizes recognized keywords while preserving quoted strings, quoted identifiers, parameters, and SQL comments.

## Browser

Serve this repository as a static site. You can run a local server from the repository root:

    python3 -m http.server 8000

Open http://localhost:8000. Paste SQL, click **Format SQL** (or Ctrl / Cmd + Enter), select keyword casing and indentation, then copy or download the result. A sample query is included. SQL files up to 1 MB may be imported locally. Browser import uses strict UTF-8 decoding and rejects malformed bytes instead of silently replacing SQL characters. If the SQL editor is modified or another file is selected while a file is being read, the earlier import is cancelled rather than overwriting newer edits. The browser app makes no network requests with your SQL.

## Node.js API

Requires Node.js 22 or newer. No installation of external dependencies is required.

    import { formatSql, tokenizeSql } from './src/format.js';
    const formatted = formatSql('select id,name from users where active=true;', {
      keywordCase: 'upper',
      indent: 2,
    });

Keyword case may be upper (default), lower, or preserve. Indentation may be 2 (default) or 4 spaces.

Read-only formatting checks are also available:

    import { checkSql } from './src/check.js';
    const result = checkSql('select * from users;', { keywordCase: 'upper', indent: 2 });
    if (!result.unchanged) console.error(result.firstDifference);

The package exposes this API as the `sql-tidy/check` export subpath. `firstDifference` reports an index, line and column, not SQL contents.

## CLI

Invoke the CLI directly with Node.js:

    node bin/sql-tidy.js --help
    node bin/sql-tidy.js query.sql
    node bin/sql-tidy.js --lower --indent=4 query.sql
    node bin/sql-tidy.js query.sql -o formatted.sql
    cat query.sql | node bin/sql-tidy.js --json
    node bin/sql-tidy.js --check query.sql

Available flags: --upper, --lower, --preserve, --indent=2, --indent=4, --json, **--check**, -o/--output, **--force**, -h/--help. By default, formatted SQL goes to stdout; diagnostics go to stderr. `--check` compares the original SQL to SQL Tidy's canonical formatting **without writing a file or printing SQL contents**. It reports the first mismatching line/column. Exit codes in check mode: **0** already formatted, **1** differs, **2** invalid input or runtime error. `--check` cannot be combined with `--json` or `--output`. Output files are created exclusively (`wx`), so existing files are **never overwritten by default**. To replace an unrelated output file explicitly, use `--force --output path.sql`; `--force` without `--output` is an error. Even with force, the CLI refuses output paths that resolve to the input through a relative path, symbolic link or hard link. `--check` cannot be combined with `--force`.

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
- src/check.js — read-only formatting compliance API for CI
- src/input.js — bounded, strict UTF-8 CLI input reader
- bin/sql-tidy.js — Node.js CLI
- package.json — ESM package metadata
- LICENSE — MIT license

## Author

Built by Meir Dvir · https://github.com/MeiRR17
