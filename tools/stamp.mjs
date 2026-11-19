// Writes src/build-id.ts so the page can report which build it is running.
// A stamp on the page and in the console settles "am I looking at a stale
// script?" in one glance. Same convention as wieringa-roof.
import { writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const stamp = new Date().toISOString().slice(11, 19);
writeFileSync("src/build-id.ts", `export const BUILD_ID = "${stamp}";\n`);
console.log(`build id ${stamp}`);

// discrete-directions is its own project with its own stamp -- it has no build
// step, so nothing else would write one. Passing this stamp through means both
// report the same id for one build rather than two a second apart.
execFileSync(process.execPath, ["discrete-directions/tools/stamp.mjs", stamp],
    { stdio: "inherit" });
