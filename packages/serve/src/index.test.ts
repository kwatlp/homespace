import { expect, test } from "vitest";

import { PACKAGE_NAME } from "./index";

test("@kwatlp/serve scaffold is wired", () => {
  expect(PACKAGE_NAME).toBe("@kwatlp/serve");
});
