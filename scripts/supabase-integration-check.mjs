import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";

const projectUrl = process.env.SUPABASE_URL || "https://ppltdobcwaunprldlerw.supabase.co";
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY;

if (!publishableKey || !secretKey) {
	throw new Error("Set SUPABASE_PUBLISHABLE_KEY and SUPABASE_SECRET_KEY to run the live integration test.");
}

const options = { auth: { autoRefreshToken: false, persistSession: false } };
const privileged = createClient(projectUrl, secretKey, options);
const anonymous = createClient(projectUrl, publishableKey, options);
const runId = randomUUID();
const testPassword = `Poster-test-${randomUUID()}!`;
const adminEmail = `poster-admin-${runId}@example.invalid`;
const nonAdminEmail = `poster-viewer-${runId}@example.invalid`;
const firstPath = `integration/${runId}-first.png`;
const retryPath = `integration/${runId}-retry.png`;
const firstOptimizedPath = `integration/web/${runId}-first.webp`;
const retryOptimizedPath = `integration/web/${runId}-retry.webp`;
const deniedPath = `integration/${runId}-denied.png`;
const firstNumber = 2_000_000_000;
const retryNumber = 1_999_999_999;
const png = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"));
const userIds = [];

async function createUser(email) {
	const { data, error } = await privileged.auth.admin.createUser({ email, password: testPassword, email_confirm: true });
	if (error) throw error;
	userIds.push(data.user.id);
	return data.user;
}

async function signIn(email) {
	const client = createClient(projectUrl, publishableKey, options);
	const { error } = await client.auth.signInWithPassword({ email, password: testPassword });
	if (error) throw error;
	return client;
}

try {
	const adminUser = await createUser(adminEmail);
	await createUser(nonAdminEmail);
	assert.equal((await privileged.from("admin_users").insert({ user_id: adminUser.id })).error, null);

	const admin = await signIn(adminEmail);
	const nonAdmin = await signIn(nonAdminEmail);
	const adminCheck = await admin.from("admin_users").select("user_id").eq("user_id", adminUser.id).maybeSingle();
	assert.equal(adminCheck.error, null);
	assert.equal(adminCheck.data.user_id, adminUser.id);
	const nonAdminCheck = await nonAdmin.from("admin_users").select("user_id").maybeSingle();
	assert.equal(nonAdminCheck.error, null);
	assert.equal(nonAdminCheck.data, null, "a signed-in non-admin cannot see an allowlist entry");

	assert.equal((await admin.storage.from("posters").upload(firstPath, png, { contentType: "image/png", upsert: false })).error, null);
	assert.equal((await admin.storage.from("posters").upload(firstOptimizedPath, png, { contentType: "image/webp", upsert: false })).error, null);
	const firstInsert = await admin.from("posters").insert({ poster_number: firstNumber, image: firstPath, optimized_image: firstOptimizedPath, date_created: null, collection: null }).select().single();
	assert.equal(firstInsert.error, null);
	assert.equal(firstInsert.data.date_created, null);
	assert.equal(firstInsert.data.collection, null);

	const duplicateInsert = await admin.from("posters").insert({ poster_number: firstNumber, image: retryPath });
	assert(duplicateInsert.error, "duplicate poster number should fail");
	const failedUpload = await admin.storage.from("posters").upload(firstPath, png, { contentType: "image/png", upsert: false });
	assert(failedUpload.error, "uploading an existing object without upsert should fail");

	assert.equal((await admin.storage.from("posters").upload(retryPath, png, { contentType: "image/png", upsert: false })).error, null);
	assert.equal((await admin.storage.from("posters").upload(retryOptimizedPath, png, { contentType: "image/webp", upsert: false })).error, null);
	const simulatedDatabaseFailure = await admin.from("posters").insert({ poster_number: firstNumber, image: retryPath });
	assert(simulatedDatabaseFailure.error, "database insert after upload should fail on duplicate number");
	const retryInsert = await admin.from("posters").insert({ poster_number: retryNumber, image: retryPath, optimized_image: retryOptimizedPath, date_created: null, collection: null }).select().single();
	assert.equal(retryInsert.error, null, "retrying only the database insert should succeed");
	const duplicateUpdate = await admin.from("posters").update({ poster_number: firstNumber }).eq("id", retryInsert.data.id);
	assert(duplicateUpdate.error, "changing a poster to an existing number should fail");
	const adminUpdate = await admin.from("posters").update({
		poster_number: retryNumber,
		date_created: "2026-11-05",
		collection: "Integration Test",
	}).eq("id", retryInsert.data.id).select().single();
	assert.equal(adminUpdate.error, null, "an allowlisted administrator should be able to edit poster metadata");
	assert.equal(adminUpdate.data.date_created, "2026-11-05");
	assert.equal(adminUpdate.data.collection, "Integration Test");

	const publicRead = await anonymous.from("posters").select("poster_number,image,optimized_image,date_created,collection").in("poster_number", [firstNumber, retryNumber]);
	assert.equal(publicRead.error, null);
	assert.equal(publicRead.data.length, 2);
	const publicOriginal = publicRead.data.find((row) => row.poster_number === firstNumber);
	const publicUpdated = publicRead.data.find((row) => row.poster_number === retryNumber);
	assert.equal(publicOriginal.date_created, null);
	assert.equal(publicOriginal.collection, null);
	assert.equal(publicOriginal.optimized_image, firstOptimizedPath);
	assert.equal(publicUpdated.date_created, "2026-11-05");
	assert.equal(publicUpdated.collection, "Integration Test");
	const publicImage = await fetch(privileged.storage.from("posters").getPublicUrl(firstPath).data.publicUrl);
	assert.equal(publicImage.status, 200);
	await admin.storage.from("posters").remove([firstOptimizedPath]);
	const protectedOptimizedImage = await fetch(privileged.storage.from("posters").getPublicUrl(firstOptimizedPath).data.publicUrl);
	assert.equal(protectedOptimizedImage.status, 200, "a referenced optimized image must not be deleted");

	assert((await anonymous.from("posters").insert({ poster_number: 1_999_999_998, image: deniedPath })).error);
	assert((await anonymous.from("posters").update({ collection: "denied" }).eq("poster_number", firstNumber)).error);
	assert((await anonymous.from("posters").delete().eq("poster_number", firstNumber)).error);
	assert((await anonymous.storage.from("posters").upload(deniedPath, png, { contentType: "image/png" })).error);
	assert((await nonAdmin.from("posters").insert({ poster_number: 1_999_999_997, image: deniedPath })).error);
	const deniedAuthenticatedUpdate = await nonAdmin.from("posters").update({ collection: "denied" }).eq("poster_number", firstNumber).select();
	assert.equal(deniedAuthenticatedUpdate.error, null);
	assert.equal(deniedAuthenticatedUpdate.data.length, 0, "a signed-in non-admin should update zero rows");
	const unchangedRecord = await admin.from("posters").select("collection").eq("poster_number", firstNumber).single();
	assert.equal(unchangedRecord.data.collection, null);
	assert((await nonAdmin.storage.from("posters").upload(deniedPath, png, { contentType: "image/png" })).error);

	const batchDelete = await admin.from("posters").delete().in("id", [firstInsert.data.id, retryInsert.data.id]).select("id,image,optimized_image");
	assert.equal(batchDelete.error, null);
	assert.equal(batchDelete.data.length, 2, "an allowlisted administrator should be able to batch delete poster rows");
	const batchStorageDelete = await admin.storage.from("posters").remove([firstPath, retryPath, firstOptimizedPath, retryOptimizedPath]);
	assert.equal(batchStorageDelete.error, null, "an allowlisted administrator should be able to remove unowned poster objects");
	const removedPublicRecords = await anonymous.from("posters").select("id").in("poster_number", [firstNumber, retryNumber]);
	assert.equal(removedPublicRecords.error, null);
	assert.equal(removedPublicRecords.data.length, 0);

	console.log("Live integration checks passed: public optimized-image read, admin dual-file import/update/batch delete, bucket cleanup, duplicate/failure handling, insert retry, NULL metadata, and write denials.");
} finally {
	await privileged.from("posters").delete().in("image", [firstPath, retryPath, deniedPath]);
	await privileged.storage.from("posters").remove([firstPath, retryPath, firstOptimizedPath, retryOptimizedPath, deniedPath]);
	for (const userId of userIds) await privileged.auth.admin.deleteUser(userId);
}
