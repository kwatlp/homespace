import { expect, test } from "vitest";

import { PACKAGE_NAME } from "./index";

test("@kwatlp/schema scaffold is wired", () => {
  expect(PACKAGE_NAME).toBe("@kwatlp/schema");
});
