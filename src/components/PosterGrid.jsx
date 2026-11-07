import { useEffect, useRef, useState } from "react";
import { FaArrowDownLong } from "react-icons/fa6";
import { motion, useReducedMotion } from "motion/react";
import PosterModal from "./PosterModal";

const INITIAL_POSTER_COUNT = 10;
const LOAD_BATCH_SIZE = 50;
const ENTRANCE_STAGGER_COUNT = 10;

// The source posters share nearly the same portrait ratio, so their natural
// dimensions produce a uniform grid. These spans recreate the staggered Figma
// composition while the modal continues to show each full, uncropped image.
const MOSAIC_ROW_SPANS = [
	"[grid-row:span_29]",
	"[grid-row:span_29]",
	"[grid-row:span_15]",
	"[grid-row:span_45]",
	"[grid-row:span_45]",
	"[grid-row:span_15]",
	"[grid-row:span_15]",
	"[grid-row:span_29]",
	"[grid-row:span_37]",
	"[grid-row:span_21]",
	"[grid-row:span_29]",
	"[grid-row:span_45]",
];

function PosterCard({ poster, index, posterSet, standalone = false }) {
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [isImageReady, setIsImageReady] = useState(false);
	const shouldReduceMotion = useReducedMotion();
	const label = `Poster ${String(poster.poster_number).padStart(2, "0")}`;
	const entranceDelay = shouldReduceMotion
		? 0
		: (index % ENTRANCE_STAGGER_COUNT) * 0.055;
	const layoutClass = standalone
		? "min-w-0"
		: `min-w-0 ${MOSAIC_ROW_SPANS[index % MOSAIC_ROW_SPANS.length]}`;

	async function handleImageLoad(event) {
		const image = event.currentTarget;
		try {
			await image.decode();
		} catch {
			// A completed load can still be presented if decode() is unavailable.
		}
		setIsImageReady(true);
	}

	return (
		<>
			<motion.article
				className={layoutClass}
				initial={false}
				animate={
					isImageReady
						? { opacity: 1, y: 0, scale: 1 }
						: {
								opacity: 0,
								y: shouldReduceMotion ? 0 : 30,
								scale: shouldReduceMotion ? 1 : 0.955,
							}
				}
				transition={{
					default: {
						type: "spring",
						stiffness: 210,
						damping: 19,
						mass: 0.82,
						delay: entranceDelay,
					},
					opacity: {
						duration: shouldReduceMotion ? 0.15 : 0.28,
						delay: entranceDelay,
					},
				}}
			>
				<motion.button
					type="button"
					onClick={() => setIsModalOpen(true)}
					whileHover={shouldReduceMotion ? undefined : { scale: 1.012 }}
					whileTap={shouldReduceMotion ? undefined : { scale: 0.995 }}
					transition={{ type: "spring", stiffness: 340, damping: 24 }}
					className={`relative block w-full cursor-zoom-in overflow-hidden border border-contrast-ink bg-contrast-white p-0 text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-contrast-orange ${standalone ? "aspect-3/4" : "h-full"}`}
					aria-label={`View ${label}`}
				>
					<img
						src={poster.imageUrl}
						alt={label}
						loading={index < INITIAL_POSTER_COUNT ? "eager" : "lazy"}
						onLoad={handleImageLoad}
						onError={() => setIsImageReady(true)}
						className="block h-full w-full object-cover"
					/>
				</motion.button>
			</motion.article>
			{isModalOpen && (
				<PosterModal
					initialPoster={poster}
					posters={posterSet}
					onClose={() => setIsModalOpen(false)}
				/>
			)}
		</>
	);
}

function PosterGrid({ posters, loading, error, onRetry }) {
	const [visibleCount, setVisibleCount] = useState(INITIAL_POSTER_COUNT);
	const [isInfiniteScrollEnabled, setIsInfiniteScrollEnabled] = useState(false);
	const loadMoreRef = useRef(null);
	const hasMorePosters = visibleCount < posters.length;
	const visiblePosters = posters.slice(0, visibleCount);

	useEffect(() => {
		setVisibleCount(INITIAL_POSTER_COUNT);
		setIsInfiniteScrollEnabled(false);
	}, [posters.length]);

	useEffect(() => {
		const loadMoreElement = loadMoreRef.current;
		if (!isInfiniteScrollEnabled || !hasMorePosters || !loadMoreElement)
			return undefined;

		const scrollContainer = loadMoreElement.closest("[data-poster-scroll]");
		const observer = new IntersectionObserver(
			(entries) => {
				if (!entries[0].isIntersecting) return;
				setVisibleCount((count) =>
					Math.min(count + LOAD_BATCH_SIZE, posters.length),
				);
			},
			{
				root: scrollContainer,
				rootMargin: "800px 0px",
			},
		);

		observer.observe(loadMoreElement);
		return () => observer.disconnect();
	}, [hasMorePosters, isInfiniteScrollEnabled, posters.length]);

	if (loading)
		return (
			<div
				className="border border-contrast-line bg-contrast-white px-6 py-12 text-center"
				role="status"
				aria-live="polite"
			>
				<p className="text-lg font-black uppercase tracking-tight">
					Loading the collection
					<span
						className="ml-1 inline-flex items-end gap-0.5"
						aria-hidden="true"
					>
						<span className="animate-bounce [animation-delay:-0.3s] motion-reduce:animate-none">
							.
						</span>
						<span className="animate-bounce [animation-delay:-0.15s] motion-reduce:animate-none">
							.
						</span>
						<span className="animate-bounce motion-reduce:animate-none">.</span>
					</span>
				</p>
				<p className="mt-2 text-sm italic text-contrast-muted">
					still faster than InDesign...
				</p>
			</div>
		);
	if (error)
		return (
			<div className="border border-red-700 bg-red-50 p-6 text-center text-red-900">
				<p>Could not load the poster archive: {error}</p>
				<button
					type="button"
					onClick={onRetry}
					className="mt-4 border border-current px-4 py-2 font-bold"
				>
					Try again
				</button>
			</div>
		);
	if (!posters.length)
		return (
			<p className="border border-contrast-line bg-contrast-white p-8 text-center text-contrast-muted">
				The archive is ready for its first poster.
			</p>
		);

	function enableInfiniteScroll() {
		setIsInfiniteScrollEnabled(true);
		setVisibleCount((count) =>
			Math.min(count + LOAD_BATCH_SIZE, posters.length),
		);
	}

	return (
		<div>
			<div
				id="poster-collection-grid"
				className="grid grid-flow-dense grid-cols-2 gap-3 pb-24 auto-rows-.25 sm:grid-cols-4 sm:gap-4"
				aria-label="Austin poster collection"
			>
				{visiblePosters.map((poster, index) => (
					<PosterCard
						key={poster.id}
						poster={poster}
						index={index}
						posterSet={posters}
					/>
				))}
			</div>
			{hasMorePosters && !isInfiniteScrollEnabled ? (
				<div className="flex justify-center">
					<button
						type="button"
						onClick={enableInfiniteScroll}
						aria-controls="poster-collection-grid"
						aria-describedby="poster-scroll-description"
						className="inline-flex items-center gap-3 rounded-full bg-contrast-orange px-6 py-3 font-semibold text-contrast-ink shadow-lg transition-colors hover:bg-contrast-orange-hover hover:text-contrast-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-contrast-ink"
					>
						View more
						<FaArrowDownLong aria-hidden="true" />
					</button>
					<p id="poster-scroll-description" className="sr-only">
						Loads 50 posters at a time as you continue scrolling.
					</p>
				</div>
			) : hasMorePosters ? (
				<div
					ref={loadMoreRef}
					className="flex min-h-24 items-center justify-center text-sm text-contrast-muted"
					role="status"
					aria-label="More posters load automatically near the end of the collection"
				>
					Keep scrolling for more posters
				</div>
			) : (
				<p className="border-t border-contrast-line py-10 text-center text-sm text-contrast-muted">
					You’ve reached the end of the collection.
				</p>
			)}
			<p className="sr-only" aria-live="polite">
				Showing {visiblePosters.length} of {posters.length} posters.
			</p>
		</div>
	);
}

export { PosterGrid, PosterCard };
