import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateTextWithGemini } from "./gemini";

function buildSuccessResponse(text: string) {
  return new Response(
    JSON.stringify({
      candidates: [
        {
          content: {
            parts: [{ text }],
          },
        },
      ],
    }),
    {
      status: 200,
      headers: { "content-type": "application/json" },
    }
  );
}

describe("generateTextWithGemini", () => {
  const originalApiKey = process.env.GEMINI_API_KEY;
  const originalSummaryModel = process.env.GEMINI_SUMMARY_MODEL;

  beforeEach(() => {
    process.env.GEMINI_API_KEY = "test-key";
    delete process.env.GEMINI_SUMMARY_MODEL;
    vi.restoreAllMocks();
  });

  afterEach(() => {
    if (originalApiKey === undefined) {
      delete process.env.GEMINI_API_KEY;
    } else {
      process.env.GEMINI_API_KEY = originalApiKey;
    }

    if (originalSummaryModel === undefined) {
      delete process.env.GEMINI_SUMMARY_MODEL;
    } else {
      process.env.GEMINI_SUMMARY_MODEL = originalSummaryModel;
    }
  });

  it("uses the primary model without retries when the first call succeeds", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(buildSuccessResponse("first response"));

    const result = await generateTextWithGemini({ prompt: "hello" });

    expect(result).toEqual({
      model: "gemini-2.5-flash-lite",
      text: "first response",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toContain("models/gemini-2.5-flash-lite:generateContent");
  });

  it("sends minimized thinking config for summary-style requests", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(buildSuccessResponse("first response"));

    await generateTextWithGemini({
      prompt: "hello",
      thinkingMode: "minimize",
    });

    const requestInit = fetchMock.mock.calls[0]?.[1];
    const body =
      requestInit && typeof requestInit === "object" && "body" in requestInit
        ? JSON.parse(String(requestInit.body))
        : null;

    expect(body?.generationConfig?.thinkingConfig).toEqual({
      thinkingBudget: 0,
    });
  });

  it("falls back to the next model on 429 responses", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: "quota exceeded" } }), {
          status: 429,
          headers: { "content-type": "application/json" },
        })
      )
      .mockResolvedValueOnce(buildSuccessResponse("second response"));

    const result = await generateTextWithGemini({ prompt: "hello" });

    expect(result).toEqual({
      model: "gemini-flash-latest",
      text: "second response",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[0]).toContain("models/gemini-2.5-flash-lite:generateContent");
    expect(fetchMock.mock.calls[1]?.[0]).toContain("models/gemini-flash-latest:generateContent");
  });

  it("falls back when the error body says resource exhausted", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response("RESOURCE_EXHAUSTED: try a different model", {
          status: 503,
          headers: { "content-type": "text/plain" },
        })
      )
      .mockResolvedValueOnce(buildSuccessResponse("second response"));

    const result = await generateTextWithGemini({ prompt: "hello" });

    expect(result).toEqual({
      model: "gemini-flash-latest",
      text: "second response",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("falls back when the model is temporarily unavailable", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: {
              code: 503,
              message: "This model is currently experiencing high demand.",
              status: "UNAVAILABLE",
            },
          }),
          {
            status: 503,
            headers: { "content-type": "application/json" },
          }
        )
      )
      .mockResolvedValueOnce(buildSuccessResponse("second response"));

    const result = await generateTextWithGemini({ prompt: "hello" });

    expect(result).toEqual({
      model: "gemini-flash-latest",
      text: "second response",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("falls back to the next model on transient fetch errors", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(buildSuccessResponse("second response"));

    const result = await generateTextWithGemini({ prompt: "hello" });

    expect(result).toEqual({
      model: "gemini-flash-latest",
      text: "second response",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry for non-quota failures", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response("internal error", {
          status: 500,
          headers: { "content-type": "text/plain" },
        })
      );

    await expect(generateTextWithGemini({ prompt: "hello" })).rejects.toThrow("internal error");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
