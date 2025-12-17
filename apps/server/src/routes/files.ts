import { Router, type Router as RouterType } from "express";
import { authMiddleware, type AuthRequest } from "../middleware/auth";
import { upload } from "../config/multer";
import cloudinary from "../config/cloudinary";
import { db } from "@nua-assignment/db";
import { file, share, activityLog } from "@nua-assignment/db";
import { nanoid } from "nanoid";
import fs from "fs";
import { eq, and, or, desc, sql, isNull } from "drizzle-orm";

const router: RouterType = Router();

const logActivity = async (
	fileId: string,
	userId: string,
	activityType: (typeof activityLog.$inferInsert)["activityType"],
	metadata?: string,
) => {
	await db.insert(activityLog).values({
		id: nanoid(),
		fileId,
		userId,
		activityType,
		metadata,
	});
};

router.post(
	"/upload",
	authMiddleware,
	upload.single("file"),
	async (req: AuthRequest, res) => {
		try {
			if (!req.file) {
				return res.status(400).json({ error: "No file uploaded" });
			}

			if (!req.user) {
				return res.status(401).json({ error: "Unauthorized" });
			}

			const result = await cloudinary.uploader.upload(req.file.path, {
				resource_type: "auto",
				folder: "user-uploads",
				use_filename: true,
				unique_filename: true,
			});

			let fileId: string;
			let newFile: typeof file.$inferSelect;

			try {
				fileId = nanoid();
				const rows = await db
					.insert(file)
					.values({
						id: fileId,
						filename: req.file.originalname,
						cloudinaryId: result.public_id,
						fileUrl: result.secure_url,
						size: req.file.size,
						type: req.file.mimetype,
						ownerId: req.user.id,
						resourceType: result.resource_type,
					})
					.returning();
				newFile = rows[0]!;

				await logActivity(fileId, req.user.id, "upload");

				// Only cleanup local file after successful DB operations
				fs.unlinkSync(req.file.path);
			} catch (dbError) {
				// Clean up Cloudinary upload if DB operations fail
				try {
					await cloudinary.uploader.destroy(result.public_id, {
						resource_type: result.resource_type,
					});
				} catch (cleanupError) {
					console.error("Failed to cleanup Cloudinary file:", cleanupError);
				}
				throw dbError;
			}

			res.status(201).json({
				success: true,
				file: {
					id: newFile.id,
					filename: newFile.filename,
					size: newFile.size,
					type: newFile.type,
					uploadDate: newFile.createdAt,
					url: newFile.fileUrl,
				},
			});
		} catch (error) {
			console.error("Upload error:", error);
			if (req.file && fs.existsSync(req.file.path)) {
				fs.unlinkSync(req.file.path);
			}
			res
				.status(500)
				.json({ error: error instanceof Error ? error.message : "Upload failed" });
		}
	},
);

router.post(
	"/upload-bulk",
	authMiddleware,
	upload.array("files", 10),
	async (req: AuthRequest, res) => {
		try {
			if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
				return res.status(400).json({ error: "No files uploaded" });
			}

			if (!req.user) {
				return res.status(401).json({ error: "Unauthorized" });
			}

			const uploadPromises = req.files.map(async (uploadedFile) => {
				try {
					const result = await cloudinary.uploader.upload(uploadedFile.path, {
						resource_type: "auto",
						folder: "user-uploads",
						use_filename: true,
						unique_filename: true,
					});

					try {
						const fileId = nanoid();
						const rows = await db
							.insert(file)
							.values({
								id: fileId,
								filename: uploadedFile.originalname,
								cloudinaryId: result.public_id,
								fileUrl: result.secure_url,
								size: uploadedFile.size,
								type: uploadedFile.mimetype,
								ownerId: req.user!.id,
								resourceType: result.resource_type,
							})
							.returning();
						const newFile = rows[0]!;

						await logActivity(fileId, req.user!.id, "upload");

						// Only cleanup local file after successful DB operations
						fs.unlinkSync(uploadedFile.path);

						return {
							status: "success" as const,
							file: {
								id: newFile.id,
								filename: newFile.filename,
								size: newFile.size,
								type: newFile.type,
								uploadDate: newFile.createdAt,
							},
						};
					} catch (dbError) {
						// Clean up Cloudinary upload if DB operations fail
						try {
							await cloudinary.uploader.destroy(result.public_id, {
								resource_type: result.resource_type,
							});
						} catch (cleanupError) {
							console.error("Failed to cleanup Cloudinary file:", cleanupError);
						}
						throw dbError;
					}
				} catch (error) {
					return {
						status: "error" as const,
						filename: uploadedFile.originalname,
						error: error instanceof Error ? error.message : "Upload failed",
					};
				}
			});

			const results = await Promise.allSettled(uploadPromises);

			const successfulUploads: any[] = [];
			const failedUploads: any[] = [];

			results.forEach((result) => {
				if (result.status === "fulfilled") {
					if (result.value.status === "success") {
						successfulUploads.push(result.value.file);
					} else {
						failedUploads.push(result.value);
					}
				} else {
					failedUploads.push({
						error: result.reason instanceof Error ? result.reason.message : "Upload failed",
					});
				}
			});

			res.status(201).json({
				success: true,
				files: successfulUploads,
				errors: failedUploads.length > 0 ? failedUploads : undefined,
			});
		} catch (error) {
			console.error("Bulk upload error:", error);
			if (req.files && Array.isArray(req.files)) {
				req.files.forEach((file) => {
					if (fs.existsSync(file.path)) {
						fs.unlinkSync(file.path);
					}
				});
			}
			res.status(500).json({
				error: error instanceof Error ? error.message : "Upload failed",
			});
		}
	},
);

router.get("/", authMiddleware, async (req: AuthRequest, res) => {
	try {
		if (!req.user) {
			return res.status(401).json({ error: "Unauthorized" });
		}

		const ownedFiles = await db.query.file.findMany({
			where: eq(file.ownerId, req.user.id),
			orderBy: [desc(file.createdAt)],
			with: {
				owner: {
					columns: {
						id: true,
						name: true,
						email: true,
					},
				},
			},
		});

		const sharedWithUser = await db.query.share.findMany({
			where: and(
				eq(share.sharedWithUserId, req.user.id),
				or(isNull(share.expiresAt), sql`${share.expiresAt} > NOW()`),
			),
			with: {
				file: {
					with: {
						owner: {
							columns: {
								id: true,
								name: true,
								email: true,
							},
						},
					},
				},
				createdByUser: {
					columns: {
						id: true,
						name: true,
						email: true,
					},
				},
			},
		});

		const sharedFiles = sharedWithUser.map((s) => ({
			...s.file,
			sharedBy: s.createdByUser,
			role: s.role,
		}));

		res.json({
			success: true,
			ownedFiles: ownedFiles.map((f) => ({
				id: f.id,
				filename: f.filename,
				size: f.size,
				type: f.type,
				uploadDate: f.createdAt,
				owner: f.owner,
				isOwner: true,
			})),
			sharedFiles: sharedFiles.map((f) => ({
				id: f.id,
				filename: f.filename,
				size: f.size,
				type: f.type,
				uploadDate: f.createdAt,
				owner: f.owner,
				role: f.role,
				isOwner: false,
			})),
		});
	} catch (error) {
		console.error("Get files error:", error);
		res
			.status(500)
			.json({ error: error instanceof Error ? error.message : "Failed to fetch files" });
	}
});

router.get("/:id", authMiddleware, async (req: AuthRequest, res) => {
	try {
		if (!req.user) {
			return res.status(401).json({ error: "Unauthorized" });
		}

		const id = req.params.id;
		if (!id) {
			return res.status(400).json({ error: "File ID is required" });
		}

		const fileRecord = await db.query.file.findFirst({
			where: eq(file.id, id),
			with: {
				owner: {
					columns: {
						id: true,
						name: true,
						email: true,
					},
				},
			},
		});

		if (!fileRecord) {
			return res.status(404).json({ error: "File not found" });
		}

		const isOwner = fileRecord.ownerId === req.user.id;
		const hasShare = await db.query.share.findFirst({
			where: and(
				eq(share.fileId, fileRecord.id),
				eq(share.sharedWithUserId, req.user.id),
				or(isNull(share.expiresAt), sql`${share.expiresAt} > NOW()`),
			),
		});

		if (!isOwner && !hasShare) {
			return res.status(403).json({ error: "Access denied" });
		}

		res.json({
			success: true,
			file: {
				id: fileRecord.id,
				filename: fileRecord.filename,
				size: fileRecord.size,
				type: fileRecord.type,
				uploadDate: fileRecord.createdAt,
				owner: fileRecord.owner,
				isOwner,
				role: isOwner ? "owner" : hasShare?.role,
			},
		});
	} catch (error) {
		console.error("Get file error:", error);
		res
			.status(500)
			.json({ error: error instanceof Error ? error.message : "Failed to fetch file" });
	}
});

router.get("/:id/download", authMiddleware, async (req: AuthRequest, res) => {
	try {
		if (!req.user) {
			return res.status(401).json({ error: "Unauthorized" });
		}

		const id = req.params.id;
		if (!id) {
			return res.status(400).json({ error: "File ID is required" });
		}

		const fileRecord = await db.query.file.findFirst({
			where: eq(file.id, id),
		});

		if (!fileRecord) {
			return res.status(404).json({ error: "File not found" });
		}

		const isOwner = fileRecord.ownerId === req.user.id;
		const hasShare = await db.query.share.findFirst({
			where: and(
				eq(share.fileId, fileRecord.id),
				eq(share.sharedWithUserId, req.user.id),
				or(isNull(share.expiresAt), sql`${share.expiresAt} > NOW()`),
			),
		});

		if (!isOwner && !hasShare) {
			return res.status(403).json({ error: "Access denied" });
		}

		await logActivity(fileRecord.id, req.user.id, "download");

		res.json({
			success: true,
			downloadUrl: fileRecord.fileUrl,
			filename: fileRecord.filename,
		});
	} catch (error) {
		console.error("Download error:", error);
		res
			.status(500)
			.json({ error: error instanceof Error ? error.message : "Download failed" });
	}
});

router.delete("/:id", authMiddleware, async (req: AuthRequest, res) => {
	try {
		if (!req.user) {
			return res.status(401).json({ error: "Unauthorized" });
		}

		const id = req.params.id;
		if (!id) {
			return res.status(400).json({ error: "File ID is required" });
		}

		const fileRecord = await db.query.file.findFirst({
			where: eq(file.id, id),
		});

		if (!fileRecord) {
			return res.status(404).json({ error: "File not found" });
		}

		if (fileRecord.ownerId !== req.user.id) {
			return res.status(403).json({ error: "Only owner can delete" });
		}

		// Use stored resource_type if available, otherwise fetch from Cloudinary
		let resourceType = (fileRecord as any).resourceType;
		if (!resourceType) {
			try {
				const resource = await cloudinary.api.resource(fileRecord.cloudinaryId, {
					resource_type: "auto",
				});
				resourceType = resource.resource_type;
				// Update DB with the fetched resource_type for future use
				await db.update(file)
					.set({ resourceType })
					.where(eq(file.id, id));
			} catch (apiError) {
				console.error("Failed to fetch resource type from Cloudinary:", apiError);
				// Fallback to inference from MIME type
				resourceType = fileRecord.type.startsWith('image/') ? 'image'
					: fileRecord.type.startsWith('video/') ? 'video'
					: 'raw';
			}
		}

		await cloudinary.uploader.destroy(fileRecord.cloudinaryId, {
			resource_type: resourceType,
		});

		await logActivity(fileRecord.id, req.user.id, "delete");

		await db.delete(file).where(eq(file.id, id));

		res.json({ success: true, message: "File deleted successfully" });
	} catch (error) {
		console.error("Delete error:", error);
		res
			.status(500)
			.json({ error: error instanceof Error ? error.message : "Delete failed" });
	}
});

export default router;
