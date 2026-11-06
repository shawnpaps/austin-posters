import { execFile as execFileCallback } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, extname, join } from "node:path";
import { promisify } from "node:util";

import { createClient } from "@supabase/supabase-js";

import { buildOptimizedImagePath } from "../src/lib/imageOptimization.js";

const execFile = promisify(execFileCallback);
const projectUrl = process.env.SUPABASE_URL || "https://ppltdobcwaunprldlerw.supabase.co";
const secretKey = process.env.SUPABASE_SECRET_KEY;
const sourceFolder = process.argv[2];
const cwebpBinary = process.env.CWEBP_BINARY || "cwebp";
const maxDimension = 1600;
const quality = 78;

if (!secretKey) throw new Error("Set SUPABASE_SECRET_KEY in the local environment.");
if (!sourceFolder) throw new Error("Pass the folder containing the numbered original images.");

const supabase = createClient(projectUrl, secretKey, {
	auth: { autoRefreshToken: false, persistSession: false },
});

async function getDimensions(filePath) {
	const { stdout } = await execFile("sips", ["-g", "pixelWidth", "-g", "pixelHeight", filePath]);
	const width = Number(stdout.match(/pixelWidth:\s*(\d+)/)?.[1]);
	const height = Number(stdout.match(/pixelHeight:\s*(\d+)/)?.[1]);
	if (!width || !height) throw new Error(`Could not read dimensions for ${basename(filePath)}.`);
	return { width, height };
}

async function encodeWebp(sourcePath, outputPath) {
	const { width, height } = await getDimensions(sourcePath);
	const scale = Math.min(1, maxDimension / Math.max(width, height));
	const targetWidth = Math.max(1, Math.round(width * scale));
	const targetHeight = Math.max(1, Math.round(height * scale));
	const args = ["-quiet", "-q", String(quality), "-metadata", "none"];
	if (scale < 1) args.push("-resize", String(targetWidth), String(targetHeight));
	args.push(sourcePath, "-o", outputPath);
	await execFile(cwebpBinary, args);
}

async function objectExists(objectPath) {
	const index = objectPath.lastIndexOf("/");
	const folder = index === -1 ? "" : objectPath.slice(0, index);
	const filename = index === -1 ? objectPath : objectPath.slice(index + 1);
	const { data, error } = await supabase.storage
		.from("posters")
		.list(folder, { limit: 100, search: filename });
	if (error) throw error;
	return (data || []).some((object) => object.name === filename);
}

const sourceFiles = await readdir(sourceFolder, { withFileTypes: true });
const filesByNumber = new Map(
	sourceFiles
		.filter((entry) => entry.isFile() && /^\d+\.(jpe?g|png|webp)$/i.test(entry.name))
		.map((entry) => [Number(entry.name.replace(/\.[^.]+$/, "")), join(sourceFolder, entry.name)]),
);

const { data: posters, error: postersError } = await supabase
	.from("posters")
	.select("id, poster_number, image, optimized_image")
	.is("optimized_image", null)
	.order("poster_number", { ascending: true });
if (postersError) throw postersError;

const temporaryDirectory = await mkdtemp(join(tmpdir(), "austin-posters-web-"));
let completed = 0;
const failures = [];

try {
	for (const poster of posters) {
		const sourcePath = filesByNumber.get(poster.poster_number);
		const optimizedPath = buildOptimizedImagePath(poster.image);
		try {
			if (!sourcePath) throw new Error("No matching numbered source file.");
			if (!(await objectExists(optimizedPath))) {
				const outputPath = join(
					temporaryDirectory,
					`${String(poster.poster_number).padStart(3, "0")}${extname(optimizedPath)}`,
				);
				await encodeWebp(sourcePath, outputPath);
				const webp = await readFile(outputPath);
				const { error: uploadError } = await supabase.storage
					.from("posters")
					.upload(optimizedPath, webp, {
						cacheControl: "31536000",
						contentType: "image/webp",
						upsert: false,
					});
				if (uploadError) throw uploadError;
			}

			const { error: updateError } = await supabase
				.from("posters")
				.update({ optimized_image: optimizedPath })
				.eq("id", poster.id);
			if (updateError) throw updateError;
			completed += 1;
			process.stdout.write(`Optimized ${completed + failures.length}/${posters.length}: poster ${poster.poster_number}\n`);
		} catch (error) {
			failures.push({ posterNumber: poster.poster_number, message: error.message });
			process.stderr.write(`Poster ${poster.poster_number} failed: ${error.message}\n`);
		}
	}
} finally {
	await rm(temporaryDirectory, { recursive: true, force: true });
}

console.log(`Optimization complete: ${completed} succeeded, ${failures.length} failed.`);
if (failures.length) process.exitCode = 1;
