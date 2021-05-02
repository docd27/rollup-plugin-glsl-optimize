import {TextDecoder} from 'util';
import {once} from 'events';

/**
 * @internal
 * @param {import('stream').Writable} outputStream
 */
export function chunkWriterAsync(outputStream) {
  outputStream.setDefaultEncoding('utf8');
  outputStream.addListener('error', (err) => {
    throw new Error(`Output stream error: ${err?.message ?? ''}`);
  });
  return {
    write: async (strChunk) => {
      if (!outputStream.write(strChunk, 'utf8')) {
        await once(outputStream, 'drain');
      }
    },
    done: async () => {
      outputStream.end();
      // Wait until flushed
      await once(outputStream, 'finish');
    },
  };
}

/**
 * @internal
 * @param {import('stream').Writable} stream
 * @param {string} lines
 */
export async function writeLines(stream, lines) {
  const chunkWriter = chunkWriterAsync(stream);
  // TODO: write large files in multiple chunks
  await chunkWriter.write(lines);
  await chunkWriter.done();
}

/**
 * @internal
 * @param {import('stream').Readable} stream
 */
export async function* parseLines(stream) {
  stream.addListener('error', (err) => {
    throw new Error(`Input stream error: ${err?.message ?? ''}`);
  });
  const utf8Decoder = new TextDecoder('utf-8');
  let outputBuffer = Buffer.from([]);
  let outputBufferPos = 0;
  for await (const chunk of stream) {
    outputBuffer = outputBuffer.length > 0 ? Buffer.concat([outputBuffer, chunk]) : chunk;
    while (outputBufferPos < outputBuffer.length) {
      if (outputBuffer[outputBufferPos] === 0xA) { // newline
        const outputEndPos = (outputBufferPos > 0 && outputBuffer[outputBufferPos-1] === 0xD) ? // Drop CR before LF
          outputBufferPos - 1 : outputBufferPos;
        const nextChunk = outputBuffer.slice(0, outputEndPos);
        outputBuffer = outputBuffer.slice(outputBufferPos+1);
        outputBufferPos = 0;
        const nextChunkString = utf8Decoder.decode(nextChunk, {stream: false});
        yield nextChunkString;
      } else {
        outputBufferPos++;
      }
    }
  }
  if (outputBuffer.length > 0) { // Trailing string
    const nextChunkString = utf8Decoder.decode(outputBuffer, {stream: false});
    yield nextChunkString;
  }
}

/**
 * @internal
 * @param {AsyncGenerator<string, void, void>} lines
 */
export async function bufferLines(lines) {
  const output = [];
  for await (const line of lines) {
    output.push(line);
  }
  return output;
}

/* c8 ignore start */
/**
 * @internal
 * @param {AsyncGenerator<string, void, void>} lines
 */
export async function bufferAndOutLines(lines, prefix = '') {
  const output = [];
  for await (const line of lines) {
    output.push(line);
    console.log(`${prefix}${line}`);
  }
  return output;
}

/**
 * @internal
 * @param {AsyncGenerator<string, void, void>} lines
 */
export async function bufferAndErrLines(lines, prefix = '') {
  const output = [];
  for await (const line of lines) {
    output.push(line);
    console.error(`${prefix}${line}`);
  }
  return output;
}
/* c8 ignore stop */
