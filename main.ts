import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// gta6-meme-x-01 round 5: copy the entry's POST.json into the output dir.
// The grader mounts this repo READ-ONLY at /bot and sets MAKEFUN_OUTPUT_DIR,
// so this program reads POST.json next to main.ts and writes ONLY
// POST.json into MAKEFUN_OUTPUT_DIR. It writes nothing anywhere else.

const REPO_ROOT = dirname(fileURLToPath(import.meta.url));
const POST_PATH = join(REPO_ROOT, "POST.json");

const X_HOSTS = new Set([
  "x.com",
  "www.x.com",
  "mobile.x.com",
  "twitter.com",
  "www.twitter.com",
  "mobile.twitter.com",
]);

function fail(message: string): never {
  console.error(`main.ts: ${message}`);
  process.exit(1);
}

function parsePostUrl(raw: string): string {
  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    fail(`POST.json url is not a valid URL: ${JSON.stringify(raw)}`);
  }
  if (parsed.protocol !== "https:") {
    fail(`POST.json url must use https: ${JSON.stringify(raw)}`);
  }
  if (!X_HOSTS.has(parsed.hostname.toLowerCase())) {
    fail(`POST.json url must be an x.com / twitter.com post URL: ${JSON.stringify(raw)}`);
  }
  if (parsed.port !== "") {
    fail(`POST.json url must not carry a port: ${JSON.stringify(raw)}`);
  }
  const m = /^\/([A-Za-z0-9_]{1,15})\/status\/(\d+)$/.exec(parsed.pathname);
  if (!m) {
    fail(
      `POST.json url must look like https://x.com/<handle>/status/<id>: ${JSON.stringify(raw)}`,
    );
  }
  // Query strings and fragments are read past by the house; drop them so the
  // written file holds the canonical post address. (The WHATWG URL parser
  // already lower-cases the hostname, so no extra case folding is needed.)
  return `https://${parsed.hostname}/${m[1]}/status/${m[2]}`;
}

function main(): void {
  let text: string;
  try {
    text = readFileSync(POST_PATH, "utf8");
  } catch {
    fail(`cannot read POST.json next to main.ts (${POST_PATH})`);
  }

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    fail("POST.json is not valid JSON");
  }
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    fail("POST.json must be a JSON object with a url field");
  }
  const url = (data as { url?: unknown }).url;
  if (typeof url !== "string" || url.length === 0) {
    fail("POST.json must carry a non-empty string url");
  }
  const cleanUrl = parsePostUrl(url);

  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
  const outPath = join(outDir, "POST.json");
  const outText = JSON.stringify({ url: cleanUrl }) + "\n";
  try {
    mkdirSync(outDir, { recursive: true });
    writeFileSync(outPath, outText, "utf8");
  } catch (err) {
    fail(`cannot write ${outPath}: ${err instanceof Error ? err.message : String(err)}`);
  }
  console.log("entry link OK");
}

main();
