/**
 * Sprint 1 (invite-flows) — unit tests for the SCHOOL_ADMIN scope hook.
 *
 * The hook accepts SCHOOL_ADMIN, DISTRICT_ADMIN, and PLATFORM_ADMIN, and
 * injects req.tenantId / req.schoolId based on the token + the request
 * (query/body/params). SCHOOL_ADMIN tokens MUST carry a schoolId; the
 * hook rejects them otherwise.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { signJWT } from "@aivo/security";
import { requireSchoolAdmin } from "../src/hooks/require-school-admin.js";

type FakeReply = {
  status: (n: number) => FakeReply;
  send: (body: any) => any;
  _status: number | null;
  _body: any;
};

function makeReply(): FakeReply {
  const r: any = {
    _status: null,
    _body: null,
    status(n: number) {
      r._status = n;
      return r;
    },
    send(body: any) {
      r._body = body;
      return body;
    },
  };
  return r;
}

function makeReq(headers: Record<string, string>, extras: Record<string, any> = {}) {
  return {
    headers,
    query: extras.query || {},
    body: extras.body || {},
    params: extras.params || {},
  } as any;
}

test("requireSchoolAdmin rejects missing authorization header with 401", async () => {
  const req = makeReq({});
  const reply = makeReply();
  await requireSchoolAdmin(req, reply);
  assert.equal(reply._status, 401);
});

test("requireSchoolAdmin rejects invalid bearer token with 401", async () => {
  const req = makeReq({ authorization: "Bearer not-a-jwt" });
  const reply = makeReply();
  await requireSchoolAdmin(req, reply);
  assert.equal(reply._status, 401);
});

test("requireSchoolAdmin rejects PARENT role with 403", async () => {
  const token = await signJWT({
    sub: "u1",
    role: "PARENT",
    tenantId: "t1",
    email: "p@aivo.test",
  });
  const req = makeReq({ authorization: `Bearer ${token}` });
  const reply = makeReply();
  await requireSchoolAdmin(req, reply);
  assert.equal(reply._status, 403);
});

test("requireSchoolAdmin accepts SCHOOL_ADMIN with schoolId in token and injects scope", async () => {
  const token = await signJWT({
    sub: "u1",
    role: "SCHOOL_ADMIN",
    tenantId: "t1",
    schoolId: "s1",
    email: "sa@aivo.test",
  });
  const req = makeReq({ authorization: `Bearer ${token}` });
  const reply = makeReply();
  await requireSchoolAdmin(req, reply);
  assert.equal(reply._status, null, "should not reject");
  assert.equal(req.tenantId, "t1");
  assert.equal(req.schoolId, "s1");
});

test("requireSchoolAdmin rejects SCHOOL_ADMIN token without schoolId with 400", async () => {
  const token = await signJWT({
    sub: "u1",
    role: "SCHOOL_ADMIN",
    tenantId: "t1",
    email: "sa@aivo.test",
  });
  const req = makeReq({ authorization: `Bearer ${token}` });
  const reply = makeReply();
  await requireSchoolAdmin(req, reply);
  assert.equal(reply._status, 400);
});

test("requireSchoolAdmin accepts DISTRICT_ADMIN and reads schoolId from query", async () => {
  const token = await signJWT({
    sub: "u1",
    role: "DISTRICT_ADMIN",
    tenantId: "t1",
    email: "da@aivo.test",
  });
  const req = makeReq(
    { authorization: `Bearer ${token}` },
    { query: { schoolId: "s2" } },
  );
  const reply = makeReply();
  await requireSchoolAdmin(req, reply);
  assert.equal(reply._status, null);
  assert.equal(req.tenantId, "t1");
  assert.equal(req.schoolId, "s2");
});

test("requireSchoolAdmin accepts PLATFORM_ADMIN and reads schoolId from query", async () => {
  const token = await signJWT({
    sub: "u1",
    role: "PLATFORM_ADMIN",
    email: "pa@aivo.test",
  });
  const req = makeReq(
    { authorization: `Bearer ${token}` },
    { query: { schoolId: "s3" } },
  );
  const reply = makeReply();
  await requireSchoolAdmin(req, reply);
  assert.equal(reply._status, null);
  assert.equal(req.schoolId, "s3");
});
