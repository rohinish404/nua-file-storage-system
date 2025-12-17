import { Router, type Router as RouterType } from "express";
import { authMiddleware, type AuthRequest } from "../middleware/auth";
import { db } from "@nua-assignment/db";
import { file, share, user, activityLog } from "@nua-assignment/db";
import { nanoid } from "nanoid";
import { eq, and } from "drizzle-orm";

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

router.post("/:fileId/user", authMiddleware, async (req: AuthRequest, res) => {
	try {
		if (!req.user) {
			return res.status(401).json({ error: "Unauthorized" });
		}

		const fileId = req.params.fileId;
		if (!fileId) {
			return res.status(400).json({ error: "File ID is required" });
		}

		const { userEmail, role = "viewer", expiresAt } = req.body;

		if (!userEmail) {
			return res.status(400).json({ error: "User email is required" });
		}

		// Validate role
		const allowedRoles = ["viewer", "editor"];
		if (role && !allowedRoles.includes(role)) {
			return res.status(400).json({ error: "Invalid role. Must be 'viewer' or 'editor'" });
		}

		const fileRecord = await db.query.file.findFirst({
			where: eq(file.id, fileId),
		});

		if (!fileRecord) {
			return res.status(404).json({ error: "File not found" });
		}

		if (fileRecord.ownerId !== req.user.id) {
			return res
				.status(403)
				.json({ error: "Only file owner can share files" });
		}

		const sharedUser = await db.query.user.findFirst({
			where: eq(user.email, userEmail),
		});

		if (!sharedUser) {
			return res.status(404).json({ error: "User not found" });
		}

		if (sharedUser.id === req.user.id) {
			return res.status(400).json({ error: "Cannot share with yourself" });
		}

		const existingShare = await db.query.share.findFirst({
			where: and(
				eq(share.fileId, fileId),
				eq(share.sharedWithUserId, sharedUser.id),
				eq(share.shareType, "user"),
			),
		});

		if (existingShare) {
			return res
				.status(400)
				.json({ error: "File already shared with this user" });
		}

		// Validate expiresAt date
		let expiresAtDate: Date | null = null;
		if (expiresAt) {
			const parsedDate = new Date(expiresAt);
			if (isNaN(parsedDate.getTime())) {
				return res.status(400).json({ error: "Invalid expiration date" });
			}
			if (parsedDate <= new Date()) {
				return res.status(400).json({ error: "Expiration date must be in the future" });
			}
			expiresAtDate = parsedDate;
		}

		const rows = await db
			.insert(share)
			.values({
				id: nanoid(),
				fileId,
				shareType: "user",
				sharedWithUserId: sharedUser.id,
				role: role || "viewer",
				expiresAt: expiresAtDate,
				createdBy: req.user.id,
			})
			.returning();
		const newShare = rows[0]!;

		await logActivity(
			fileId,
			req.user.id,
			"share",
			`Shared with ${userEmail}`,
		);

		res.status(201).json({
			success: true,
			message: "File shared successfully",
			share: {
				id: newShare.id,
				sharedWith: {
					id: sharedUser.id,
					email: sharedUser.email,
					name: sharedUser.name,
				},
				role: newShare.role,
				expiresAt: newShare.expiresAt,
				createdAt: newShare.createdAt,
			},
		});
	} catch (error) {
		console.error("Share with user error:", error);
		res.status(500).json({
			error: error instanceof Error ? error.message : "Share failed",
		});
	}
});

router.post("/:fileId/link", authMiddleware, async (req: AuthRequest, res) => {
	try {
		if (!req.user) {
			return res.status(401).json({ error: "Unauthorized" });
		}

		const fileId = req.params.fileId;
		if (!fileId) {
			return res.status(400).json({ error: "File ID is required" });
		}

		const { expiresAt } = req.body;

		const fileRecord = await db.query.file.findFirst({
			where: eq(file.id, fileId),
		});

		if (!fileRecord) {
			return res.status(404).json({ error: "File not found" });
		}

		if (fileRecord.ownerId !== req.user.id) {
			return res
				.status(403)
				.json({ error: "Only file owner can generate share links" });
		}

		const token = nanoid(32);

		// Validate expiresAt date
		let expiresAtDate: Date | null = null;
		if (expiresAt) {
			const parsedDate = new Date(expiresAt);
			if (isNaN(parsedDate.getTime())) {
				return res.status(400).json({ error: "Invalid expiration date" });
			}
			if (parsedDate <= new Date()) {
				return res.status(400).json({ error: "Expiration date must be in the future" });
			}
			expiresAtDate = parsedDate;
		}

		const rows = await db
			.insert(share)
			.values({
				id: nanoid(),
				fileId,
				shareType: "link",
				token,
				role: "viewer",
				expiresAt: expiresAtDate,
				createdBy: req.user.id,
			})
			.returning();
		const newShare = rows[0]!;

		await logActivity(
			fileId,
			req.user.id,
			"share",
			"Generated share link",
		);

		const shareLink = `${process.env.FRONTEND_URL || "http://localhost:5173"}/shared/${token}`;

		res.status(201).json({
			success: true,
			message: "Share link generated successfully",
			shareLink,
			share: {
				id: newShare.id,
				token: newShare.token,
				expiresAt: newShare.expiresAt,
				createdAt: newShare.createdAt,
			},
		});
	} catch (error) {
		console.error("Generate share link error:", error);
		res.status(500).json({
			error: error instanceof Error ? error.message : "Share link generation failed",
		});
	}
});

router.get("/link/:token", authMiddleware, async (req: AuthRequest, res) => {
	try {
		if (!req.user) {
			return res.status(401).json({ error: "Unauthorized" });
		}

		const token = req.params.token;
		if (!token) {
			return res.status(400).json({ error: "Token is required" });
		}

		const shareRecord = await db.query.share.findFirst({
			where: and(
				eq(share.token, token),
				eq(share.shareType, "link"),
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
			},
		});

		if (!shareRecord) {
			return res.status(404).json({ error: "Share link not found" });
		}

		if (
			shareRecord.expiresAt &&
			new Date(shareRecord.expiresAt) < new Date()
		) {
			return res.status(403).json({ error: "Share link has expired" });
		}

		await logActivity(shareRecord.fileId, req.user.id, "download");

		res.json({
			success: true,
			file: {
				id: shareRecord.file.id,
				filename: shareRecord.file.filename,
				size: shareRecord.file.size,
				type: shareRecord.file.type,
				uploadDate: shareRecord.file.createdAt,
				owner: shareRecord.file.owner,
				downloadUrl: shareRecord.file.fileUrl,
				role: shareRecord.role,
			},
		});
	} catch (error) {
		console.error("Access share link error:", error);
		res.status(500).json({
			error: error instanceof Error ? error.message : "Failed to access shared file",
		});
	}
});

router.get("/:fileId/shares", authMiddleware, async (req: AuthRequest, res) => {
	try {
		if (!req.user) {
			return res.status(401).json({ error: "Unauthorized" });
		}

		const fileId = req.params.fileId;
		if (!fileId) {
			return res.status(400).json({ error: "File ID is required" });
		}

		const fileRecord = await db.query.file.findFirst({
			where: eq(file.id, fileId),
		});

		if (!fileRecord) {
			return res.status(404).json({ error: "File not found" });
		}

		if (fileRecord.ownerId !== req.user.id) {
			return res
				.status(403)
				.json({ error: "Only file owner can view shares" });
		}

		const shares = await db.query.share.findMany({
			where: eq(share.fileId, fileId),
			with: {
				sharedWithUser: {
					columns: {
						id: true,
						name: true,
						email: true,
					},
				},
			},
		});

		res.json({
			success: true,
			shares: shares.map((s) => ({
				id: s.id,
				shareType: s.shareType,
				sharedWith: s.sharedWithUser || undefined,
				token: s.token,
				role: s.role,
				expiresAt: s.expiresAt,
				createdAt: s.createdAt,
			})),
		});
	} catch (error) {
		console.error("Get shares error:", error);
		res.status(500).json({
			error: error instanceof Error ? error.message : "Failed to fetch shares",
		});
	}
});

router.delete("/:shareId", authMiddleware, async (req: AuthRequest, res) => {
	try {
		if (!req.user) {
			return res.status(401).json({ error: "Unauthorized" });
		}

		const shareId = req.params.shareId;
		if (!shareId) {
			return res.status(400).json({ error: "Share ID is required" });
		}

		const shareRecord = await db.query.share.findFirst({
			where: eq(share.id, shareId),
			with: {
				file: true,
			},
		});

		if (!shareRecord) {
			return res.status(404).json({ error: "Share not found" });
		}

		if (shareRecord.file.ownerId !== req.user.id) {
			return res
				.status(403)
				.json({ error: "Only file owner can revoke shares" });
		}

		await db.delete(share).where(eq(share.id, shareId));

		await logActivity(
			shareRecord.fileId,
			req.user.id,
			"unshare",
			`Revoked share ${shareId}`,
		);

		res.json({
			success: true,
			message: "Share revoked successfully",
		});
	} catch (error) {
		console.error("Revoke share error:", error);
		res.status(500).json({
			error: error instanceof Error ? error.message : "Failed to revoke share",
		});
	}
});

export default router;
