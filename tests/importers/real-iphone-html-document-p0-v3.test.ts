import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path: string) {
  return readFile(path, "utf8");
}

test("the iPhone document control is static, noindex and catalog-independent", async () => {
  const page = await source("app/p0/iphone-document-control/page.tsx");

  assert.match(page, /index: false/u);
  assert.match(page, /follow: false/u);
  assert.match(page, /HTML-документ Кибермедика загружен/u);
  assert.doesNotMatch(page, /productService|catalogRepository|loadCloud|fetch\(|connection\(/u);
});
