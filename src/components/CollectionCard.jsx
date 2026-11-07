import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
	FaArrowLeftLong,
	FaArrowRightLong,
	FaXmark,
} from "react-icons/fa6";

function formatPosterDate(date) {
	if (!date) return "Date unavailable";

	const [year, month, day] = date.split("-").map(Number);
	if (!year || !month || !day) return date;

	return new Intl.DateTimeFormat("en-US", {
		month: "long",
		day: "numeric",
		year: "numeric",
	}).format(new Date(year, month - 1, day));
}

function CollectionPopover({
	title,
	posters,
	layoutId,
	onClose,
	returnFocusRef,
}) {
	const [currentIndex, setCurrentIndex] = useState(0);
	const closeButtonRef = useRef(null);
	const dialogRef = useRef(null);
	const sliderRef = useRef(null);
	const shouldReduceMotion = useReducedMotion();
	const currentPoster = posters[currentIndex];
	const sliderPosters = posters.filter((_, index) => index !== currentIndex);
	const posterLabel = `Poster ${String(currentPoster.poster_number).padStart(3, "0")}`;

	useEffect(() => {
		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		closeButtonRef.current?.focus();

		function handleKeyDown(event) {
			if (event.key === "Escape") onClose();
			if (event.key === "Tab") {
				const focusableElements = dialogRef.current?.querySelectorAll(
					'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
				);
				if (!focusableElements?.length) return;

				const firstElement = focusableElements[0];
				const lastElement = focusableElements[focusableElements.length - 1];
				if (event.shiftKey && document.activeElement === firstElement) {
					event.preventDefault();
					lastElement.focus();
				}
				if (!event.shiftKey && document.activeElement === lastElement) {
					event.preventDefault();
					firstElement.focus();
				}
			}
			if (event.key === "ArrowLeft") {
				setCurrentIndex(
					(index) => (index - 1 + posters.length) % posters.length,
				);
			}
			if (event.key === "ArrowRight") {
				setCurrentIndex((index) => (index + 1) % posters.length);
			}
		}

		window.addEventListener("keydown", handleKeyDown);
		return () => {
			document.body.style.overflow = previousOverflow;
			window.removeEventListener("keydown", handleKeyDown);
			returnFocusRef.current?.focus();
		};
	}, [onClose, posters.length, returnFocusRef]);

	function scrollSlider(direction) {
		sliderRef.current?.scrollBy({
			left: direction * Math.max(sliderRef.current.clientWidth * 0.75, 240),
			behavior: shouldReduceMotion ? "auto" : "smooth",
		});
	}

	return createPortal(
		<motion.div
			className="fixed inset-0 z-100 grid place-items-center bg-contrast-ink/75 p-0 sm:p-5"
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			exit={{ opacity: 0 }}
			transition={{ duration: shouldReduceMotion ? 0.1 : 0.25 }}
			onMouseDown={(event) => event.target === event.currentTarget && onClose()}
		>
			<motion.section
				ref={dialogRef}
				layoutId={layoutId}
				className="relative grid h-dvh w-full grid-rows-[minmax(0,1fr)_auto_auto] overflow-hidden bg-contrast-paper text-contrast-ink shadow-2xl sm:h-[min(94dvh,64rem)] sm:max-w-5xl sm:border sm:border-contrast-ink"
				transition={
					shouldReduceMotion
						? { duration: 0.1 }
						: { type: "spring", stiffness: 190, damping: 24, mass: 0.9 }
				}
				role="dialog"
				aria-modal="true"
				aria-labelledby={`${layoutId}-title`}
			>
				<button
					ref={closeButtonRef}
					type="button"
					onClick={onClose}
					className="absolute right-4 top-4 z-20 grid size-11 place-items-center rounded-full border border-contrast-ink bg-contrast-paper text-lg transition-colors hover:bg-contrast-orange focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-contrast-orange"
					aria-label="Close collection"
				>
					<FaXmark aria-hidden="true" />
				</button>

				<div className="grid min-h-0 place-items-center overflow-hidden p-5 pb-3 pt-16 sm:p-8 sm:pb-4 sm:pt-8">
					<AnimatePresence mode="wait" initial={false}>
						<motion.img
							key={currentPoster.id}
							src={currentPoster.imageUrl}
							alt={posterLabel}
							initial={
								shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: 28 }
							}
							animate={{ opacity: 1, x: 0 }}
							exit={
								shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: -28 }
							}
							transition={{ duration: shouldReduceMotion ? 0.1 : 0.22 }}
							className="h-full min-h-0 max-w-full object-contain"
						/>
					</AnimatePresence>
				</div>

				<div className="grid gap-2 border-t border-contrast-line px-5 py-4 sm:grid-cols-[1fr_auto] sm:items-end sm:px-8">
					<div>
						<p className="text-xs font-bold uppercase tracking-[0.2em] text-contrast-orange">
							{title}
						</p>
						<h2
							id={`${layoutId}-title`}
							className="mt-1 text-3xl font-black uppercase tracking-tight sm:text-5xl"
						>
							{posterLabel}
						</h2>
					</div>
					<dl className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm sm:text-right">
						<div>
							<dt className="text-xs uppercase tracking-wide text-contrast-muted">
								Created
							</dt>
							<dd className="font-semibold">
								{formatPosterDate(currentPoster.date_created)}
							</dd>
						</div>
						<div>
							<dt className="text-xs uppercase tracking-wide text-contrast-muted">
								Designer
							</dt>
							<dd className="font-semibold">Collect &amp; Contrast</dd>
						</div>
					</dl>
				</div>

				{sliderPosters.length > 0 && (
					<div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 border-t border-contrast-line px-3 py-3 sm:gap-4 sm:px-5">
						<button
							type="button"
							onClick={() => scrollSlider(-1)}
							className="grid size-10 place-items-center transition-colors hover:text-contrast-orange focus-visible:outline-2 focus-visible:outline-contrast-orange"
							aria-label="Scroll toward earlier posters"
						>
							<FaArrowLeftLong aria-hidden="true" />
						</button>
						<div
							ref={sliderRef}
							className="flex snap-x snap-mandatory gap-2 overflow-x-auto overscroll-x-contain sm:gap-3"
							aria-label="Other posters in this collection"
						>
							{sliderPosters.map((poster) => {
								const posterIndex = posters.findIndex(
									(candidate) => candidate.id === poster.id,
								);
								const label = `Poster ${String(poster.poster_number).padStart(3, "0")}`;

								return (
									<motion.button
										key={poster.id}
										type="button"
										onClick={() => setCurrentIndex(posterIndex)}
										whileHover={
											shouldReduceMotion ? undefined : { y: -3 }
										}
										whileTap={
											shouldReduceMotion ? undefined : { scale: 0.97 }
										}
										className="w-16 shrink-0 snap-start border border-contrast-ink bg-contrast-white p-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-contrast-orange sm:w-20"
										aria-label={`Feature ${label}`}
									>
										<img
											src={poster.imageUrl}
											alt=""
											loading="lazy"
											className="aspect-3/4 w-full object-cover"
										/>
									</motion.button>
								);
							})}
						</div>
						<button
							type="button"
							onClick={() => scrollSlider(1)}
							className="grid size-10 place-items-center transition-colors hover:text-contrast-orange focus-visible:outline-2 focus-visible:outline-contrast-orange"
							aria-label="Scroll toward later posters"
						>
							<FaArrowRightLong aria-hidden="true" />
						</button>
					</div>
				)}
			</motion.section>
		</motion.div>,
		document.body,
	);
}

function CollectionCard({
	imageSrc,
	title,
	buttonLabel,
	posters = [],
	posterCount = posters.length,
}) {
	const [isOpen, setIsOpen] = useState(false);
	const openButtonRef = useRef(null);
	const shouldReduceMotion = useReducedMotion();
	const instanceId = useId().replaceAll(":", "");
	const layoutId = `collection-${instanceId}`;
	const visiblePosters = posters.slice(0, posterCount);

	return (
		<>
			<motion.article
				layoutId={layoutId}
				className="relative overflow-hidden bg-contrast-ink font-semibold text-contrast-white"
				transition={
					shouldReduceMotion
						? { duration: 0.1 }
						: { type: "spring", stiffness: 190, damping: 24, mass: 0.9 }
				}
			>
				<img
					className="block aspect-square w-full object-cover"
					src={imageSrc}
					alt=""
				/>
				<h3 className="absolute left-0 top-0 max-w-xs p-3 text-4xl leading-none tracking-tight drop-shadow-sm sm:text-6xl">
					{title}
				</h3>
				<button
					ref={openButtonRef}
					type="button"
					onClick={() => setIsOpen(true)}
					disabled={!visiblePosters.length}
					className="absolute bottom-0 right-0 m-3 bg-contrast-orange p-4 text-contrast-white transition-colors hover:bg-contrast-orange-hover focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-contrast-white disabled:cursor-not-allowed disabled:opacity-50"
				>
					{buttonLabel}
				</button>
			</motion.article>

			<AnimatePresence>
				{isOpen && visiblePosters.length > 0 && (
					<CollectionPopover
						title={title}
						posters={visiblePosters}
						layoutId={layoutId}
						onClose={() => setIsOpen(false)}
						returnFocusRef={openButtonRef}
					/>
				)}
			</AnimatePresence>
		</>
	);
}

export default CollectionCard;
