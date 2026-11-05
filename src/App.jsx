import { PosterGrid, PosterCard } from "./components/PosterGrid";
import headshot from "./assets/images/Austin.webp";
import { posters } from "./data/posters";
function App() {
	return (
		<main className="min-h-screen bg-contrast-paper text-contrast-ink">
			<header className="border-b border-contrast-line px-5 py-8 sm:px-8 lg:px-12">
				<p className="text-xs font-semibold uppercase tracking-[0.22em] text-contrast-orange">
					The archive
				</p>
				<h1 className="mt-2 text-4xl font-black uppercase tracking-[-0.05em] sm:text-6xl">
					Austin Posters
				</h1>
			</header>

			<section
				className="px-5 py-6 sm:px-8 lg:px-12 lg:py-10"
				aria-labelledby="collection-heading"
			>
				<div className="mb-6 flex items-end justify-between gap-6">
					<h2
						id="collection-heading"
						className="text-lg font-bold uppercase tracking-tight"
					>
						Poster collection
					</h2>
					<p className="text-sm text-contrast-muted">
						A growing visual history of Austin.
					</p>
				</div>
				<PosterGrid />
			</section>
			<section className="px-5 py-6 sm:px-8 lg:px-12 lg:py-10">
				<div className="grid grid-cols-4 w-full">
					<div className="col-span-3 relative">
						<img className="aspect-square object-cover" src={headshot} />
						<span className="absolute bottom-0 text-6xl tracking-tight text-contrast-white max-w-xs">
							Meet Austin.
						</span>
					</div>
					<p className="col-span-4 tracking-tight py-4">
						I'm Austin Dingess, the designer and artist behind Collect &
						Contrast, an independent creative studio. The name initially came
						from my background as a collage artist. I collected materials and
						ideas and put them together. As a designer, I’ve always been drawn
						to contrasting elements like color, composition, and concepts. To
						me, this was a perfect summation of who I am as a creative. Someone
						exploring the in-betweens. The gray areas between two separate ideas
						that might be at odds with one another.
					</p>
					<div className="standalone-poster-grid col-span-4 grid grid-cols-2 gap-4">
						<PosterCard poster={posters[0]} index={0} />
						<PosterCard poster={posters[1]} index={1} />
					</div>
				</div>
			</section>
		</main>
	);
}

export default App;
