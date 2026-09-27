import assert from "node:assert/strict";
import { test } from "node:test";
import { isGuestReadablePath, requiresSignIn } from "./public-routes.ts";

test("Picks, Lab, Games, and Ledger are guest-readable", () => {
  assert.equal(isGuestReadablePath("/"), true);
  assert.equal(isGuestReadablePath("/picks"), true);
  assert.equal(isGuestReadablePath("/games"), true);
  assert.equal(isGuestReadablePath("/results"), true);
  assert.equal(requiresSignIn("/"), false);
  assert.equal(requiresSignIn("/picks"), false);
  assert.equal(requiresSignIn("/games"), false);
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

test("arbitrage stays gated", () => {
  assert.equal(isGuestReadablePath("/arbitrage"), false);
  assert.equal(requiresSignIn("/arbitrage"), true);
});
