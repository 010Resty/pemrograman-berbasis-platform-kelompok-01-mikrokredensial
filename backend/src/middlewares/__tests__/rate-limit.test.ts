import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Request, Response, NextFunction } from "express";
import {
  rateLimit,
  resetRateLimitForTest,
} from "../../middlewares/rate-limit.middleware";

/**
 * Rate limiter — unit murni dengan req/res palsu, tanpa server.
 */

const fakePair = () => {
  let statusCode = 0;
  let body: unknown = null;
  const headers: Record<string, string> = {};
  const res = {
    status: (code: number) => {
      statusCode = code;
      return res;
    },
    json: (payload: unknown) => {
      body = payload;
      return res;
    },
    set: (k: string, v: string) => {
      headers[k] = v;
      return res;
    },
  } as unknown as Response;
  const req = { ip: "10.0.0.1", path: "/instructor-applications" } as Request;
  return {
    req,
    res,
    next: (() => {
      let n = 0;
      const fn = (() => {
        n += 1;
      }) as NextFunction;
      return { fn, count: () => n };
    })(),
    out: () => ({ statusCode, body, headers }),
  };
};

describe("rateLimit", () => {
  it("melewatkan di bawah batas, 429 + Retry-After di atas batas", () => {
    resetRateLimitForTest();
    const limiter = rateLimit({ windowMs: 60_000, max: 2 });
    for (let i = 0; i < 2; i += 1) {
      const p = fakePair();
      limiter(p.req, p.res, p.next.fn);
      assert.equal(p.next.count(), 1);
      assert.equal(p.out().statusCode, 0);
    }
    const over = fakePair();
    limiter(over.req, over.res, over.next.fn);
    assert.equal(over.next.count(), 0);
    assert.equal(over.out().statusCode, 429);
    assert.ok(over.out().headers["Retry-After"]);
    const payload = over.out().body as { status: string };
    assert.equal(payload.status, "error");
  });
});
