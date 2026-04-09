// @vitest-environment node
import { test, expect, vi, beforeEach } from "vitest";
import { jwtVerify, SignJWT } from "jose";

vi.mock("server-only", () => ({}));

const mockSet = vi.fn();
const mockGet = vi.fn();
const mockDelete = vi.fn();

vi.mock("next/headers", () => ({
  cookies: vi.fn(() =>
    Promise.resolve({
      set: mockSet,
      get: mockGet,
      delete: mockDelete,
    })
  ),
}));

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "development-secret-key"
);

beforeEach(() => {
  vi.clearAllMocks();
});

test("createSession sets an httpOnly cookie", async () => {
  const { createSession } = await import("@/lib/auth");

  await createSession("user-123", "test@example.com");

  expect(mockSet).toHaveBeenCalledOnce();
  const [cookieName, , options] = mockSet.mock.calls[0];
  expect(cookieName).toBe("auth-token");
  expect(options.httpOnly).toBe(true);
  expect(options.path).toBe("/");
  expect(options.sameSite).toBe("lax");
});

test("createSession token contains correct userId and email", async () => {
  const { createSession } = await import("@/lib/auth");

  await createSession("user-123", "test@example.com");

  const token = mockSet.mock.calls[0][1];
  const { payload } = await jwtVerify(token, JWT_SECRET);

  expect(payload.userId).toBe("user-123");
  expect(payload.email).toBe("test@example.com");
});

test("createSession token expires in ~7 days", async () => {
  const { createSession } = await import("@/lib/auth");
  const before = Date.now();

  await createSession("user-123", "test@example.com");

  const token = mockSet.mock.calls[0][1];
  const { payload } = await jwtVerify(token, JWT_SECRET);

  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  const expMs = (payload.exp as number) * 1000;
  expect(expMs - before).toBeGreaterThanOrEqual(sevenDaysMs - 5000);
  expect(expMs - before).toBeLessThanOrEqual(sevenDaysMs + 5000);
});

test("createSession sets cookie expiry to ~7 days from now", async () => {
  const { createSession } = await import("@/lib/auth");
  const before = Date.now();

  await createSession("user-123", "test@example.com");

  const options = mockSet.mock.calls[0][2];
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  expect(options.expires.getTime() - before).toBeGreaterThanOrEqual(sevenDaysMs - 5000);
  expect(options.expires.getTime() - before).toBeLessThanOrEqual(sevenDaysMs + 5000);
});

test("createSession works for different users independently", async () => {
  const { createSession } = await import("@/lib/auth");

  await createSession("user-abc", "alice@example.com");
  await createSession("user-xyz", "bob@example.com");

  expect(mockSet).toHaveBeenCalledTimes(2);

  const tokenA = mockSet.mock.calls[0][1];
  const tokenB = mockSet.mock.calls[1][1];

  const { payload: payloadA } = await jwtVerify(tokenA, JWT_SECRET);
  const { payload: payloadB } = await jwtVerify(tokenB, JWT_SECRET);

  expect(payloadA.userId).toBe("user-abc");
  expect(payloadB.userId).toBe("user-xyz");
});

// getSession

async function signToken(claims: object, expiresIn: string | number = "7d") {
  return new SignJWT(claims as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(expiresIn)
    .setIssuedAt()
    .sign(JWT_SECRET);
}

test("getSession returns null when no cookie is present", async () => {
  const { getSession } = await import("@/lib/auth");
  mockGet.mockReturnValue(undefined);

  const result = await getSession();

  expect(result).toBeNull();
});

test("getSession returns session payload for a valid token", async () => {
  const { getSession } = await import("@/lib/auth");
  const token = await signToken({ userId: "user-123", email: "test@example.com" });
  mockGet.mockReturnValue({ value: token });

  const session = await getSession();

  expect(session?.userId).toBe("user-123");
  expect(session?.email).toBe("test@example.com");
});

test("getSession returns null for an expired token", async () => {
  const { getSession } = await import("@/lib/auth");
  const expiredToken = await new SignJWT({ userId: "user-123", email: "test@example.com" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(Math.floor(Date.now() / 1000) - 10)
    .setIssuedAt()
    .sign(JWT_SECRET);
  mockGet.mockReturnValue({ value: expiredToken });

  const result = await getSession();

  expect(result).toBeNull();
});

test("getSession returns null for a malformed token", async () => {
  const { getSession } = await import("@/lib/auth");
  mockGet.mockReturnValue({ value: "not.a.valid.jwt" });

  const result = await getSession();

  expect(result).toBeNull();
});

test("getSession returns null for a token signed with a different secret", async () => {
  const { getSession } = await import("@/lib/auth");
  const wrongSecret = new TextEncoder().encode("wrong-secret");
  const token = await new SignJWT({ userId: "user-123", email: "test@example.com" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .setIssuedAt()
    .sign(wrongSecret);
  mockGet.mockReturnValue({ value: token });

  const result = await getSession();

  expect(result).toBeNull();
});
