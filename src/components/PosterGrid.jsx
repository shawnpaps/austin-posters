import { useEffect, useRef, useState } from "react";
import { FaArrowDownLong } from "react-icons/fa6";
import { posters } from "../data/posters";
import PosterModal from "./PosterModal";

const INITIAL_POSTER_COUNT = 8;
const LOAD_BATCH_SIZE = 8;

const POSTER_LAYOUT_CLASSES = {
	portrait: "[grid-row:span_24] lg:col-span-2 lg:[grid-row:span_31]",
	tall: "[grid-row:span_31] lg:col-span-2 lg:[grid-row:span_39]",
	square: "[grid-row:span_20] lg:col-span-2 lg:[grid-row:span_27]",
	wide: "col-span-2 [grid-row:span_19] lg:col-span-3 lg:[grid-row:span_26]",
};

function getShapeClasses(index) {
	if ((index + 1) % 4 === 0) {
		return "w-[75%] rotate-45 rounded-[50%_0_50%_0]";
	}

	if ((index + 1) % 3 === 0) {
		return "w-[64%] rotate-[21deg] rounded-none";
	}

	return "w-[64%] -rotate-12 rounded-full";
}

function PosterCard({
	poster,
	index,
	posterSet = posters,
	standalone = false,
}) {
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [primary, secondary, accent] = poster.colors;
	const layoutClasses = standalone
		? "min-w-0"
		: `min-w-0 ${POSTER_LAYOUT_CLASSES[poster.format]}`;
	const buttonSizeClasses = standalone ? "h-auto aspect-[3/4]" : "h-full";

	return (
		<>
			<article className={layoutClasses}>
				<button
					type="button"
					onClick={() => setIsModalOpen(true)}
					className={`group w-full cursor-pointer overflow-hidden border border-contrast-ink bg-contrast-white p-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-contrast-orange ${buttonSizeClasses}`}
					aria-label={`View ${poster.title}, ${poster.year}`}
				>
					<div
						className="relative flex h-full flex-col justify-end overflow-hidden p-[clamp(0.75rem,2vw,1.5rem)] text-left transition-transform duration-[220ms] ease-in-out group-hover:scale-[1.02] motion-reduce:transition-none"
						style={{
							color: accent,
							background: `linear-gradient(135deg, transparent 48%, color-mix(in srgb, ${accent} 18%, transparent) 49% 58%, transparent 59%), ${primary}`,
						}}
					>
						<span
							className="absolute right-3 top-3 z-[2] text-[0.7rem] font-extrabold tracking-[0.12em]"
							aria-hidden="true"
						>
							{String(index + 1).padStart(2, "0")}
						</span>
						<span
							className={`absolute left-[12%] top-[13%] aspect-square border-[clamp(12px,3vw,36px)] ${getShapeClasses(index)}`}
							style={{
								borderColor: secondary,
								boxShadow: `2.25rem 2.25rem 0 color-mix(in srgb, ${accent} 68%, transparent)`,
							}}
							aria-hidden="true"
						/>
						<span className="relative z-[2] max-w-[12ch] text-[clamp(1.1rem,3.2vw,2.5rem)] font-black uppercase leading-[0.88] tracking-[-0.055em]">
							{poster.title}
						</span>
						<span className="relative z-[2] mt-[0.65rem] text-[0.67rem] font-extrabold uppercase tracking-[0.08em]">
							Austin · {poster.year}
						</span>
					</div>
				</button>
			</article>

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

function PosterGrid() {
	const [isExpanded, setIsExpanded] = useState(false);
	const [visibleCount, setVisibleCount] = useState(INITIAL_POSTER_COUNT);
	const loadMoreRef = useRef(null);
	const collectionRef = useRef(null);
	const hasMorePosters = visibleCount < posters.length;
	const visiblePosters = posters.slice(0, visibleCount);

	useEffect(() => {
		if (!isExpanded || !hasMorePosters || !loadMoreRef.current) return;

		const observer = new IntersectionObserver(
			([entry]) => {
				if (!entry.isIntersecting) return;

				setVisibleCount((currentCount) =>
					Math.min(currentCount + LOAD_BATCH_SIZE, posters.length),
				);
			},
			{ rootMargin: "500px 0px" },
		);

		observer.observe(loadMoreRef.current);

		return () => observer.disconnect();
	}, [hasMorePosters, isExpanded, visibleCount]);

	function toggleCollection() {
		if (isExpanded) {
			collectionRef.current?.parentElement?.scrollTo({ top: 0 });
			setVisibleCount(INITIAL_POSTER_COUNT);
			setIsExpanded(false);
			return;
		}

		setIsExpanded(true);
		setVisibleCount((currentCount) =>
			Math.min(currentCount + LOAD_BATCH_SIZE, posters.length),
		);
	}

	return (
		<div ref={collectionRef}>
			<div
				id="poster-collection-grid"
				className="relative grid grid-flow-dense grid-cols-2 gap-3 pb-24 [grid-auto-rows:12px] sm:grid-cols-4 sm:gap-4 lg:grid-cols-6"
				aria-label="Austin poster collection"
			>
				{visiblePosters.map((poster, index) => (
					<PosterCard key={poster.id} poster={poster} index={index} />
				))}
			</div>

			<div className="pointer-events-none sticky bottom-5 z-20 flex justify-center">
				<button
					type="button"
					onClick={toggleCollection}
					aria-expanded={isExpanded}
					aria-controls="poster-collection-grid"
					className="pointer-events-auto inline-flex items-center gap-3 rounded-full bg-contrast-orange px-6 py-3 font-semibold text-contrast-ink shadow-lg transition-colors hover:bg-contrast-orange-hover hover:text-contrast-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-contrast-ink"
				>
					{isExpanded ? "Collapse collection" : "See full collection"}
					<FaArrowDownLong
						className={`transition-transform ${isExpanded ? "rotate-180" : ""}`}
						aria-hidden="true"
					/>
				</button>
			</div>

			{isExpanded && hasMorePosters && (
				<div
					ref={loadMoreRef}
					className="flex min-h-32 items-center justify-center text-sm text-contrast-muted"
					aria-hidden="true"
				>
					Loading more posters…
				</div>
			)}

			{isExpanded && !hasMorePosters && (
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
