import "../lib/server-only.ts";

type ReadLimitedJsonResponseOptions = {
  signal?: AbortSignal;
};

function createAbortError(): Error {
  const error = new Error("Provider response body read aborted");
  error.name = "AbortError";
  return error;
}

async function readChunk(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  signal?: AbortSignal,
): Promise<ReadableStreamReadResult<Uint8Array>> {
  if (!signal) {
    return reader.read();
  }

  if (signal.aborted) {
    await reader.cancel().catch(() => undefined);
    throw createAbortError();
  }

  return new Promise((resolve, reject) => {
    const abortRead = () => {
      reader.cancel().catch(() => undefined);
      reject(createAbortError());
    };

    signal.addEventListener("abort", abortRead, { once: true });
    reader.read().then(resolve, reject).finally(() => {
      signal.removeEventListener("abort", abortRead);
    });
  });
}

export async function readLimitedJsonResponse(
  response: Response,
  maxBytes: number,
  options: ReadLimitedJsonResponseOptions = {},
): Promise<unknown> {
  const reader = response.body?.getReader();

  if (!reader) {
    throw new Error("Provider response body unavailable");
  }

  const chunks: Uint8Array[] = [];
  let receivedBytes = 0;

  while (true) {
    const { done, value } = await readChunk(reader, options.signal);

    if (done) {
      break;
    }

    if (!value) {
      continue;
    }

    receivedBytes += value.byteLength;

    if (receivedBytes > maxBytes) {
      await reader.cancel();
      throw new Error("Provider response exceeded the configured byte limit");
    }

    chunks.push(value);
  }

  return JSON.parse(Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString("utf8"));
}
