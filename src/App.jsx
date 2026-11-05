import { PosterGrid, PosterCard } from "./components/PosterGrid";
import CollectionCard from "./components/CollectionCard";
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
				<div className="max-h-[80vh] overflow-scroll">
					<PosterGrid />
				</div>
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
					<div className="col-span-4 grid grid-cols-2 gap-4">
						<PosterCard poster={posters[0]} index={0} standalone />
						<PosterCard poster={posters[1]} index={1} standalone />
					</div>
				</div>
			</section>
			<section className="px-5 py-6 sm:px-8 lg:px-12 lg:py-10">
				<div className="grid grid-cols-4 w-full gap-4">
					<CollectionCard
						imageSrc={headshot}
						title="Things White People Say"
						buttonLabel="See the Collection"
						posters={posters.slice(0, 4)}
						posterCount={4}
					/>
					<CollectionCard
						imageSrc={headshot}
						title="Grunge"
						buttonLabel="See the Collection"
						posters={posters.slice(4, 10)}
						posterCount={6}
					/>
				</div>
			</section>
			<section className="px-5 py-6 sm:px-8 lg:px-12 lg:py-10">
				<div className="grid grid-cols-4 gap-4">
					<h2 className="text-7xl col-span-4">Want to see more?</h2>
					<a className="block relative h-96 col-span-2 bg-contrast-orange text-contrast-white">
						<span className="text-5xl absolute bottom-0">See My Website</span>
					</a>
					<a className="block relative h-96 col-span-2 bg-contrast-orange text-contrast-white">
						<span className="text-5xl absolute bottom-0">Let's Chat</span>
					</a>
				</div>
			</section>
		</main>
	);
}

export default App;
