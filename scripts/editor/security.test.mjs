import test from "node:test";
import assert from "node:assert/strict";
import {
  checkRequest,
  isAllowedAuthority,
  isAllowedOrigin,
  isLoopbackAddress,
  parseAuthority,
} from "./security.mjs";

test("isLoopbackAddress", () => {
  assert.ok(isLoopbackAddress("127.0.0.1"));
  assert.ok(isLoopbackAddress("127.0.0.2"));
  assert.ok(isLoopbackAddress("::1"));
  assert.ok(isLoopbackAddress("::ffff:127.0.0.1"));
  assert.ok(!isLoopbackAddress("192.168.1.20"));
  assert.ok(!isLoopbackAddress("::ffff:192.168.1.20"));
  assert.ok(!isLoopbackAddress("10.0.0.1"));
  assert.ok(!isLoopbackAddress(undefined));
  assert.ok(!isLoopbackAddress(""));
});

test("parseAuthority / isAllowedAuthority against the actual bound port", () => {
  assert.deepEqual(parseAuthority("localhost:4321"), { hostname: "localhost", port: 4321 });
  assert.deepEqual(parseAuthority("[::1]:5000"), { hostname: "[::1]", port: 5000 });
  assert.ok(isAllowedAuthority("localhost:4321", 4321));
  assert.ok(isAllowedAuthority("127.0.0.1:9999", 9999));
  assert.ok(isAllowedAuthority("[::1]:4321", 4321));
  assert.ok(!isAllowedAuthority("localhost:4321", 4322)); // wrong port
  assert.ok(!isAllowedAuthority("localhost", 4321)); // no port
  assert.ok(!isAllowedAuthority("evil.example:4321", 4321));
  assert.ok(!isAllowedAuthority("evil.example.com:4321", 4321));
  assert.ok(!isAllowedAuthority(undefined, 4321));
  assert.ok(!isAllowedAuthority("localhost:4321", undefined));
});

test("isAllowedOrigin", () => {
  assert.ok(isAllowedOrigin("http://localhost:4321", 4321));
  assert.ok(isAllowedOrigin("http://127.0.0.1:4321", 4321));
  assert.ok(isAllowedOrigin("http://[::1]:4321", 4321));
  assert.ok(!isAllowedOrigin("http://localhost:9999", 4321));
  assert.ok(!isAllowedOrigin("https://localhost:4321", 4321)); // scheme
  assert.ok(!isAllowedOrigin("http://evil.example", 4321));
  assert.ok(!isAllowedOrigin("null", 4321));
  assert.ok(!isAllowedOrigin(undefined, 4321));
});

test("checkRequest: full policy", () => {
  const base = {
    method: "GET",
    remoteAddress: "127.0.0.1",
    host: "localhost:4321",
    origin: undefined,
    editorHeader: undefined,
    boundPort: 4321,
  };
  assert.ok(checkRequest(base).allowed);

  // non-loopback socket (astro dev --host exposure)
  assert.equal(checkRequest({ ...base, remoteAddress: "192.168.1.50" }).status, 403);
  // DNS rebinding: attacker's hostname resolving to 127.0.0.1
  assert.equal(checkRequest({ ...base, host: "attacker.example:4321" }).status, 403);
  // wrong port in Host
  assert.equal(checkRequest({ ...base, host: "localhost:4322" }).status, 403);
  // unknown bound port -> refuse
  assert.equal(checkRequest({ ...base, boundPort: undefined }).status, 403);

  const post = { ...base, method: "POST", origin: "http://localhost:4321", editorHeader: "1" };
  assert.ok(checkRequest(post).allowed);
  // Origin is mandatory on POST
  assert.equal(checkRequest({ ...post, origin: undefined }).status, 403);
  assert.equal(checkRequest({ ...post, origin: "http://evil.example" }).status, 403);
  // custom header must have the exact agreed value on POST
  assert.equal(checkRequest({ ...post, editorHeader: undefined }).status, 403);
  assert.equal(checkRequest({ ...post, editorHeader: "" }).status, 403);
  assert.equal(checkRequest({ ...post, editorHeader: "0" }).status, 403);
  assert.equal(checkRequest({ ...post, editorHeader: "true" }).status, 403);
});
