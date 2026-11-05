import { describe, expect, it } from "vitest";
import { directoryName, matchesDirectorySearch } from "./userDirectory";

describe("user directory stored details", () => {
  it("prefers the registered full name over display name", () => {
    expect(directoryName({ full_name: "حسين يحيى", display_name: "حسين", email: null })).toBe("حسين يحيى");
  });
  it("finds a user by recorded IP", () => {
    const row = { display_name: null, email: null, ip_address: "192.0.2.10" };
    expect(matchesDirectorySearch(row, "192.0.2.10")).toBe(true);
    expect(matchesDirectorySearch(row, "192.0.2.11")).toBe(false);
  });
  it("searches the stored country without deriving it from the phone", () => {
    const row = { display_name: null, email: null, phone: "+966500000000", country: "Egypt" };
    expect(matchesDirectorySearch(row, "Egypt")).toBe(true);
    expect(matchesDirectorySearch(row, "Saudi Arabia")).toBe(false);
  });
});