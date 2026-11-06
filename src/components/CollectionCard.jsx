import { useState } from "react";

import { PosterCard } from "./PosterGrid";

function ExpandedCollection({ posters, posterCount }) {
	const visiblePosters = posters.slice(0, posterCount);

	return (
		<div className="col-span-full grid grid-cols-1 gap-3 sm:grid-cols-2">
			{visiblePosters.map((poster, index) => (
				<PosterCard
					key={poster.id}
					poster={poster}
					index={index}
					posterSet={visiblePosters}
					standalone
				/>
			))}
		</div>
	);
}

function CollectionCard({
	imageSrc,
	title,
	buttonLabel,
	posters = [],
	posterCount = posters.length,
}) {
	const [expandCollection, setExpandCollection] = useState(false);

	const toggleExpandCollection = () => {
		setExpandCollection((isExpanded) => !isExpanded);
	};
	return (
		<>
			<div className="relative font-semibold">
				<figure>
					<img
						className="block aspect-square w-full object-cover"
						src={imageSrc}
						alt=""
					/>
				</figure>
				<span className="absolute top-0 p-2 text-4xl max-w-xs sm:text-6xl">
					{title}
				</span>
				<button
					type="button"
					onClick={toggleExpandCollection}
					className="absolute bottom-0 right-0 bg-contrast-orange hover:bg-contrast-orange-hover text-contrast-white transition-all ease-linear m-2 p-4"
				>
					{expandCollection ? "Hide Collection" : `${buttonLabel}`}
				</button>
			</div>
			{expandCollection && (
				<ExpandedCollection posters={posters} posterCount={posterCount} />
			)}
		</>
	);
}

export default CollectionCard;
