// Writes src/build-id.ts so the page can report which build it is running.
// A stamp on the page and in the console settles "am I looking at a stale
// script?" in one glance. Same convention as wieringa-roof.
import { writeFileSync } from "node:fs";

const stamp = new Date().toISOString().slice(11, 19);
writeFileSync("src/build-id.ts", `export const BUILD_ID = "${stamp}";\n`);
console.log(`build id ${stamp}`);
