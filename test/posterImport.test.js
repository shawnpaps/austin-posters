import assert from "node:assert/strict";
import test from "node:test";

import {
	buildObjectPath,
	importPosterItem,
	markConflicts,
	parsePosterNumber,
	prepareFiles,
	runWithConcurrency,
} from "../src/lib/posterImport.js";
import {
	buildOptimizedImagePath,
	getOptimizedDimensions,
} from "../src/lib/imageOptimization.js";

function file(name, size = 100, type = "image/jpeg") {
	return { name, size, type, lastModified: 1, webkitRelativePath: name };
}

test("parses numeric filenames without renumbering", () => {
	assert.equal(parsePosterNumber("01.jpg"), 1);
	assert.equal(parsePosterNumber("46.jpg"), 46);
	assert.equal(parsePosterNumber("117.jpg"), 117);
	assert.equal(parsePosterNumber("poster-12.jpg"), null);
	assert.equal(buildObjectPath(1, "01.jpg"), "old/01.jpg");
	assert.equal(buildOptimizedImagePath("old/01.jpg"), "web/old/01.webp");
});

test("sizes optimized images without enlarging small originals", () => {
	assert.deepEqual(getOptimizedDimensions(4000, 6000), { width: 1067, height: 1600 });
	assert.deepEqual(getOptimizedDimensions(800, 1200), { width: 800, height: 1200 });
});

test("ignores hidden and unsupported files", () => {
	const prepared = prepareFiles([
		file("01.jpg"),
		file(".DS_Store", 10, ""),
		file("notes.txt", 10, "text/plain"),
	]);
	assert.deepEqual(prepared.map((item) => item.posterNumber), [1]);
});

test("flags selection and database duplicates", () => {
	const selected = prepareFiles([file("01.jpg"), file("1.jpeg"), file("46.jpg")]);
	const marked = markConflicts(selected, new Set([46]));
	assert.deepEqual(marked.map((item) => item.status), [
		"conflict-selection",
		"conflict-selection",
		"conflict-existing",
	]);
});

test("keeps upload failure separate from database failure and retries insert only", async () => {
	const item = { uploaded: false, status: "ready" };
	await assert.rejects(
		importPosterItem({
			item,
			upload: async () => {
				throw new Error("upload failed");
			},
			insert: async () => {},
		}),
		/upload failed/,
	);

	let uploads = 0;
	let inserts = 0;
	await assert.rejects(
		importPosterItem({
			item,
			upload: async () => {
				uploads += 1;
				item.uploaded = true;
			},
			insert: async () => {
				inserts += 1;
				throw new Error("database failed");
			},
		}),
		/database failed/,
	);
	await importPosterItem({
		item,
		upload: async () => {
			uploads += 1;
		},
		insert: async () => {
			inserts += 1;
		},
	});
	assert.equal(uploads, 1);
	assert.equal(inserts, 2);
});

test("bounds concurrent workers", async () => {
	let active = 0;
	let maximum = 0;
	await runWithConcurrency([1, 2, 3, 4, 5], async () => {
		active += 1;
		maximum = Math.max(maximum, active);
		await new Promise((resolve) => setTimeout(resolve, 5));
		active -= 1;
	}, 2);
	assert.equal(maximum, 2);
});
