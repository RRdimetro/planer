import { chromium } from "@playwright/test";
import fs from "node:fs";
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
try {
  const page = await browser.newPage({
    viewport: { width: 256, height: 256 },
    deviceScaleFactor: 1,
  });
  await page.setContent(
    "<style>body{margin:0;background:transparent}</style>" +
      fs.readFileSync("build/icon.svg", "utf8"),
  );
  await page
    .locator("svg")
    .screenshot({ path: "build/icon.png", omitBackground: true });
} finally {
  await browser.close();
}
