export const OPTIMIZED_IMAGE_MAX_DIMENSION = 1600;
export const OPTIMIZED_IMAGE_QUALITY = 0.78;

export function buildOptimizedImagePath(originalPath) {
	const normalizedPath = String(originalPath || "").replace(/^\/+/, "");
	if (!normalizedPath) return null;
	const pathWithoutExtension = normalizedPath.replace(/\.[^/.]+$/, "");
	return `web/${pathWithoutExtension}.webp`;
}

export function getOptimizedDimensions(width, height, maxDimension = OPTIMIZED_IMAGE_MAX_DIMENSION) {
	if (!(width > 0) || !(height > 0)) {
		throw new Error("The image has invalid dimensions.");
	}
	const scale = Math.min(1, maxDimension / Math.max(width, height));
	return {
		width: Math.max(1, Math.round(width * scale)),
		height: Math.max(1, Math.round(height * scale)),
	};
}

async function loadImageSource(blob) {
	if (typeof createImageBitmap === "function") {
		const bitmap = await createImageBitmap(blob, { imageOrientation: "from-image" });
		return {
			source: bitmap,
			width: bitmap.width,
			height: bitmap.height,
			cleanup: () => bitmap.close(),
		};
	}

	const objectUrl = URL.createObjectURL(blob);
	const image = new Image();
	image.decoding = "async";
	image.src = objectUrl;
	await image.decode();
	return {
		source: image,
		width: image.naturalWidth,
		height: image.naturalHeight,
		cleanup: () => URL.revokeObjectURL(objectUrl),
	};
}

export async function optimizeImageBlob(
	input,
	{
		maxDimension = OPTIMIZED_IMAGE_MAX_DIMENSION,
		quality = OPTIMIZED_IMAGE_QUALITY,
	} = {},
) {
	const loaded = await loadImageSource(input);
	try {
		const dimensions = getOptimizedDimensions(
			loaded.width,
			loaded.height,
			maxDimension,
		);
		const canvas = document.createElement("canvas");
		canvas.width = dimensions.width;
		canvas.height = dimensions.height;
		const context = canvas.getContext("2d", { alpha: false });
		if (!context) throw new Error("This browser cannot prepare an optimized image.");
		context.imageSmoothingEnabled = true;
		context.imageSmoothingQuality = "high";
		context.drawImage(loaded.source, 0, 0, dimensions.width, dimensions.height);

		const blob = await new Promise((resolve, reject) => {
			canvas.toBlob(
				(result) => result ? resolve(result) : reject(new Error("WebP conversion failed.")),
				"image/webp",
				quality,
			);
		});
		return { blob, ...dimensions };
	} finally {
		loaded.cleanup();
	}
}
