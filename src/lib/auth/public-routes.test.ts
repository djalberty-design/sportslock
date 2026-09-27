import assert from "node:assert/strict";
import { test } from "node:test";
import { isGuestReadablePath, requiresSignIn } from "./public-routes.ts";

test("Board and Ledger are guest-readable", () => {
  assert.equal(isGuestReadablePath("/"), true);
  assert.equal(isGuestReadablePath("/results"), true);
  assert.equal(requiresSignIn("/"), false);
  assert.equal(requiresSignIn("/results"), false);
});

test("Ticket, profile, and admin require sign-in", () => {
  assert.equal(isGuestReadablePath("/ticket"), false);
  assert.equal(isGuestReadablePath("/profile"), false);
  assert.equal(isGuestReadablePath("/admin"), false);
  assert.equal(requiresSignIn("/ticket"), true);
  assert.equal(requiresSignIn("/profile"), true);
  assert.equal(requiresSignIn("/admin/approvals"), true);
});

test("Lab and arbitrage stay off the guest board even if the file route exists", () => {
  assert.equal(isGuestReadablePath("/picks"), false);
  assert.equal(isGuestReadablePath("/arbitrage"), false);
});
