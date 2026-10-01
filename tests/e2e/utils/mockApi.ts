import type { Page, Request, Route } from "@playwright/test";
import { apiResponses, labPayload } from "../fixtures/testData";

type JsonObject = Record<string, unknown>;

type MockResponse = {
  delayMs?: number;
  headers?: Record<string, string>;
  json: JsonObject;
  status?: number;
};

type MockHandler = MockResponse | ((body: JsonObject, request: Request) => MockResponse | Promise<MockResponse>);

type MockGhostwriterApiOptions = {
  challenge?: MockHandler;
  feedback?: MockHandler;
  lab?: MockHandler;
  rewrite?: MockHandler;
  share?: MockHandler;
};

type CapturedRequest = {
  body: JsonObject;
  headers: Record<string, string>;
  method: string;
  url: string;
};

export type MockGhostwriterApi = {
  challengeRequests: CapturedRequest[];
  feedbackRequests: CapturedRequest[];
  labRequests: CapturedRequest[];
  rewriteRequests: CapturedRequest[];
  shareRequests: CapturedRequest[];
};

const defaultChallengeResponse: MockResponse = {
  json: {
    challengeToken: "playwright-challenge-token",
    difficulty: 0,
    error: null,
  },
  status: 200,
};

const defaultRewriteResponse: MockResponse = {
  headers: {
    "x-request-id": apiResponses.requestId,
  },
  json: {
    artifactToken: apiResponses.artifactToken,
    error: null,
    moodLabel: "starlit",
    rewrite: apiResponses.rewrite,
    shortId: null,
  },
  status: 200,
};

const defaultShareResponse: MockResponse = {
  json: {
    error: null,
    shortId: apiResponses.shareId,
  },
  status: 200,
};

const defaultFeedbackResponse: MockResponse = {
  json: {
    error: null,
  },
  status: 200,
};

const defaultLabResponse: MockResponse = {
  json: {
    error: null,
    lab: labPayload,
  },
  status: 200,
};

export function errorResponse(error: string, status = 500, requestId = "req-playwright-error"): MockResponse {
  return {
    headers: {
      "x-request-id": requestId,
    },
    json: {
      error,
      artifactToken: null,
      lab: null,
      moodLabel: null,
      rewrite: "",
      shortId: null,
    },
    status,
  };
}

async function requestBody(request: Request): Promise<JsonObject> {
  const postData = request.postData();

  if (!postData) {
    return {};
  }

  try {
    return JSON.parse(postData) as JsonObject;
  } catch {
    return {};
  }
}

async function fulfill(route: Route, response: MockResponse) {
  if (response.delayMs) {
    await new Promise((resolve) => setTimeout(resolve, response.delayMs));
  }

  await route.fulfill({
    body: JSON.stringify(response.json),
    contentType: "application/json",
    headers: response.headers,
    status: response.status ?? 200,
  });
}

async function registerRoute(
  page: Page,
  pattern: RegExp,
  captures: CapturedRequest[],
  fallback: MockResponse,
  handler?: MockHandler,
) {
  await page.route(pattern, async (route) => {
    const request = route.request();
    const body = await requestBody(request);

    captures.push({
      body,
      headers: request.headers(),
      method: request.method(),
      url: request.url(),
    });

    const response = typeof handler === "function" ? await handler(body, request) : handler ?? fallback;
    await fulfill(route, response);
  });
}

export async function mockGhostwriterApi(
  page: Page,
  options: MockGhostwriterApiOptions = {},
): Promise<MockGhostwriterApi> {
  const api: MockGhostwriterApi = {
    challengeRequests: [],
    feedbackRequests: [],
    labRequests: [],
    rewriteRequests: [],
    shareRequests: [],
  };

  await registerRoute(
    page,
    /\/api\/ghostwriter\/challenge(?:\?.*)?$/,
    api.challengeRequests,
    defaultChallengeResponse,
    options.challenge,
  );
  await registerRoute(
    page,
    /\/api\/ghostwriter\/share(?:\?.*)?$/,
    api.shareRequests,
    defaultShareResponse,
    options.share,
  );
  await registerRoute(
    page,
    /\/api\/ghostwriter\/feedback(?:\?.*)?$/,
    api.feedbackRequests,
    defaultFeedbackResponse,
    options.feedback,
  );
  await registerRoute(
    page,
    /\/api\/ghostwriter\/lab(?:\?.*)?$/,
    api.labRequests,
    defaultLabResponse,
    options.lab,
  );
  await registerRoute(
    page,
    /\/api\/ghostwriter(?:\?.*)?$/,
    api.rewriteRequests,
    defaultRewriteResponse,
    options.rewrite,
  );

  return api;
}
