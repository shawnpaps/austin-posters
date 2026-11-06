import { useEffect, useMemo, useState } from "react";

import { getPosterPublicUrl, supabase } from "../lib/supabase";
import {
	buildOptimizedImagePath,
	optimizeImageBlob,
} from "../lib/imageOptimization";

const PAGE_SIZE = 25;

function makeDraft(poster) {
	return {
		poster_number: String(poster.poster_number),
		date_created: poster.date_created || "",
		collection: poster.collection || "",
	};
}

function AdminPosterTable() {
	const [posters, setPosters] = useState([]);
	const [drafts, setDrafts] = useState({});
	const [rowState, setRowState] = useState({});
	const [loading, setLoading] = useState(true);
	const [loadError, setLoadError] = useState("");
	const [search, setSearch] = useState("");
	const [page, setPage] = useState(1);
	const [selectedIds, setSelectedIds] = useState(new Set());
	const [deleteTargets, setDeleteTargets] = useState([]);
	const [deleting, setDeleting] = useState(false);
	const [deleteStatus, setDeleteStatus] = useState(null);
	const [pendingCleanupPaths, setPendingCleanupPaths] = useState([]);
	const [optimizing, setOptimizing] = useState(false);
	const [optimizationStatus, setOptimizationStatus] = useState(null);

	async function loadPosters() {
		setLoading(true);
		setLoadError("");
		const { data, error } = await supabase
			.from("posters")
			.select("id, poster_number, image, optimized_image, date_created, collection")
			.order("poster_number", { ascending: true });

		if (error) {
			setLoadError(error.message);
		} else {
			setPosters(data || []);
			setDrafts(
				Object.fromEntries((data || []).map((poster) => [poster.id, makeDraft(poster)])),
			);
			setRowState({});
			setSelectedIds(new Set());
		}
		setLoading(false);
	}

	useEffect(() => {
		loadPosters();
	}, []);

	useEffect(() => {
		setPage(1);
	}, [search]);

	const filteredPosters = useMemo(() => {
		const query = search.trim().toLowerCase();
		if (!query) return posters;
		return posters.filter((poster) =>
			String(poster.poster_number).includes(query)
			|| (poster.collection || "").toLowerCase().includes(query)
			|| poster.image.toLowerCase().includes(query)
			|| (poster.optimized_image || "").toLowerCase().includes(query),
		);
	}, [posters, search]);

	const pageCount = Math.max(1, Math.ceil(filteredPosters.length / PAGE_SIZE));
	const safePage = Math.min(page, pageCount);
	const visiblePosters = filteredPosters.slice(
		(safePage - 1) * PAGE_SIZE,
		safePage * PAGE_SIZE,
	);
	const visibleIds = visiblePosters.map((poster) => poster.id);
	const allVisibleSelected = visibleIds.length > 0
		&& visibleIds.every((id) => selectedIds.has(id));
	const selectedPosters = posters.filter((poster) => selectedIds.has(poster.id));
	const selectedMissingOptimized = selectedPosters.filter((poster) => !poster.optimized_image);
	const missingOptimized = posters.filter((poster) => !poster.optimized_image);

	function togglePoster(id) {
		setSelectedIds((current) => {
			const next = new Set(current);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	}

	function toggleVisiblePosters() {
		setSelectedIds((current) => {
			const next = new Set(current);
			if (allVisibleSelected) visibleIds.forEach((id) => next.delete(id));
			else visibleIds.forEach((id) => next.add(id));
			return next;
		});
	}

	function updateDraft(id, field, value) {
		setDrafts((current) => ({
			...current,
			[id]: { ...current[id], [field]: value },
		}));
		setRowState((current) => ({ ...current, [id]: null }));
	}

	function isDirty(poster) {
		const draft = drafts[poster.id];
		if (!draft) return false;
		return Number(draft.poster_number) !== poster.poster_number
			|| draft.date_created !== (poster.date_created || "")
			|| draft.collection.trim() !== (poster.collection || "");
	}

	function resetPoster(poster) {
		setDrafts((current) => ({ ...current, [poster.id]: makeDraft(poster) }));
		setRowState((current) => ({ ...current, [poster.id]: null }));
	}

	async function savePoster(poster) {
		const draft = drafts[poster.id];
		const posterNumber = Number(draft.poster_number);
		if (!Number.isInteger(posterNumber) || posterNumber < 1) {
			setRowState((current) => ({
				...current,
				[poster.id]: { type: "error", message: "Poster number must be a positive integer." },
			}));
			return;
		}

		setRowState((current) => ({
			...current,
			[poster.id]: { type: "saving", message: "Saving…" },
		}));
		const { data, error } = await supabase
			.from("posters")
			.update({
				poster_number: posterNumber,
				date_created: draft.date_created || null,
				collection: draft.collection.trim() || null,
			})
			.eq("id", poster.id)
			.select("id, poster_number, image, optimized_image, date_created, collection")
			.single();

		if (error) {
			const message = error.code === "23505"
				? `Poster ${posterNumber} already exists.`
				: error.message;
			setRowState((current) => ({
				...current,
				[poster.id]: { type: "error", message },
			}));
			return;
		}

		setPosters((current) =>
			current
				.map((item) => (item.id === poster.id ? data : item))
				.sort((a, b) => a.poster_number - b.poster_number),
		);
		setDrafts((current) => ({ ...current, [poster.id]: makeDraft(data) }));
		setRowState((current) => ({
			...current,
			[poster.id]: { type: "success", message: "Saved" },
		}));
	}

	async function cleanupStorage(paths) {
		const uniquePaths = [...new Set(paths)];
		if (!uniquePaths.length) return [];
		const { data: ownedRows, error: ownershipError } = await supabase
			.from("posters")
			.select("image, optimized_image");
		if (ownershipError) throw ownershipError;
		const ownedPaths = new Set(
			(ownedRows || []).flatMap((row) => [row.image, row.optimized_image].filter(Boolean)),
		);
		const unownedPaths = uniquePaths.filter((path) => !ownedPaths.has(path));
		if (!unownedPaths.length) return [];
		const { error } = await supabase.storage.from("posters").remove(unownedPaths);
		if (error) throw error;
		return unownedPaths;
	}

	async function removePosters() {
		if (!deleteTargets.length) return;
		setDeleting(true);
		setDeleteStatus(null);
		const ids = deleteTargets.map((poster) => poster.id);
		const { data: deletedRows, error } = await supabase
			.from("posters")
			.delete()
			.in("id", ids)
			.select("id, poster_number, image, optimized_image");

		if (error || !deletedRows?.length) {
			setDeleteStatus({
				type: "error",
				message: error?.message || "No poster records were removed.",
			});
			setDeleting(false);
			return;
		}

		const deletedIds = new Set(deletedRows.map((poster) => poster.id));
		setPosters((current) => current.filter((poster) => !deletedIds.has(poster.id)));
		setDrafts((current) => Object.fromEntries(
			Object.entries(current).filter(([id]) => !deletedIds.has(id)),
		));
		setSelectedIds((current) => new Set(
			[...current].filter((id) => !deletedIds.has(id)),
		));
		setDeleteTargets([]);

		const paths = deletedRows.flatMap((poster) =>
			[poster.image, poster.optimized_image].filter(Boolean),
		);
		try {
			const removedPaths = await cleanupStorage(paths);
			setPendingCleanupPaths([]);
			setDeleteStatus({
				type: "success",
				message: `Removed ${deletedRows.length} poster record${deletedRows.length === 1 ? "" : "s"} and ${removedPaths.length} stored image${removedPaths.length === 1 ? "" : "s"}.`,
			});
		} catch (storageError) {
			setPendingCleanupPaths(paths);
			setDeleteStatus({
				type: "warning",
				message: `${deletedRows.length} database record${deletedRows.length === 1 ? " was" : "s were"} removed, but Storage cleanup failed: ${storageError.message}`,
			});
		}
		setDeleting(false);
	}

	async function retryStorageCleanup() {
		setDeleting(true);
		try {
			const removedPaths = await cleanupStorage(pendingCleanupPaths);
			setPendingCleanupPaths([]);
			setDeleteStatus({
				type: "success",
				message: `Storage cleanup completed for ${removedPaths.length} image${removedPaths.length === 1 ? "" : "s"}.`,
			});
		} catch (error) {
			setDeleteStatus({ type: "warning", message: `Storage cleanup still failed: ${error.message}` });
		}
		setDeleting(false);
	}

	async function storageObjectExists(path) {
		const separatorIndex = path.lastIndexOf("/");
		const folder = separatorIndex === -1 ? "" : path.slice(0, separatorIndex);
		const filename = separatorIndex === -1 ? path : path.slice(separatorIndex + 1);
		const { data, error } = await supabase.storage
			.from("posters")
			.list(folder, { limit: 100, search: filename });
		if (error) throw error;
		return (data || []).some((object) => object.name === filename);
	}

	async function optimizePoster(poster) {
		const optimizedPath = buildOptimizedImagePath(poster.image);
		const conflictingPoster = posters.find((candidate) =>
			candidate.id !== poster.id && candidate.optimized_image === optimizedPath,
		);
		if (conflictingPoster) {
			throw new Error(`Web path is already used by poster ${conflictingPoster.poster_number}.`);
		}

		if (!(await storageObjectExists(optimizedPath))) {
			const response = await fetch(getPosterPublicUrl(poster.image));
			if (!response.ok) throw new Error(`Original download failed (${response.status}).`);
			const originalBlob = await response.blob();
			const { blob } = await optimizeImageBlob(originalBlob);
			const { error: uploadError } = await supabase.storage
				.from("posters")
				.upload(optimizedPath, blob, {
					cacheControl: "31536000",
					contentType: "image/webp",
					upsert: false,
				});
			if (uploadError) throw uploadError;
		}

		const { data, error } = await supabase
			.from("posters")
			.update({ optimized_image: optimizedPath })
			.eq("id", poster.id)
			.select("id, poster_number, image, optimized_image, date_created, collection")
			.single();
		if (error) throw error;
		setPosters((current) =>
			current.map((item) => item.id === poster.id ? data : item),
		);
	}

	async function optimizePosters(targets) {
		const candidates = targets.filter((poster) => !poster.optimized_image);
		if (!candidates.length) return;
		setOptimizing(true);
		setOptimizationStatus({ type: "progress", completed: 0, total: candidates.length, failed: 0 });
		let completed = 0;
		let failed = 0;
		for (const poster of candidates) {
			setRowState((current) => ({
				...current,
				[poster.id]: { type: "saving", message: "Optimizing…" },
			}));
			try {
				await optimizePoster(poster);
				setRowState((current) => ({
					...current,
					[poster.id]: { type: "success", message: "Web image ready" },
				}));
			} catch (error) {
				failed += 1;
				setRowState((current) => ({
					...current,
					[poster.id]: { type: "error", message: error.message },
				}));
			}
			completed += 1;
			setOptimizationStatus({ type: "progress", completed, total: candidates.length, failed });
		}
		setOptimizationStatus({
			type: failed ? "warning" : "success",
			completed,
			total: candidates.length,
			failed,
		});
		setOptimizing(false);
	}

	if (loading) return <p className="mt-8 text-center">Loading poster records…</p>;
	if (loadError) return (
		<div className="mt-8 border border-red-700 bg-red-50 p-5 text-red-900">
			<p>Could not load posters: {loadError}</p>
			<button type="button" onClick={loadPosters} className="mt-3 border border-current px-3 py-2 font-bold">Try again</button>
		</div>
	);

	return (
		<section className="mt-6" aria-labelledby="manage-posters-heading">
			<div className="flex flex-wrap items-end justify-between gap-4">
				<div>
					<h3 id="manage-posters-heading" className="text-2xl font-black uppercase tracking-tight">Poster records</h3>
					<p className="mt-1 text-sm text-contrast-muted">Edit metadata and create web-sized copies without replacing the originals.</p>
				</div>
				<div className="flex flex-wrap gap-2">
					{selectedMissingOptimized.length > 0 && <button type="button" disabled={optimizing} onClick={() => optimizePosters(selectedMissingOptimized)} className="bg-contrast-orange px-4 py-2 text-sm font-bold disabled:opacity-50">Optimize selected ({selectedMissingOptimized.length})</button>}
					{missingOptimized.length > 0 && <button type="button" disabled={optimizing} onClick={() => optimizePosters(missingOptimized)} className="border border-contrast-ink px-4 py-2 text-sm font-bold disabled:opacity-50">{optimizing ? "Optimizing…" : `Optimize all missing (${missingOptimized.length})`}</button>}
					{selectedPosters.length > 0 && <button type="button" disabled={optimizing} onClick={() => setDeleteTargets(selectedPosters)} className="border border-red-700 bg-red-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Remove selected ({selectedPosters.length})</button>}
					<button type="button" disabled={optimizing} onClick={loadPosters} className="border border-contrast-ink px-4 py-2 text-sm font-bold disabled:opacity-50">Refresh</button>
				</div>
			</div>

			{deleteStatus && <div className={`mt-5 border p-4 text-sm ${deleteStatus.type === "success" ? "border-green-700 bg-green-50 text-green-800" : deleteStatus.type === "warning" ? "border-amber-700 bg-amber-50 text-amber-900" : "border-red-700 bg-red-50 text-red-800"}`} role="status"><p>{deleteStatus.message}</p>{pendingCleanupPaths.length > 0 && <button type="button" onClick={retryStorageCleanup} disabled={deleting} className="mt-3 border border-current px-3 py-2 font-bold disabled:opacity-50">{deleting ? "Retrying…" : "Retry bucket cleanup"}</button>}</div>}
			{optimizationStatus && <div className={`mt-5 border p-4 text-sm ${optimizationStatus.type === "success" ? "border-green-700 bg-green-50 text-green-800" : optimizationStatus.type === "warning" ? "border-amber-700 bg-amber-50 text-amber-900" : "border-contrast-ink bg-contrast-white"}`} role="status" aria-live="polite"><p>{optimizationStatus.type === "success" ? `Created ${optimizationStatus.completed} web-sized image${optimizationStatus.completed === 1 ? "" : "s"}.` : optimizationStatus.type === "warning" ? `Finished ${optimizationStatus.completed} poster${optimizationStatus.completed === 1 ? "" : "s"}; ${optimizationStatus.failed} failed. Failed rows can be selected and retried.` : `Optimizing ${optimizationStatus.completed} of ${optimizationStatus.total}…`}</p>{optimizationStatus.type === "progress" && <progress className="mt-2 block w-full" max={optimizationStatus.total} value={optimizationStatus.completed} />}</div>}

			<label className="mt-5 block max-w-md text-sm font-bold" htmlFor="poster-search">Search posters</label>
			<input
				id="poster-search"
				type="search"
				value={search}
				onChange={(event) => setSearch(event.target.value)}
				placeholder="Number, collection, or object path"
				className="mt-2 w-full max-w-md border border-contrast-ink bg-contrast-white px-3 py-2"
			/>

			<div className="mt-5 overflow-x-auto border border-contrast-ink bg-contrast-white">
				<table className="w-full min-w-[1100px] border-collapse text-left text-sm">
					<thead className="bg-contrast-ink text-contrast-white">
						<tr>
							<th className="p-3"><input type="checkbox" checked={allVisibleSelected} onChange={toggleVisiblePosters} aria-label="Select all posters on this page" /></th>
							<th className="p-3">Poster</th>
							<th className="p-3">Number</th>
							<th className="p-3">Creation date</th>
							<th className="p-3">Collection</th>
							<th className="p-3">Storage path</th>
							<th className="p-3">Actions</th>
						</tr>
					</thead>
					<tbody>
						{visiblePosters.map((poster) => {
							const draft = drafts[poster.id] || makeDraft(poster);
							const status = rowState[poster.id];
							const dirty = isDirty(poster);
							return (
								<tr key={poster.id} className="border-t border-contrast-line align-middle">
									<td className="p-3"><input type="checkbox" checked={selectedIds.has(poster.id)} onChange={() => togglePoster(poster.id)} aria-label={`Select poster ${poster.poster_number}`} /></td>
									<td className="p-3"><img src={getPosterPublicUrl(poster.optimized_image || poster.image)} alt={`Poster ${poster.poster_number}`} loading="lazy" className="h-20 w-16 border border-contrast-line object-cover" /></td>
									<td className="p-3"><input type="number" min="1" value={draft.poster_number} onChange={(event) => updateDraft(poster.id, "poster_number", event.target.value)} aria-label={`Number for poster ${poster.poster_number}`} className="w-24 border border-contrast-ink bg-contrast-paper px-2 py-2" /></td>
									<td className="p-3"><input type="date" value={draft.date_created} onChange={(event) => updateDraft(poster.id, "date_created", event.target.value)} aria-label={`Creation date for poster ${poster.poster_number}`} className="border border-contrast-ink bg-contrast-paper px-2 py-2" /></td>
									<td className="p-3"><input type="text" value={draft.collection} onChange={(event) => updateDraft(poster.id, "collection", event.target.value)} aria-label={`Collection for poster ${poster.poster_number}`} className="w-52 border border-contrast-ink bg-contrast-paper px-2 py-2" /></td>
									<td className="max-w-64 break-all p-3 font-mono text-xs text-contrast-muted"><span className="block">Original: {poster.image}</span><span className="mt-1 block">Web: {poster.optimized_image || "Not generated"}</span></td>
									<td className="p-3">
										<div className="flex flex-wrap gap-2"><button type="button" disabled={!dirty || status?.type === "saving" || optimizing} onClick={() => savePoster(poster)} className="bg-contrast-orange px-3 py-2 font-bold disabled:opacity-35">{status?.type === "saving" ? status.message : "Save"}</button><button type="button" disabled={!dirty || status?.type === "saving" || optimizing} onClick={() => resetPoster(poster)} className="border border-contrast-ink px-3 py-2 font-bold disabled:opacity-35">Reset</button>{!poster.optimized_image && <button type="button" disabled={optimizing} onClick={() => optimizePosters([poster])} className="border border-contrast-ink px-3 py-2 font-bold disabled:opacity-35">Optimize</button>}<button type="button" disabled={optimizing} onClick={() => setDeleteTargets([poster])} className="border border-red-700 px-3 py-2 font-bold text-red-700 disabled:opacity-35">Remove</button></div>
										{status && status.type !== "saving" && <p className={`mt-2 max-w-48 text-xs ${status.type === "error" ? "text-red-700" : "text-green-700"}`} aria-live="polite">{status.message}</p>}
									</td>
								</tr>
							);
						})}
					</tbody>
				</table>
				{!visiblePosters.length && <p className="p-8 text-center text-contrast-muted">No poster records match that search.</p>}
			</div>

			<div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
				<p>Showing {visiblePosters.length} of {filteredPosters.length} matching records · {posters.length} total</p>
				<div className="flex items-center gap-3">
					<button type="button" disabled={safePage === 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="border border-contrast-ink px-3 py-2 font-bold disabled:opacity-35">Previous</button>
					<span>Page {safePage} of {pageCount}</span>
					<button type="button" disabled={safePage === pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))} className="border border-contrast-ink px-3 py-2 font-bold disabled:opacity-35">Next</button>
				</div>
			</div>

			{deleteTargets.length > 0 && <div className="fixed inset-0 z-[200] grid place-items-center bg-contrast-ink/70 p-4"><section role="dialog" aria-modal="true" aria-labelledby="remove-posters-title" className="w-full max-w-lg border border-contrast-ink bg-contrast-paper p-6 shadow-2xl"><h4 id="remove-posters-title" className="text-3xl font-black uppercase tracking-tight">Remove {deleteTargets.length === 1 ? `poster ${deleteTargets[0].poster_number}` : `${deleteTargets.length} posters`}?</h4><p className="mt-3 text-sm">This permanently removes the selected database record{deleteTargets.length === 1 ? "" : "s"}, original image{deleteTargets.length === 1 ? "" : "s"}, and any generated web image{deleteTargets.length === 1 ? "" : "s"} from the <span className="font-mono">posters</span> bucket. This cannot be undone.</p><ul className="mt-4 max-h-40 overflow-y-auto border-y border-contrast-line py-3 text-sm">{deleteTargets.slice(0, 8).map((poster) => <li key={poster.id}>Poster {poster.poster_number} · <span className="font-mono text-xs">{poster.image}{poster.optimized_image ? ` + ${poster.optimized_image}` : ""}</span></li>)}{deleteTargets.length > 8 && <li className="mt-1 text-contrast-muted">…and {deleteTargets.length - 8} more</li>}</ul><div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setDeleteTargets([])} disabled={deleting} className="border border-contrast-ink px-4 py-2 font-bold disabled:opacity-50">Cancel</button><button type="button" onClick={removePosters} disabled={deleting} className="bg-red-700 px-4 py-2 font-bold text-white disabled:opacity-50">{deleting ? "Removing…" : "Remove permanently"}</button></div></section></div>}
		</section>
	);
}

export default AdminPosterTable;
