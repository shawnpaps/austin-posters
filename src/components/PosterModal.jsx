import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
	FaArrowLeftLong,
	FaArrowRightLong,
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
	const label = `Poster ${String(currentPoster.poster_number).padStart(3, "0")}`;
	const showPrevious = () =>
		setCurrentIndex((index) => (index - 1 + posters.length) % posters.length);
	const showNext = () =>
		setCurrentIndex((index) => (index + 1) % posters.length);
	function showRandom() {
		if (posters.length < 2) return;
		setCurrentIndex((index) => {
			let next = index;
			while (next === index) next = Math.floor(Math.random() * posters.length);
			return next;
		});
	}

	useEffect(() => {
		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		closeButtonRef.current?.focus();
		function handleKeyDown(event) {
			if (event.key === "Escape") onClose();
			if (event.key === "ArrowLeft")
				setCurrentIndex(
					(index) => (index - 1 + posters.length) % posters.length,
				);
			if (event.key === "ArrowRight")
				setCurrentIndex((index) => (index + 1) % posters.length);
		}
		window.addEventListener("keydown", handleKeyDown);
		return () => {
			document.body.style.overflow = previousOverflow;
			window.removeEventListener("keydown", handleKeyDown);
		};
	}, [onClose, posters.length]);

	return createPortal(
		<div
			className="fixed inset-0 z-100 grid place-items-center p-0 sm:p-5"
			onMouseDown={(event) => event.target === event.currentTarget && onClose()}
		>
			<section
				className="relative grid h-dvh w-full grid-rows-[minmax(0,1fr)_auto] overflow-hidden bg-contrast-paper shadow-2xl sm:h-[min(94dvh,62rem)] sm:max-w-3xl"
				role="dialog"
				aria-modal="true"
				aria-labelledby="poster-modal-title"
			>
				<button
					ref={closeButtonRef}
					type="button"
					className="absolute right-4 top-4 z-10 grid h-11 w-11 place-items-center rounded-full border border-contrast-ink bg-contrast-paper"
					onClick={onClose}
					aria-label="Close poster viewer"
				>
					<FaXmark aria-hidden="true" />
				</button>
				<div className="grid grid-cols-4 min-h-0 place-items-center overflow-auto p-5 pt-16">
					<img
						src={currentPoster.imageUrl}
						alt={label}
						className="max-h-full col-span-4 max-w-full object-contain"
					/>
				</div>
				<div className="p-5">
					<h2 className="text-5xl">{label}</h2>
					<p>{currentPoster.category}</p>
					<p>{currentPoster.date_created}</p>
					<p className="text-xs">Collect & Contrast</p>
				</div>

				<div className="grid grid-cols-[auto_1fr_auto] items-center gap-4 p-4">
					<button
						type="button"
						onClick={showPrevious}
						aria-label="View previous poster"
						className="grid h-14 w-14 place-items-center text-3xl"
					>
						<FaArrowLeftLong aria-hidden="true" />
					</button>
					<div className="text-center">
						<button
							type="button"
							onClick={showRandom}
							disabled={posters.length < 2}
							className=" inline-flex items-center gap-2 text-sm font-bold disabled:opacity-40"
						>
							<FaShuffle aria-hidden="true" /> Random poster
						</button>
					</div>
					<button
						type="button"
						onClick={showNext}
						aria-label="View next poster"
						className="grid h-14 w-14 place-items-center text-3xl"
					>
						<FaArrowRightLong aria-hidden="true" />
					</button>
				</div>
			</section>
		</div>,
		document.body,
	);
}

export default PosterModal;
