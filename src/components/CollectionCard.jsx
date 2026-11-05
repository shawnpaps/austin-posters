import { useState } from "react";

import { PosterCard } from "./PosterGrid";

function ExpandedCollection({ posters, posterCount }) {
	const visiblePosters = posters.slice(0, posterCount);

	return (
		<div className="col-span-4 grid grid-cols-1">
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
			<div
				id="collection-card"
				className="relative col-span-4 text-contrast-white"
			>
				<figure>
					<img
						className="block aspect-square w-full object-cover"
						src={imageSrc}
						alt=""
					/>
				</figure>
				<span className="text-6xl absolute top-0 p-2">{title}</span>
				<button
					type="button"
					onClick={toggleExpandCollection}
					className="absolute bottom-0 right-0 bg-contrast-orange hover:bg-contrast-orange-hover transition-all ease-linear m-2 p-4"
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
