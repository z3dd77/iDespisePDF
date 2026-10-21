/**
 * Route smoke test. Requires a production server:
 *   npm run build && npm start
 *   npm run smoke
 *
 * Set BASE_URL to point at a different origin.
 */

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";

const TOOL_ROUTES = [
  ["merge", "Merge PDFs"],
  ["split", "Split PDF"],
  ["compress", "Compress PDF"],
  ["rotate", "Rotate PDF"],
  ["reorder", "Reorder pages"],
  ["extract-pages", "Extract pages"],
  ["images-to-pdf", "Images to PDF"],
  ["pdf-to-images", "PDF to images"],
  ["protect", "Protect PDF"],
];

const failures = [];

function check(condition, message) {
  if (!condition) {
    failures.push(message);
    console.error(`FAIL ${message}`);
  } else {
    console.log(`ok   ${message}`);
  }
}

async function fetchText(path) {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: { "user-agent": "idespise-pdf-smoke" },
  });
  return { response, body: await response.text() };
}

const landing = await fetchText("/");
check(landing.response.status === 200, "GET / returns 200");
check(
  landing.body.includes("PDF work that never leaves your device"),
  "landing page renders the hero",
);
check(
  !landing.body.includes("pdf.worker.min.mjs"),
  "landing page does not reference the PDF.js worker",
);
check(
  !landing.body.includes("pdfjs-dist"),
  "landing page does not reference pdfjs-dist",
);
check(
  !landing.body.includes("@cantoo/pdf-lib"),
  "landing page does not reference the PDF engine",
);

// Inspect the actual scripts the landing page loads, not just the HTML text.
const scriptSources = [
  ...landing.body.matchAll(/<script[^>]+src="([^"]+)"/g),
].map((match) => match[1]);

check(scriptSources.length > 0, "landing page references client scripts");

let pdfEngineInInitialBundle = false;

for (const source of scriptSources) {
  const response = await fetch(new URL(source, BASE_URL));
  const chunk = await response.text();

  if (
    chunk.includes("pdf.worker.min.mjs") ||
    chunk.includes("pdfjs-dist") ||
    chunk.includes("@cantoo/pdf-lib")
  ) {
    pdfEngineInInitialBundle = true;
    console.error(`     ${source} contains a PDF engine marker`);
  }
}

check(
  !pdfEngineInInitialBundle,
  `none of the ${scriptSources.length} initial scripts contain PDF.js or the PDF engine`,
);

const worker = await fetch(`${BASE_URL}/pdf.worker.min.mjs`);
check(worker.status === 200, "PDF.js worker is served from /pdf.worker.min.mjs");
const workerBytes = (await worker.arrayBuffer()).byteLength;
check(
  workerBytes > 100_000,
  `PDF.js worker asset has the expected size (${workerBytes} bytes)`,
);

for (const [slug, title] of TOOL_ROUTES) {
  const { response, body } = await fetchText(`/tools/${slug}`);
  check(response.status === 200, `GET /tools/${slug} returns 200`);
  check(body.includes(title), `/tools/${slug} renders "${title}"`);
  check(
    body.includes("All tools"),
    `/tools/${slug} renders the tool shell`,
  );
}

const missing = await fetch(`${BASE_URL}/tools/not-a-tool`);
check(missing.status === 404, "unknown tool route returns 404");

if (failures.length > 0) {
  console.error(`\n${failures.length} smoke check(s) failed.`);
  process.exit(1);
}

console.log("\nAll smoke checks passed.");
