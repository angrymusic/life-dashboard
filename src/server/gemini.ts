const DEFAULT_SUMMARY_MODEL = "gemini-2.5-flash-lite";
const SUMMARY_MODEL_FALLBACK_CHAIN = [
  "gemini-2.5-flash",
  "gemini-2.5-pro",
  "gemini-2.5-flash-lite",
  "gemini-flash-latest",
  "gemini-flash-lite-latest",
  "gemini-pro-latest",
] as const;
const GEMINI_DEBUG_ENABLED = process.env.DEBUG_GEMINI_SUMMARY === "1";

type GenerateTextOptions = {
  prompt: string;
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
  thinkingMode?: "default" | "minimize";
};

type GeminiRequestError = Error & {
  status?: number;
  detail?: string;
};

function debugGemini(event: string, payload: Record<string, unknown>) {
  if (!GEMINI_DEBUG_ENABLED) return;
  console.log(`[gemini] ${event}`, payload);
}

function buildThinkingConfig(
  model: string,
  thinkingMode: GenerateTextOptions["thinkingMode"],
) {
  if (thinkingMode !== "minimize") return undefined;

  const normalizedModel = model.toLowerCase();

  if (
    normalizedModel.includes("2.5-pro") ||
    normalizedModel.includes("pro-latest")
  ) {
    return undefined;
  }

  if (
    normalizedModel.includes("2.5-flash") ||
    normalizedModel.includes("2.5-flash-lite")
  ) {
    return {
      thinkingBudget: 0,
    };
  }

  if (
    normalizedModel.includes("gemini-3") ||
    normalizedModel.includes("flash-latest") ||
    normalizedModel.includes("flash-lite-latest")
  ) {
    return {
      thinkingLevel: "minimal",
    };
  }

  return undefined;
}

function extractUsageMetadata(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;
  const usage = (payload as { usageMetadata?: unknown }).usageMetadata;
  if (!usage || typeof usage !== "object") return null;
  const metadata = usage as {
    promptTokenCount?: unknown;
    candidatesTokenCount?: unknown;
    thoughtsTokenCount?: unknown;
    totalTokenCount?: unknown;
  };
  return {
    promptTokenCount:
      typeof metadata.promptTokenCount === "number"
        ? metadata.promptTokenCount
        : null,
    candidatesTokenCount:
      typeof metadata.candidatesTokenCount === "number"
        ? metadata.candidatesTokenCount
        : null,
    thoughtsTokenCount:
      typeof metadata.thoughtsTokenCount === "number"
        ? metadata.thoughtsTokenCount
        : null,
    totalTokenCount:
      typeof metadata.totalTokenCount === "number"
        ? metadata.totalTokenCount
        : null,
  };
}

function extractResponseText(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;
  const candidates = (payload as { candidates?: unknown[] }).candidates;
  if (!Array.isArray(candidates)) return null;

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object") continue;
    const content = (candidate as { content?: { parts?: unknown[] } }).content;
    const parts = content?.parts;
    if (!Array.isArray(parts)) continue;
    const texts = parts
      .map((part) =>
        part &&
        typeof part === "object" &&
        typeof (part as { text?: unknown }).text === "string"
          ? (part as { text: string }).text
          : "",
      )
      .filter(Boolean);
    if (texts.length > 0) {
      return texts.join("\n").trim();
    }
  }

  return null;
}

function extractFinishReason(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;
  const candidates = (payload as { candidates?: unknown[] }).candidates;
  if (!Array.isArray(candidates)) return null;
  const first = candidates[0];
  if (!first || typeof first !== "object") return null;
  return typeof (first as { finishReason?: unknown }).finishReason === "string"
    ? (first as { finishReason: string }).finishReason
    : null;
}

function buildSummaryModelSequence(primaryModel: string) {
  const primaryIndex = SUMMARY_MODEL_FALLBACK_CHAIN.indexOf(
    primaryModel as (typeof SUMMARY_MODEL_FALLBACK_CHAIN)[number],
  );

  if (primaryIndex >= 0) {
    return SUMMARY_MODEL_FALLBACK_CHAIN.slice(primaryIndex);
  }

  return [primaryModel, ...SUMMARY_MODEL_FALLBACK_CHAIN];
}

function shouldRetryWithFallback(error: unknown) {
  if (!(error instanceof Error)) return false;
  const requestError = error as GeminiRequestError;
  if (requestError.status === 429 || requestError.status === 503) {
    return true;
  }

  const message =
    `${requestError.detail ?? ""}\n${requestError.message}`.toLowerCase();
  return (
    message.includes("quota exceeded") ||
    message.includes("resource exhausted") ||
    message.includes("resource_exhausted") ||
    message.includes("unavailable") ||
    message.includes("deadline exceeded") ||
    message.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("fetch failed") ||
    message.includes("network error") ||
    message.includes("econnreset") ||
    message.includes("econnrefused") ||
    message.includes("etimedout")
  );
}

async function requestTextWithGemini({
  prompt,
  model,
  temperature,
  maxOutputTokens,
  apiKey,
  thinkingMode,
}: GenerateTextOptions & { model: string; apiKey: string }) {
  const thinkingConfig = buildThinkingConfig(model, thinkingMode);
  let response: Response;
  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
        apiKey,
      )}`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature,
            maxOutputTokens,
            ...(thinkingConfig ? { thinkingConfig } : {}),
          },
        }),
      },
    );
  } catch (error) {
    debugGemini("fetch_error", {
      model,
      promptLength: prompt.length,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    debugGemini("http_error", {
      model,
      status: response.status,
      detail,
    });
    const error = new Error(
      detail || `Gemini request failed: ${response.status}`,
    ) as GeminiRequestError;
    error.status = response.status;
    error.detail = detail;
    throw error;
  }

  const payload = (await response.json()) as unknown;
  const finishReason = extractFinishReason(payload);
  const usageMetadata = extractUsageMetadata(payload);
  const text = extractResponseText(payload);
  debugGemini("response", {
    model,
    finishReason,
    usageMetadata,
    promptLength: prompt.length,
    textLength: text?.length ?? 0,
    textPreview: text?.slice(0, 200) ?? "",
  });
  if (!text) {
    throw new Error("Gemini returned an empty response");
  }

  return {
    model,
    text,
  };
}

export async function generateTextWithGemini({
  prompt,
  model,
  temperature = 0.3,
  maxOutputTokens = 500,
  thinkingMode = "default",
}: GenerateTextOptions) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY");
  }

  const primaryModel =
    process.env.GEMINI_SUMMARY_MODEL?.trim() || model || DEFAULT_SUMMARY_MODEL;
  const modelSequence = buildSummaryModelSequence(primaryModel);
  let lastError: unknown = null;

  for (let index = 0; index < modelSequence.length; index += 1) {
    const candidateModel = modelSequence[index];
    try {
      return await requestTextWithGemini({
        prompt,
        model: candidateModel,
        temperature,
        maxOutputTokens,
        apiKey,
        thinkingMode,
      });
    } catch (error) {
      lastError = error;
      const hasNextModel = index < modelSequence.length - 1;
      if (!hasNextModel || !shouldRetryWithFallback(error)) {
        throw error;
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Gemini request failed");
}
