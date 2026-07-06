import { ApiError } from "@/server/api/errors";

const BGG_XML_API_URL = "https://boardgamegeek.com/xmlapi2";
const PROVIDER_CODE = "boardgamegeek";
const MAX_PAGES = 50;

export type RawBggPlay = {
  id: string;
  date: string;
  quantity: number;
  itemName: string;
  bggThingId: string;
  playersCount?: number | null;
  durationMinutes?: number | null;
  playerNames: string[];
  playerResults: {
    name: string;
    username?: string | null;
    score?: string | null;
    win: boolean;
  }[];
  comments?: string | null;
};

export type NormalizedBggPlay = {
  bggPlayId: string;
  bggThingId: string;
  title: string;
  playedAt: Date;
  quantity: number;
  playersCount?: number | null;
  durationMinutes?: number | null;
  result?: "win" | "loss" | "score" | "unknown";
  score?: string | null;
  playerNames: string[];
  notes?: string | null;
};

export interface BggPlayProvider {
  getUserPlays(
    username: string,
    since?: string | null,
  ): Promise<NormalizedBggPlay[]>;
  normalizePlay(rawPlay: RawBggPlay, username: string): NormalizedBggPlay;
}

export class BoardGameGeekPlayProvider implements BggPlayProvider {
  async getUserPlays(username: string, since?: string | null) {
    const plays: NormalizedBggPlay[] = [];

    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const pageData = await fetchBggPlaysPage(username, since, page);
      plays.push(
        ...pageData.plays.map((play) => this.normalizePlay(play, username)),
      );

      if (
        pageData.plays.length === 0 ||
        plays.length >= pageData.total ||
        page >= pageData.totalPages
      ) {
        break;
      }
    }

    return plays;
  }

  normalizePlay(rawPlay: RawBggPlay, username: string): NormalizedBggPlay {
    const score = rawPlay.playerResults
      .filter((player) => player.score)
      .map((player) => `${player.name}: ${player.score}`)
      .join(", ");
    const currentUser = rawPlay.playerResults.find(
      (player) => player.username?.toLowerCase() === username.toLowerCase(),
    );
    const hasWinner = rawPlay.playerResults.some((player) => player.win);
    const result = currentUser
      ? currentUser.win
        ? "win"
        : hasWinner
          ? "loss"
          : score
            ? "score"
            : "unknown"
      : score
        ? "score"
        : "unknown";

    return {
      bggPlayId: rawPlay.id,
      bggThingId: rawPlay.bggThingId,
      title: rawPlay.itemName,
      playedAt: new Date(`${rawPlay.date}T00:00:00.000Z`),
      quantity: rawPlay.quantity,
      playersCount: rawPlay.playersCount,
      durationMinutes: rawPlay.durationMinutes,
      result,
      score: score || null,
      playerNames: rawPlay.playerNames,
      notes: rawPlay.comments,
    };
  }
}

export const boardGameGeekPlayProvider = new BoardGameGeekPlayProvider();

async function fetchBggPlaysPage(
  username: string,
  since: string | null | undefined,
  page: number,
) {
  const searchParams = new URLSearchParams({
    username,
    page: String(page),
  });

  if (since) {
    searchParams.set("mindate", toBggDate(since));
  }

  const xml = await fetchBggXml(`/plays?${searchParams.toString()}`);
  return parsePlaysPage(xml);
}

async function fetchBggXml(path: string) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const response = await fetch(`${BGG_XML_API_URL}${path}`, {
      headers: {
        accept: "application/xml,text/xml",
        "user-agent": "BoardGameCollection/1.0",
      },
    });

    if (response.status === 202 && attempt < 3) {
      await sleep(1000);
      continue;
    }

    if (!response.ok) {
      throw new ApiError(
        502,
        "PROVIDER_ERROR",
        "BoardGameGeek plays request failed",
        {
          provider: PROVIDER_CODE,
          status: response.status,
        },
      );
    }

    return response.text();
  }

  throw new ApiError(
    502,
    "PROVIDER_ERROR",
    "BoardGameGeek is still preparing plays data",
    {
      provider: PROVIDER_CODE,
    },
  );
}

function parsePlaysPage(xml: string) {
  const playsAttrs = getOpeningTagAttrs(xml, "plays");
  const total = toInt(playsAttrs.total) ?? 0;
  const page = toInt(playsAttrs.page) ?? 1;
  const plays = getElementBlocks(xml, "play")
    .map(parsePlay)
    .filter((play): play is RawBggPlay => Boolean(play));
  const totalPages = Math.max(page, Math.ceil(total / Math.max(plays.length, 1)));

  return {
    total,
    page,
    totalPages,
    plays,
  };
}

function parsePlay(block: {
  attrs: Record<string, string>;
  body: string;
}): RawBggPlay | null {
  const itemBlock = getElementBlocks(block.body, "item")[0];

  if (!block.attrs.id || !block.attrs.date || !itemBlock?.attrs.objectid) {
    return null;
  }

  const playerAttrs = getSelfClosingElements(block.body, "player");
  const playerResults = playerAttrs.map((attrs) => ({
    name: attrs.name || attrs.username || "Player",
    username: attrs.username || null,
    score: attrs.score || null,
    win: attrs.win === "1",
  }));
  const playerNames = playerResults.map((player) => player.name);
  const parsedPlayersCount = toInt(block.attrs.players) ?? playerNames.length;

  return {
    id: block.attrs.id,
    date: block.attrs.date,
    quantity: toInt(block.attrs.quantity) ?? 1,
    itemName: itemBlock.attrs.name ?? "Untitled",
    bggThingId: itemBlock.attrs.objectid,
    playersCount: parsedPlayersCount > 0 ? parsedPlayersCount : null,
    durationMinutes: toInt(block.attrs.length),
    playerNames,
    playerResults,
    comments: getElementText(block.body, "comments"),
  } satisfies RawBggPlay;
}

function toBggDate(value: string) {
  return new Date(value).toISOString().slice(0, 10);
}

function getOpeningTagAttrs(xml: string, tagName: string) {
  const match = xml.match(new RegExp(`<${tagName}\\b([^>]*)>`));
  return parseAttrs(match?.[1] ?? "");
}

function getElementBlocks(xml: string, tagName: string) {
  const regexp = new RegExp(
    `<${tagName}\\b([^>]*)>([\\s\\S]*?)<\\/${tagName}>`,
    "g",
  );
  return [...xml.matchAll(regexp)].map((match) => ({
    attrs: parseAttrs(match[1] ?? ""),
    body: match[2] ?? "",
  }));
}

function getSelfClosingElements(xml: string, tagName: string) {
  const regexp = new RegExp(`<${tagName}\\b([^>]*)\\/>`, "g");
  return [...xml.matchAll(regexp)].map((match) => parseAttrs(match[1] ?? ""));
}

function getElementText(xml: string, tagName: string) {
  const match = xml.match(
    new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`),
  );

  return match?.[1] ? decodeXml(match[1]).trim() || null : null;
}

function parseAttrs(source: string) {
  const attrs: Record<string, string> = {};

  for (const match of source.matchAll(/([:\w-]+)="([^"]*)"/g)) {
    attrs[match[1] ?? ""] = decodeXml(match[2] ?? "");
  }

  return attrs;
}

function toInt(value?: string | null) {
  if (!value) {
    return null;
  }

  const number = Number.parseInt(value, 10);
  return Number.isFinite(number) ? number : null;
}

function decodeXml(value: string) {
  return value
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&")
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCodePoint(Number(code)),
    )
    .replace(/&#x([a-fA-F0-9]+);/g, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    );
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
