import assert from "node:assert/strict";
import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";

import { prepareFiles } from "../src/lib/posterImport.js";

const folder = process.argv[2];
if (!folder) throw new Error("Pass the poster folder path as the first argument.");

const entries = await readdir(folder, { withFileTypes: true });
const files = await Promise.all(
	entries.filter((entry) => entry.isFile()).map(async (entry) => {
		const details = await stat(join(folder, entry.name));
		return {
			name: entry.name,
			size: details.size,
			type: entry.name.toLowerCase().endsWith(".jpg") ? "image/jpeg" : "",
			lastModified: details.mtimeMs,
			webkitRelativePath: entry.name,
		};
	}),
);
const prepared = prepareFiles(files);
const numbers = prepared.map((item) => item.posterNumber).sort((a, b) => a - b);
const totalBytes = prepared.reduce((sum, item) => sum + item.file.size, 0);
const largestBytes = Math.max(...prepared.map((item) => item.file.size));

assert.equal(prepared.length, 116);
assert.equal(numbers[0], 1);
assert.equal(numbers.at(-1), 117);
assert.equal(numbers.includes(25), false);
assert.equal(new Set(numbers).size, prepared.length);
assert(prepared.every((item) => item.status === "ready"));

console.log(JSON.stringify({ files: prepared.length, first: numbers[0], last: numbers.at(-1), missing: [25], totalMB: (totalBytes / 1024 / 1024).toFixed(1), largestMB: (largestBytes / 1024 / 1024).toFixed(1) }));
