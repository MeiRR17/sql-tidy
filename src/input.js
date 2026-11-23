/**
 * Bounded binary SQL input for the CLI. Reject invalid UTF-8 rather than
 * silently replacing bytes that might be part of a SQL literal or comment.
 *
 * Input is kept within one megabyte even when the source is a pipe or an
 * unbounded stream. The formatter enforces its separate 250k-character limit.
 */
const MAX_INPUT_BYTES = 1_000_000;
const decoder = new TextDecoder('utf-8', { fatal: true });

export async function readSqlStream(stream) {
  const chunks = [];
  let total = 0;
  for await (const chunk of stream) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += bytes.length;
    if (total > MAX_INPUT_BYTES) {
      throw new RangeError('SQL input exceeds the 1 MB CLI byte limit.');
    }
    chunks.push(bytes);
  }
  try {
    return decoder.decode(Buffer.concat(chunks, total));
  } catch {
    throw new TypeError('SQL input is not valid UTF-8.');
  }
}
