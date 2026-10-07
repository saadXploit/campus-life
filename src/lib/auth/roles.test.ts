import { describe, expect, it } from "vitest";
import {
  can,
  canAssignRole,
  canModifyStaffMember,
  hasMinRole,
  isStaffRole,
} from "./roles";

describe("role checks", () => {
  it("recognises only real roles", () => {
    expect(isStaffRole("OWNER")).toBe(true);
    expect(isStaffRole("owner")).toBe(false);
    expect(isStaffRole("GOD")).toBe(false);
    expect(isStaffRole(undefined)).toBe(false);
  });

  it("ranks roles correctly", () => {
    expect(hasMinRole("OWNER", "ADMIN")).toBe(true);
    expect(hasMinRole("ADMIN", "ADMIN")).toBe(true);
    expect(hasMinRole("MODERATOR", "ADMIN")).toBe(false);
  });

  it("denies when there is no role (fail closed)", () => {
    expect(hasMinRole(null, "MODERATOR")).toBe(false);
    expect(hasMinRole(undefined, "MODERATOR")).toBe(false);
    expect(hasMinRole("player", "MODERATOR")).toBe(false);
  });
});

describe("assigning roles", () => {
  it("lets only the OWNER assign roles", () => {
    expect(canAssignRole("OWNER", "ADMIN")).toBe(true);
    expect(canAssignRole("OWNER", "SUPER_ADMIN")).toBe(true);
    expect(canAssignRole("SUPER_ADMIN", "MODERATOR")).toBe(false);
    expect(canAssignRole("ADMIN", "MODERATOR")).toBe(false);
    expect(canAssignRole(null, "MODERATOR")).toBe(false);
  });

  it("never allows anyone to be made OWNER", () => {
    expect(canAssignRole("OWNER", "OWNER")).toBe(false);
    expect(canAssignRole("SUPER_ADMIN", "OWNER")).toBe(false);
  });

  it("rejects made-up role names", () => {
    expect(canAssignRole("OWNER", "ROOT")).toBe(false);
  });
});

describe("modifying staff", () => {
  it("lets the OWNER change other staff only", () => {
    expect(canModifyStaffMember("OWNER", "ADMIN")).toBe(true);
    expect(canModifyStaffMember("OWNER", "OWNER")).toBe(false);
  });

  it("stops everyone else touching staff", () => {
    expect(canModifyStaffMember("SUPER_ADMIN", "MODERATOR")).toBe(false);
    expect(canModifyStaffMember("ADMIN", "MODERATOR")).toBe(false);
    expect(canModifyStaffMember("SUPER_ADMIN", "OWNER")).toBe(false);
  });
});

describe("permissions", () => {
  it("restricts staff management to the OWNER", () => {
    expect(can("OWNER", "staff.manage")).toBe(true);
    expect(can("SUPER_ADMIN", "staff.manage")).toBe(false);
  });

  it("restricts game settings to OWNER and SUPER_ADMIN", () => {
    expect(can("OWNER", "settings.manage")).toBe(true);
    expect(can("SUPER_ADMIN", "settings.manage")).toBe(true);
    expect(can("ADMIN", "settings.manage")).toBe(false);
  });

  it("restricts audit log and economy to OWNER and SUPER_ADMIN", () => {
    expect(can("SUPER_ADMIN", "audit.view")).toBe(true);
    expect(can("ADMIN", "audit.view")).toBe(false);
    expect(can("SUPER_ADMIN", "economy.inject")).toBe(true);
    expect(can("ADMIN", "economy.inject")).toBe(false);
  });

  it("lets ADMIN and above manage ads", () => {
    expect(can("ADMIN", "ads.manage")).toBe(true);
    expect(can("MODERATOR", "ads.manage")).toBe(false);
  });

  it("lets ADMIN ban but not MODERATOR", () => {
    expect(can("ADMIN", "players.ban")).toBe(true);
    expect(can("MODERATOR", "players.ban")).toBe(false);
  });

  it("lets MODERATOR do moderation work", () => {
    expect(can("MODERATOR", "reports.review")).toBe(true);
    expect(can("MODERATOR", "players.suspend")).toBe(true);
    expect(can("MODERATOR", "chat.moderate")).toBe(true);
  });

  it("denies normal players everything", () => {
    expect(can(null, "chat.moderate")).toBe(false);
    expect(can(undefined, "reports.review")).toBe(false);
    expect(can("player", "reports.review")).toBe(false);
  });
});