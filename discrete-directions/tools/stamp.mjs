// Writes src/ui/build-id.js so the page can report which build it is running.
// A stamp on the page and in the console settles "am I looking at a stale
// script?" in one glance -- the same convention as the parent repo and
// wieringa-roof.
//
// There is no build step here: these are plain ES modules the browser loads as
// they are, so this is the only generated file in the project. It takes the
// stamp as an argument when the parent's `npm run stamp` calls it, so both
// projects report the SAME id for one build; run alone it stamps the clock.
//
// Paths resolve against this file, not the working directory, so it can be
// called from either repo root.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const stamp = process.argv[2] || new Date().toISOString().slice(11, 19);
const out = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "ui", "build-id.js");
writeFileSync(out, `export const BUILD_ID = "${stamp}";\n`);
console.log(`discrete-directions build id ${stamp}`);
