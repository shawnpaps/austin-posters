import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
	FaArrowLeftLong,
	FaArrowRightLong,
	FaRegHeart,
	FaShuffle,
	FaXmark,
} from "react-icons/fa6";

function PosterModal({ initialPoster, posters, onClose }) {
	const initialIndex = Math.max(
		posters.findIndex((poster) => poster.id === initialPoster.id),
		0,
	);
	const [currentIndex, setCurrentIndex] = useState(initialIndex);
	const closeButtonRef = useRef(null);
	const currentPoster = posters[currentIndex];
	const [primary, secondary, accent] = currentPoster.colors;

	function showPreviousPoster() {
		setCurrentIndex((index) => (index - 1 + posters.length) % posters.length);
	}

	function showNextPoster() {
		setCurrentIndex((index) => (index + 1) % posters.length);
	}

	function showRandomPoster() {
		if (posters.length < 2) return;

		setCurrentIndex((index) => {
			let randomIndex = index;

			while (randomIndex === index) {
				randomIndex = Math.floor(Math.random() * posters.length);
			}

			return randomIndex;
		});
	}

	useEffect(() => {
		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		closeButtonRef.current?.focus();

		function handleKeyDown(event) {
			if (event.key === "Escape") onClose();
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
		};
	}, [onClose, posters.length]);

	return createPortal(
		<div
			className="fixed inset-0 z-[100] grid place-items-center bg-contrast-ink/70"
			onMouseDown={(event) => {
				if (event.target === event.currentTarget) onClose();
			}}
		>
			<section
				className="relative grid h-dvh w-full grid-rows-[minmax(0,1fr)_auto_auto] overflow-hidden bg-contrast-paper text-contrast-ink shadow-2xl sm:h-[min(100dvh,62rem)] sm:w-[min(100%,38rem)]"
				role="dialog"
				aria-modal="true"
				aria-labelledby="poster-modal-title"
			>
				<button
					ref={closeButtonRef}
					type="button"
					className="absolute right-4 top-4 z-10 grid aspect-square w-11 cursor-pointer place-items-center rounded-full border border-contrast-ink bg-contrast-paper text-inherit focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-contrast-ink"
					onClick={onClose}
					aria-label="Close poster viewer"
				>
					<FaXmark aria-hidden="true" />
				</button>

				<div className="grid min-h-0 place-items-center px-9 pb-5 pt-12 sm:px-12 sm:pt-16">
					<div
						className="relative flex h-full min-h-40 max-h-[30rem] w-full max-w-[22rem] flex-col justify-end overflow-hidden border border-contrast-ink p-[clamp(0.75rem,2vw,1.5rem)] text-left shadow-[0.65rem_0.65rem_0_var(--color-contrast-line)]"
						style={{
							color: accent,
							background: `linear-gradient(135deg, transparent 48%, color-mix(in srgb, ${accent} 18%, transparent) 49% 58%, transparent 59%), ${primary}`,
						}}
					>
						<span
							className="absolute right-3 top-3 z-[2] text-[0.7rem] font-extrabold tracking-[0.12em]"
							aria-hidden="true"
						>
							{String(currentIndex + 1).padStart(2, "0")}
						</span>
						<span
							className="absolute left-[12%] top-[13%] aspect-square w-[64%] -rotate-12 rounded-full border-[clamp(12px,3vw,36px)]"
							style={{
								borderColor: secondary,
								boxShadow: `2.25rem 2.25rem 0 color-mix(in srgb, ${accent} 68%, transparent)`,
							}}
							aria-hidden="true"
						/>
						<span className="relative z-[2] max-w-[12ch] text-[clamp(1.1rem,3.2vw,2.5rem)] font-black uppercase leading-[0.88] tracking-[-0.055em]">
							{currentPoster.title}
						</span>
						<span className="relative z-[2] mt-[0.65rem] text-[0.67rem] font-extrabold uppercase tracking-[0.08em]">
							Austin · {currentPoster.year}
						</span>
					</div>
				</div>

				<div className="px-4 pb-3">
					<div className="flex items-start justify-between gap-4">
						<div>
							<h2
								id="poster-modal-title"
								className="m-0 text-[clamp(3rem,12vw,4.5rem)] font-normal leading-[0.84] tracking-[-0.075em]"
							>
								Poster {String(currentIndex + 1).padStart(3, "0")}
							</h2>
							<p className="m-0 text-[clamp(1rem,4vw,1.25rem)] leading-[1.15] tracking-[-0.045em] text-contrast-muted">
								{currentPoster.title}
							</p>
							<p className="m-0 text-[clamp(1rem,4vw,1.25rem)] leading-[1.15] tracking-[-0.045em] text-contrast-muted">
								Collect &amp; Contrast
							</p>
						</div>
						<button
							type="button"
							className="grid aspect-square w-14 shrink-0 cursor-pointer place-items-center border-0 bg-transparent text-[2.5rem] text-inherit focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-contrast-ink"
							aria-label={`Favorite ${currentPoster.title}`}
						>
							<FaRegHeart aria-hidden="true" />
						</button>
					</div>

					<div className="mt-5 flex items-center justify-between">
						<button
							type="button"
							className="grid h-16 w-20 cursor-pointer place-items-center border-0 bg-transparent text-[3.7rem] text-inherit transition-transform duration-150 hover:scale-[1.08] focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-contrast-ink"
							onClick={showPreviousPoster}
							aria-label="View previous poster"
						>
							<FaArrowLeftLong aria-hidden="true" />
						</button>
						<button
							type="button"
							className="grid h-16 w-20 cursor-pointer place-items-center border-0 bg-transparent text-[3.7rem] text-inherit transition-transform duration-150 hover:scale-[1.08] focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-contrast-ink"
							onClick={showNextPoster}
							aria-label="View next poster"
						>
							<FaArrowRightLong aria-hidden="true" />
						</button>
					</div>
				</div>

				<button
					type="button"
					className="mx-4 mb-4 inline-flex min-w-60 cursor-pointer items-center justify-center justify-self-center gap-[0.65rem] border border-contrast-ink bg-contrast-line px-6 py-4 font-bold tracking-[0.02em] text-inherit transition-colors duration-150 hover:bg-contrast-orange hover:text-contrast-white focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-contrast-ink disabled:cursor-not-allowed disabled:opacity-[0.45]"
					onClick={showRandomPoster}
					disabled={posters.length < 2}
				>
					<FaShuffle aria-hidden="true" />
					Random poster
				</button>
			</section>
		</div>,
		document.body,
	);
}

export default PosterModal;
