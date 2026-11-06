import { useEffect, useMemo, useRef, useState } from "react";
import * as tus from "tus-js-client";

import AdminPosterTable from "./AdminPosterTable";

import {
	POSTER_BUCKET,
	SUPABASE_URL,
	isSupabaseConfigured,
	supabase,
} from "../lib/supabase";
import {
	RESUMABLE_UPLOAD_THRESHOLD,
	formatFileSize,
	markConflicts,
	prepareFiles,
	runWithConcurrency,
} from "../lib/posterImport";
import { optimizeImageBlob } from "../lib/imageOptimization";

const IMPORTABLE_STATUSES = new Set([
	"ready",
	"upload-failed",
	"optimization-failed",
	"insert-failed",
]);

function StatusBadge({ status }) {
	const labels = {
		ready: "Ready",
		invalid: "Needs correction",
		"conflict-selection": "Duplicate selection",
		"conflict-existing": "Already exists",
		uploading: "Uploading",
		uploaded: "Uploaded",
		optimizing: "Optimizing",
		"optimization-failed": "Optimization failed",
		inserting: "Saving record",
		imported: "Imported",
		"upload-failed": "Upload failed",
		"insert-failed": "Record failed",
		cleaned: "Upload cleaned up",
	};

	return (
		<span className="inline-flex rounded-full border border-contrast-ink px-2 py-1 text-[0.65rem] font-bold uppercase tracking-wide">
			{labels[status] || status}
		</span>
	);
}

function AdminSignIn({ onSignedIn }) {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");
	const [submitting, setSubmitting] = useState(false);

	async function handleSubmit(event) {
		event.preventDefault();
		setSubmitting(true);
		setError("");
		const { data, error: signInError } = await supabase.auth.signInWithPassword({
			email,
			password,
		});
		setSubmitting(false);
		if (signInError) {
			setError(signInError.message);
			return;
		}
		onSignedIn(data.session);
	}

	return (
		<form
			onSubmit={handleSubmit}
			className="mx-auto max-w-md border border-contrast-ink bg-contrast-white p-6 shadow-[0.5rem_0.5rem_0_var(--color-contrast-line)]"
		>
			<h2 className="text-3xl font-black uppercase tracking-tight">Admin sign in</h2>
			<p className="mt-2 text-sm text-contrast-muted">
				An authenticated account must also be explicitly listed as an administrator.
			</p>
			<label className="mt-6 block text-sm font-bold" htmlFor="admin-email">
				Email
			</label>
			<input
				id="admin-email"
				type="email"
				autoComplete="username"
				required
				value={email}
				onChange={(event) => setEmail(event.target.value)}
				className="mt-2 w-full border border-contrast-ink bg-contrast-paper px-3 py-2"
			/>
			<label className="mt-4 block text-sm font-bold" htmlFor="admin-password">
				Password
			</label>
			<input
				id="admin-password"
				type="password"
				autoComplete="current-password"
				required
				value={password}
				onChange={(event) => setPassword(event.target.value)}
				className="mt-2 w-full border border-contrast-ink bg-contrast-paper px-3 py-2"
			/>
			{error && <p className="mt-4 text-sm text-red-700">{error}</p>}
			<button
				type="submit"
				disabled={submitting}
				className="mt-6 bg-contrast-orange px-5 py-3 font-bold hover:bg-contrast-orange-hover hover:text-contrast-white disabled:opacity-50"
			>
				{submitting ? "Signing in…" : "Sign in"}
			</button>
		</form>
	);
}

function AdminImport() {
	const [adminView, setAdminView] = useState("import");
	const [session, setSession] = useState(null);
	const [authReady, setAuthReady] = useState(false);
	const [isAdmin, setIsAdmin] = useState(false);
	const [authError, setAuthError] = useState("");
	const [items, setItems] = useState([]);
	const [existingNumbers, setExistingNumbers] = useState(new Set());
	const [collection, setCollection] = useState("");
	const [dateCreated, setDateCreated] = useState("");
	const [ignoredCount, setIgnoredCount] = useState(0);
	const [isImporting, setIsImporting] = useState(false);
	const inputRef = useRef(null);

	useEffect(() => {
		if (!isSupabaseConfigured) {
			setAuthReady(true);
			return undefined;
		}

		supabase.auth.getSession().then(({ data }) => {
			setSession(data.session);
			setAuthReady(true);
		});
		const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
			setSession(nextSession);
		});
		return () => listener.subscription.unsubscribe();
	}, []);

	useEffect(() => {
		if (!session) {
			setIsAdmin(false);
			return;
		}

		let cancelled = false;
		supabase
			.from("admin_users")
			.select("user_id")
			.eq("user_id", session.user.id)
			.maybeSingle()
			.then(({ data, error }) => {
				if (cancelled) return;
				setIsAdmin(Boolean(data));
				setAuthError(error ? error.message : data ? "" : "This account is not an administrator.");
			});
		return () => {
			cancelled = true;
		};
	}, [session]);

	const summary = useMemo(
		() =>
			items.reduce(
				(result, item) => {
					if (item.status === "imported") result.imported += 1;
					else if (item.status.startsWith("conflict")) result.skipped += 1;
					else if (item.status.includes("failed")) result.failed += 1;
					return result;
				},
				{ imported: 0, skipped: 0, failed: 0 },
			),
		[items],
	);

	function updateItem(key, patch) {
		setItems((current) =>
			current.map((item) =>
				item.key === key
					? { ...item, ...(typeof patch === "function" ? patch(item) : patch) }
					: item,
			),
		);
	}

	async function fetchExistingNumbers() {
		const { data, error } = await supabase.from("posters").select("poster_number");
		if (error) throw error;
		const numbers = new Set((data || []).map((poster) => poster.poster_number));
		setExistingNumbers(numbers);
		return numbers;
	}

	async function handleFileSelection(event) {
		const selected = Array.from(event.target.files || []);
		const prepared = prepareFiles(selected);
		setIgnoredCount(selected.length - prepared.length);
		setAuthError("");
		try {
			const numbers = await fetchExistingNumbers();
			setItems(markConflicts(prepared, numbers));
		} catch (error) {
			setItems(prepared);
			setAuthError(`Could not check existing posters: ${error.message}`);
		}
	}

	function handleNumberChange(key, value) {
		const number = value === "" ? null : Number(value);
		setItems((current) =>
			markConflicts(
				current.map((item) =>
					item.key === key
						? { ...item, posterNumber: Number.isInteger(number) && number > 0 ? number : null }
						: item,
				),
				existingNumbers,
			),
		);
	}

	async function uploadStandard(item) {
		const { error } = await supabase.storage
			.from(POSTER_BUCKET)
			.upload(item.objectPath, item.file, {
				cacheControl: "31536000",
				contentType: item.file.type || undefined,
				upsert: false,
			});
		if (error) throw error;
		updateItem(item.key, { progress: 100 });
	}

	async function uploadResumable(item) {
		const { data } = await supabase.auth.getSession();
		if (!data.session) throw new Error("Your session expired. Sign in again.");
		const projectId = new URL(SUPABASE_URL).hostname.split(".")[0];

		await new Promise((resolve, reject) => {
			const upload = new tus.Upload(item.file, {
				endpoint: `https://${projectId}.storage.supabase.co/storage/v1/upload/resumable`,
				retryDelays: [0, 3000, 5000, 10000, 20000],
				headers: {
					authorization: `Bearer ${data.session.access_token}`,
					"x-upsert": "false",
				},
				uploadDataDuringCreation: true,
				removeFingerprintOnSuccess: true,
				metadata: {
					bucketName: POSTER_BUCKET,
					objectName: item.objectPath,
					contentType: item.file.type || "application/octet-stream",
					cacheControl: "31536000",
				},
				chunkSize: 6 * 1024 * 1024,
				onError: reject,
				onProgress: (uploaded, total) => {
					updateItem(item.key, { progress: Math.round((uploaded / total) * 100) });
				},
				onSuccess: resolve,
			});
			upload.findPreviousUploads().then((previousUploads) => {
				if (previousUploads.length) upload.resumeFromPreviousUpload(previousUploads[0]);
				upload.start();
			});
		});
	}

	async function insertPoster(item) {
		const { error } = await supabase.from("posters").insert({
			poster_number: item.posterNumber,
			image: item.objectPath,
			optimized_image: item.optimizedPath,
			collection: collection.trim() || null,
			date_created: dateCreated || null,
		});
		if (error) throw error;
	}

	async function uploadOptimized(item) {
		const { blob } = await optimizeImageBlob(item.file);
		const { error } = await supabase.storage
			.from(POSTER_BUCKET)
			.upload(item.optimizedPath, blob, {
				cacheControl: "31536000",
				contentType: "image/webp",
				upsert: false,
			});
		if (error) throw error;
	}

	async function processItem(item) {
		let uploaded = item.uploaded;
		let optimizedUploaded = item.optimizedUploaded;
		let stage = uploaded ? (optimizedUploaded ? "insert" : "optimize") : "upload";
		try {
			if (!uploaded) {
				stage = "upload";
				updateItem(item.key, { status: "uploading", error: null, progress: 0 });
				if (item.file.size > RESUMABLE_UPLOAD_THRESHOLD) await uploadResumable(item);
				else await uploadStandard(item);
				uploaded = true;
				item.uploaded = true;
				updateItem(item.key, { status: "uploaded", uploaded: true, progress: 100 });
			}

			if (!optimizedUploaded) {
				stage = "optimize";
				updateItem(item.key, { status: "optimizing", error: null });
				await uploadOptimized(item);
				optimizedUploaded = true;
				item.optimizedUploaded = true;
				updateItem(item.key, { optimizedUploaded: true });
			}

			stage = "insert";
			updateItem(item.key, { status: "inserting", error: null });
			await insertPoster(item);
			updateItem(item.key, { status: "imported", uploaded: true, progress: 100 });
		} catch (error) {
			updateItem(item.key, {
				status: stage === "upload"
					? "upload-failed"
					: stage === "optimize"
						? "optimization-failed"
						: "insert-failed",
				uploaded,
				optimizedUploaded,
				error: error.message,
			});
		}
	}

	async function importItems(retryOnly = false) {
		const candidates = items.filter((item) =>
			retryOnly
				? item.status === "upload-failed"
					|| item.status === "optimization-failed"
					|| item.status === "insert-failed"
				: IMPORTABLE_STATUSES.has(item.status),
		);
		if (!candidates.length) return;
		setIsImporting(true);
		await runWithConcurrency(candidates, processItem, 3);
		setIsImporting(false);
		await fetchExistingNumbers().catch(() => {});
	}

	async function cleanUploadedObject(item) {
		updateItem(item.key, { error: null });
		const paths = [item.objectPath, item.optimizedPath].filter(Boolean);
		const { data, error: lookupError } = await supabase
			.from("posters")
			.select("id, image, optimized_image");
		if (lookupError) {
			updateItem(item.key, { error: lookupError.message });
			return;
		}
		const ownedPaths = new Set(
			(data || []).flatMap((poster) => [poster.image, poster.optimized_image].filter(Boolean)),
		);
		if (paths.some((path) => ownedPaths.has(path))) {
			updateItem(item.key, { error: "Cleanup refused: a poster record owns this object." });
			return;
		}
		const { error } = await supabase.storage.from(POSTER_BUCKET).remove(paths);
		updateItem(
			item.key,
			error
				? { error: error.message }
				: {
					status: "ready",
					uploaded: false,
					optimizedUploaded: false,
					progress: 0,
					error: null,
				},
		);
	}

	if (!isSupabaseConfigured) {
		return (
			<p className="border border-contrast-orange bg-contrast-white p-5">
				Supabase is not configured. Add the Vite environment variables documented in the README.
			</p>
		);
	}

	if (!authReady) return <p>Checking your session…</p>;
	if (!session) return <AdminSignIn onSignedIn={setSession} />;
	if (!isAdmin) {
		return (
			<div className="mx-auto max-w-lg border border-contrast-ink bg-contrast-white p-6">
				<h2 className="text-2xl font-black uppercase">Access denied</h2>
				<p className="mt-3 text-sm text-red-700">{authError}</p>
				<button
					type="button"
					onClick={() => supabase.auth.signOut()}
					className="mt-5 border border-contrast-ink px-4 py-2 font-bold"
				>
					Sign out
				</button>
			</div>
		);
	}

	return (
		<div>
			<div className="flex flex-wrap items-end justify-between gap-4 border-b border-contrast-line pb-5">
				<div>
					<p className="text-xs font-bold uppercase tracking-[0.2em] text-contrast-orange">Administrator</p>
					<h2 className="mt-1 text-4xl font-black uppercase tracking-tight">Poster admin</h2>
				</div>
				<button type="button" onClick={() => supabase.auth.signOut()} className="border border-contrast-ink px-4 py-2 font-bold">
					Sign out
				</button>
			</div>
			<nav className="mt-5 flex gap-2" aria-label="Poster administration">
				<button type="button" onClick={() => setAdminView("import")} aria-pressed={adminView === "import"} className={`border border-contrast-ink px-4 py-2 font-bold ${adminView === "import" ? "bg-contrast-ink text-contrast-white" : "bg-contrast-white"}`}>Import posters</button>
				<button type="button" onClick={() => setAdminView("manage")} aria-pressed={adminView === "manage"} className={`border border-contrast-ink px-4 py-2 font-bold ${adminView === "manage" ? "bg-contrast-ink text-contrast-white" : "bg-contrast-white"}`}>Manage posters</button>
			</nav>

			{adminView === "manage" ? <AdminPosterTable /> : <>

			<div className="mt-6 grid gap-5 lg:grid-cols-2">
				<div className="border border-contrast-ink bg-contrast-white p-5">
					<h3 className="text-lg font-black uppercase">1. Select images</h3>
					<p className="mt-2 text-sm text-contrast-muted">
						Nothing uploads until you review the preview and choose Start import.
					</p>
					<div className="mt-4 flex flex-wrap gap-3">
						<label className="cursor-pointer bg-contrast-orange px-4 py-3 font-bold hover:bg-contrast-orange-hover hover:text-contrast-white">
							Choose folder
							<input ref={inputRef} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" multiple webkitdirectory="" directory="" onChange={handleFileSelection} />
						</label>
						<label className="cursor-pointer border border-contrast-ink px-4 py-3 font-bold">
							Choose files
							<input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" multiple onChange={handleFileSelection} />
						</label>
					</div>
					{ignoredCount > 0 && <p className="mt-3 text-sm text-contrast-muted">Ignored {ignoredCount} hidden or unsupported file{ignoredCount === 1 ? "" : "s"}.</p>}
				</div>

				<div className="border border-contrast-ink bg-contrast-white p-5">
					<h3 className="text-lg font-black uppercase">2. Batch details</h3>
					<label className="mt-4 block text-sm font-bold" htmlFor="collection">Collection (optional)</label>
					<input id="collection" value={collection} onChange={(event) => setCollection(event.target.value)} className="mt-2 w-full border border-contrast-ink bg-contrast-paper px-3 py-2" />
					<label className="mt-4 block text-sm font-bold" htmlFor="date-created">Creation date (optional)</label>
					<input id="date-created" type="date" value={dateCreated} onChange={(event) => setDateCreated(event.target.value)} className="mt-2 w-full border border-contrast-ink bg-contrast-paper px-3 py-2" />
					<p className="mt-3 text-xs text-contrast-muted">Blank values are stored as NULL. File timestamps and folder names are never inferred.</p>
				</div>
			</div>

			{authError && <p className="mt-5 border border-red-700 bg-red-50 p-3 text-sm text-red-800">{authError}</p>}

			{items.length > 0 && (
				<>
					<div className="mt-7 overflow-x-auto border border-contrast-ink bg-contrast-white">
						<table className="w-full min-w-[760px] border-collapse text-left text-sm">
							<thead className="bg-contrast-ink text-contrast-white">
						<tr><th className="p-3">Filename</th><th className="p-3">Poster #</th><th className="p-3">Size</th><th className="p-3">Storage paths</th><th className="p-3">Status</th><th className="p-3">Action</th></tr>
							</thead>
							<tbody>
								{items.map((item) => (
									<tr key={item.key} className="border-t border-contrast-line align-top">
										<td className="p-3 font-semibold">{item.filename}</td>
										<td className="p-3"><input aria-label={`Poster number for ${item.filename}`} type="number" min="1" value={item.posterNumber || ""} disabled={item.status === "imported" || isImporting} onChange={(event) => handleNumberChange(item.key, event.target.value)} className="w-24 border border-contrast-ink px-2 py-1" /></td>
										<td className="p-3">{formatFileSize(item.file.size)}</td>
										<td className="p-3 font-mono text-xs"><span className="block">Original: {item.objectPath || "—"}</span><span className="mt-1 block text-contrast-muted">Web: {item.optimizedPath || "—"}</span></td>
										<td className="p-3"><StatusBadge status={item.status} />{["uploading", "uploaded", "optimizing", "inserting"].includes(item.status) && <progress className="mt-2 block w-28" max="100" value={item.progress} />}{item.error && <p className="mt-2 max-w-xs text-xs text-red-700">{item.error}</p>}</td>
										<td className="p-3">{["optimization-failed", "insert-failed"].includes(item.status) && <button type="button" onClick={() => cleanUploadedObject(item)} className="border border-contrast-ink px-2 py-1 text-xs font-bold">Clean up uploads</button>}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>

					<div className="mt-5 flex flex-wrap items-center gap-3">
						<button type="button" disabled={isImporting || !items.some((item) => item.status === "ready")} onClick={() => importItems(false)} className="bg-contrast-orange px-5 py-3 font-bold hover:bg-contrast-orange-hover hover:text-contrast-white disabled:opacity-40">
							{isImporting ? "Importing…" : "Start import"}
						</button>
						<button type="button" disabled={isImporting || !items.some((item) => item.status.includes("failed"))} onClick={() => importItems(true)} className="border border-contrast-ink px-5 py-3 font-bold disabled:opacity-40">Retry failed</button>
						<p className="text-sm font-semibold" aria-live="polite">Imported {summary.imported} · Skipped {summary.skipped} · Failed {summary.failed}</p>
					</div>
				</>
			)}
			</>}
		</div>
	);
}

export default AdminImport;
