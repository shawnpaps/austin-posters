import { buildOptimizedImagePath } from "./imageOptimization.js";

export const SUPPORTED_IMAGE_TYPES = new Set([
	"image/jpeg",
	"image/png",
	"image/webp",
	"image/gif",
	"image/avif",
]);

export const SUPPORTED_EXTENSIONS = new Set([
	"jpg",
	"jpeg",
	"png",
	"webp",
	"gif",
	"avif",
]);

export const RESUMABLE_UPLOAD_THRESHOLD = 6 * 1024 * 1024;

export function isHiddenFile(file) {
	const path = file.webkitRelativePath || file.name;
	return path.split("/").some((part) => part.startsWith("."));
}

export function getExtension(filename) {
	return filename.includes(".")
		? filename.split(".").pop().toLowerCase()
		: "";
}

export function isSupportedImage(file) {
	const extension = getExtension(file.name);
	return (
		SUPPORTED_EXTENSIONS.has(extension) &&
		(!file.type || SUPPORTED_IMAGE_TYPES.has(file.type))
	);
}

export function parsePosterNumber(filename) {
	const stem = filename.replace(/\.[^.]+$/, "");
	if (!/^\d+$/.test(stem)) return null;
	const number = Number(stem);
	return Number.isSafeInteger(number) && number > 0 ? number : null;
}

export function buildObjectPath(posterNumber, filename, folder = "old") {
	const extension = getExtension(filename) || "jpg";
	return `${folder}/${String(posterNumber).padStart(2, "0")}.${extension}`;
}

export function prepareFiles(files) {
	return Array.from(files)
		.filter((file) => !isHiddenFile(file) && isSupportedImage(file))
		.map((file, index) => {
			const posterNumber = parsePosterNumber(file.name);
			return {
				key: `${file.name}-${file.size}-${file.lastModified}-${index}`,
				file,
				filename: file.name,
				posterNumber,
				objectPath: posterNumber
					? buildObjectPath(posterNumber, file.name)
					: null,
				optimizedPath: posterNumber
					? buildOptimizedImagePath(buildObjectPath(posterNumber, file.name))
					: null,
				status: posterNumber ? "ready" : "invalid",
				progress: 0,
				error: posterNumber ? null : "Filename must contain only a number.",
				uploaded: false,
				optimizedUploaded: false,
			};
		});
}

export function markConflicts(items, existingNumbers = new Set()) {
	const counts = new Map();
	for (const item of items) {
		if (item.posterNumber) {
			counts.set(item.posterNumber, (counts.get(item.posterNumber) || 0) + 1);
		}
	}

	return items.map((item) => {
		if (!item.posterNumber) {
			return { ...item, status: "invalid", error: "Enter a positive poster number." };
		}
		if ((counts.get(item.posterNumber) || 0) > 1) {
			return {
				...item,
				status: "conflict-selection",
				error: `Poster ${item.posterNumber} appears more than once in this selection.`,
			};
		}
		if (existingNumbers.has(item.posterNumber)) {
			return {
				...item,
				status: "conflict-existing",
				error: `Poster ${item.posterNumber} already exists and will be skipped.`,
			};
		}
		return {
			...item,
			status: item.status === "imported" ? "imported" : "ready",
			error: null,
			objectPath: buildObjectPath(item.posterNumber, item.filename),
			optimizedPath: buildOptimizedImagePath(
				buildObjectPath(item.posterNumber, item.filename),
			),
		};
	});
}

export async function runWithConcurrency(items, worker, limit = 3) {
	const queue = [...items];
	const workers = Array.from(
		{ length: Math.min(limit, queue.length) },
		async () => {
			while (queue.length) {
				const item = queue.shift();
				await worker(item);
			}
		},
	);
	await Promise.all(workers);
}

export async function importPosterItem({ item, upload, insert }) {
	if (!item.uploaded) await upload(item);
	await insert(item);
	return { ...item, uploaded: true, status: "imported", progress: 100 };
}

export function formatFileSize(bytes) {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
