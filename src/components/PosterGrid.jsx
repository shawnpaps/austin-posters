import { useEffect, useRef, useState } from "react";
import { FaArrowDownLong } from "react-icons/fa6";
import { posters } from "../data/posters";

const INITIAL_POSTER_COUNT = 8;
const LOAD_BATCH_SIZE = 8;

function PosterCard({ poster, index }) {
	const [primary, secondary, accent] = poster.colors;

	return (
		<article className={`poster-card poster-card--${poster.format}`}>
			<button
				type="button"
				className="poster-card__button focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-contrast-orange"
				aria-label={`View ${poster.title}, ${poster.year}`}
			>
				<div
					className="poster-art"
					style={{
						"--poster-primary": primary,
						"--poster-secondary": secondary,
						"--poster-accent": accent,
					}}
				>
					<span className="poster-art__number" aria-hidden="true">
						{String(index + 1).padStart(2, "0")}
					</span>
					<span className="poster-art__shape" aria-hidden="true" />
					<span className="poster-art__title">{poster.title}</span>
					<span className="poster-art__year">Austin · {poster.year}</span>
				</div>
			</button>
		</article>
	);
}

function PosterGrid() {
	const [isExpanded, setIsExpanded] = useState(false);
	const [visibleCount, setVisibleCount] = useState(INITIAL_POSTER_COUNT);
	const loadMoreRef = useRef(null);
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

	function showFullCollection() {
		setIsExpanded(true);
		setVisibleCount((currentCount) =>
			Math.min(currentCount + LOAD_BATCH_SIZE, posters.length),
		);
	}

	return (
		<div id="infinite-scroll-container">
			<div id="main-poster-grid" aria-label="Austin poster collection">
				{visiblePosters.map((poster, index) => (
					<PosterCard key={poster.id} poster={poster} index={index} />
				))}
			</div>

			{!isExpanded && (
				<div className="flex justify-center border-t border-contrast-line py-10">
					<button
						type="button"
						onClick={showFullCollection}
						className="inline-flex items-center gap-3 rounded-full bg-contrast-orange px-6 py-3 font-semibold text-contrast-ink transition-colors hover:bg-contrast-orange-hover hover:text-contrast-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-contrast-ink"
					>
						See full collection
						<FaArrowDownLong aria-hidden="true" />
					</button>
				</div>
			)}

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
