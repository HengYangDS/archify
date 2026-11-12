// Screenshot one panel of a page and record the capture conditions beside it:
// node shoot-marks.mjs <playwright-core dir> <page.html> <out.png> <panel id> <light|dark>
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

const [core, html, out, id, theme] = process.argv.slice(2);
if (!["light", "dark"].includes(theme)) throw new Error("theme must be light or dark");
const sha256 = (file) => createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const { chromium } = await import(pathToFileURL(path.join(core, "index.mjs")).href);
const viewport = { width: 1440, height: 900 };
const deviceScaleFactor = 1.5;
const browser = await chromium.launch({ executablePath: process.env.CHROME });
const page = await browser.newPage({ viewport, deviceScaleFactor, colorScheme: theme });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
await page.goto(pathToFileURL(html).href, { waitUntil: "load" });
await page.waitForTimeout(2500);
const target = page.locator(`[id="${id}"]`).first();
if (!(await target.count())) throw new Error(`${id} not found`);
await target.scrollIntoViewIfNeeded();
await page.waitForTimeout(900);
await target.screenshot({ path: out });
const box = await target.boundingBox();
const record = {
  page: { file: path.basename(html), sha256: sha256(html) },
  panel: id,
  theme,
  viewport,
  deviceScaleFactor,
  browser: { executable: path.basename(process.env.CHROME || "bundled"), version: browser.version() },
  playwrightCore: JSON.parse(fs.readFileSync(path.join(core, "package.json"), "utf8")).version,
  box: { width: Math.round(box.width), height: Math.round(box.height) },
  image: { file: path.basename(out), sha256: sha256(out) },
  errors,
};
fs.writeFileSync(out.replace(/\.png$/, ".json"), JSON.stringify(record, null, 2) + "\n");
console.log(JSON.stringify(record));
await browser.close();
