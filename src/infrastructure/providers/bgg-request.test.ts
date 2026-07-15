import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { boardGameGeekProvider } from "./boardgamegeek-provider";
import { boardGameGeekPlayProvider } from "./bgg-play-provider";

describe("BoardGameGeek request authorization", () => {
  beforeEach(() => {
    process.env.BGG_TOKEN = "test-bgg-token";
    delete process.env.BGG_APPLICATION_TOKEN;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.BGG_TOKEN;
  });

  it("authorizes item catalog requests with BGG_TOKEN", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('<items total="0" termsofuse=""></items>', {
        status: 200,
        headers: { "content-type": "application/xml" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await boardGameGeekProvider.searchItems("Ark Nova");

    expectAuthorizationHeader(fetchMock);
  });

  it("authorizes play sync requests with BGG_TOKEN", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('<plays username="tester" total="0" page="1"></plays>', {
        status: 200,
        headers: { "content-type": "application/xml" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await boardGameGeekPlayProvider.getUserPlays("tester");

    expectAuthorizationHeader(fetchMock);
  });
});

function expectAuthorizationHeader(fetchMock: ReturnType<typeof vi.fn>) {
  expect(fetchMock).toHaveBeenCalledOnce();

  const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
  const headers = new Headers(init?.headers);

  expect(headers.get("authorization")).toBe("Bearer test-bgg-token");
}
