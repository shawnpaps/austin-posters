import {
	lazy,
	Suspense,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import Lenis from "lenis";
import "lenis/dist/lenis.css";
import { motion, useReducedMotion } from "motion/react";
import headshot from "./assets/images/Austin.webp";
import CollectionCard from "./components/CollectionCard";
import { PosterCard, PosterGrid } from "./components/PosterGrid";
import {
	getPosterPublicUrl,
	isSupabaseConfigured,
	supabase,
} from "./lib/supabase";

const AdminImport = lazy(() => import("./components/AdminImport"));

function InertialPosterScroller({ children }) {
	const wrapperRef = useRef(null);
	const contentRef = useRef(null);

	useEffect(() => {
		if (!wrapperRef.current || !contentRef.current) return undefined;
		const lenis = new Lenis({
			wrapper: wrapperRef.current,
			content: contentRef.current,
			autoRaf: true,
			lerp: 0.09,
			smoothWheel: true,
			wheelMultiplier: 0.9,
			overscroll: true,
			respectReducedMotion: true,
		});
		return () => lenis.destroy();
	}, []);

	return (
		<div
			ref={wrapperRef}
			data-poster-scroll
			tabIndex={0}
			aria-label="Scrollable poster collection"
			className="max-h-[60vh] overflow-y-auto focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-contrast-orange"
		>
			<div ref={contentRef}>{children}</div>
		</div>
	);
}

function usePosterArchive() {
	const [posters, setPosters] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const loadPosters = useCallback(async () => {
		if (!isSupabaseConfigured) {
			setError("Supabase environment variables are missing.");
			setLoading(false);
			return;
		}
		setLoading(true);
		setError("");
		const { data, error: queryError } = await supabase
			.from("posters")
			.select(
				"id, poster_number, image, optimized_image, date_created, collection",
			)
			.order("poster_number", { ascending: true });
		if (queryError) setError(queryError.message);
		else
			setPosters(
				(data || []).map((poster) => ({
					...poster,
					imageUrl: getPosterPublicUrl(poster.optimized_image || poster.image),
					originalImageUrl: getPosterPublicUrl(poster.image),
				})),
			);
		setLoading(false);
	}, []);
	useEffect(() => {
		loadPosters();
	}, [loadPosters]);
	return { posters, loading, error, reload: loadPosters };
}

function App() {
	const [isAdminPage, setIsAdminPage] = useState(
		window.location.hash === "#admin",
	);
	const shouldReduceMotion = useReducedMotion();
	const { posters, loading, error, reload } = usePosterArchive();
	const collections = Object.entries(
		posters.reduce((groups, poster) => {
			if (!poster.collection) return groups;
			return {
				...groups,
				[poster.collection]: [...(groups[poster.collection] || []), poster],
			};
		}, {}),
	).slice(0, 2);
	useEffect(() => {
		const handleHashChange = () =>
			setIsAdminPage(window.location.hash === "#admin");
		window.addEventListener("hashchange", handleHashChange);
		return () => window.removeEventListener("hashchange", handleHashChange);
	}, []);
	useEffect(() => {
		if (isAdminPage) return undefined;
		const lenis = new Lenis({
			autoRaf: true,
			anchors: true,
			lerp: 0.085,
			smoothWheel: true,
			wheelMultiplier: 0.9,
			respectReducedMotion: true,
			prevent: (node) => node.hasAttribute?.("data-poster-scroll"),
		});
		return () => lenis.destroy();
	}, [isAdminPage]);
	return (
		<main className="min-h-screen bg-contrast-paper text-contrast-ink">
			<motion.header
				initial={
					shouldReduceMotion ? false : { opacity: 0, y: -36, scale: 0.985 }
				}
				animate={{ opacity: 1, y: 0, scale: 1 }}
				transition={{
					default: shouldReduceMotion
						? { duration: 0.18 }
						: { type: "spring", stiffness: 185, damping: 22, mass: 0.9 },
					opacity: { duration: shouldReduceMotion ? 0.18 : 0.32 },
				}}
				className="flex flex-wrap items-end justify-between gap-5 border-b border-contrast-line px-5 py-8 sm:px-8 lg:px-12"
			>
				<div>
					<p className="text-xs font-semibold uppercase tracking-[0.22em] text-contrast-orange">
						The Gallery
					</p>
					<h1 className="mt-2 text-4xl font-black uppercase tracking-tighter sm:text-6xl">
						Collect & Contrast
					</h1>
				</div>
				<a
					href={isAdminPage ? "#" : "#admin"}
					className="border border-contrast-ink px-4 py-2 text-sm font-bold uppercase tracking-wide"
				>
					{isAdminPage ? "View archive" : "Admin"}
				</a>
			</motion.header>
			{isAdminPage ? (
				<section className="px-5 py-8 sm:px-8 lg:px-12">
					<Suspense fallback={<p>Loading admin tools…</p>}>
						<AdminImport />
					</Suspense>
				</section>
			) : (
				<>
					<section
						className="px-5 py-6 sm:px-8 lg:px-12 lg:py-10"
						aria-labelledby="collection-heading"
					>
						<div className="mb-6 flex flex-wrap items-end justify-between gap-4">
							<h2
								id="collection-heading"
								className="text-lg font-bold uppercase tracking-tight"
							>
								Poster collection
							</h2>
						</div>
						<InertialPosterScroller>
							<PosterGrid
								posters={posters}
								loading={loading}
								error={error}
								onRetry={reload}
							/>
						</InertialPosterScroller>
					</section>
					<section className="px-5 py-6 sm:px-8 lg:px-12 lg:py-10 mt-16">
						<div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
							<div className="relative lg:col-span-2">
								<img
									className="aspect-square w-full object-cover"
									src={headshot}
									alt="Austin Dingess"
								/>
								<span className="absolute bottom-0 max-w-xs p-3 text-5xl tracking-tight text-contrast-white sm:text-6xl">
									Meet Austin.
								</span>
							</div>
							<p className="tracking-tight col-span-4 lg:col-span-2 lg:text-2xl">
								I'm Austin Dingess, the designer and artist behind Collect &amp;
								Contrast, an independent creative studio. The name initially
								came from my background as a collage artist. I collected
								materials and ideas and put them together. As a designer, I’ve
								always been drawn to contrasting elements like color,
								composition, and concepts.
							</p>
							{posters.length >= 2 && (
								<div className="grid grid-cols-2 gap-4 lg:col-span-4">
									<PosterCard
										poster={posters[0]}
										index={0}
										posterSet={posters}
										standalone
									/>
									<PosterCard
										poster={posters[1]}
										index={1}
										posterSet={posters}
										standalone
									/>
								</div>
							)}
						</div>
					</section>
					{collections.length > 0 && (
						<section className="px-5 py-6 sm:px-8 lg:px-12 lg:py-10">
							<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
								{collections.map(([name, collectionPosters]) => (
									<CollectionCard
										key={name}
										imageSrc={collectionPosters[0].imageUrl}
										title={name}
										buttonLabel="See the Collection"
										posters={collectionPosters}
										posterCount={collectionPosters.length}
									/>
								))}
							</div>
						</section>
					)}
					<section className="px-5 py-6 sm:px-8 lg:px-12 lg:py-10">
						<div className="grid grid-cols-4 gap-4 sm:grid-cols-2">
							<h2 className="text-5xl tracking-tight col-span-4 sm:col-span-2 sm:text-7xl">
								Want to see more?
							</h2>
							<a
								className="relative block col-span-2 h-64 bg-contrast-orange text-contrast-white sm:h-96"
								href="https://www.collectandcontrast.com"
								target="_blank"
							>
								<span className="absolute bottom-0 p-3 text-4xl sm:text-5xl">
									See My Website
								</span>
							</a>
							<a className="relative col-span-2 block h-64 bg-contrast-orange text-contrast-white sm:h-96">
								<span className="absolute bottom-0 p-3 text-4xl sm:text-5xl">
									Let's Chat
								</span>
							</a>
						</div>
					</section>
				</>
			)}
		</main>
	);
}

export default App;
