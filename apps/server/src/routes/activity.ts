import { Router, type Router as RouterType } from "express";
import { authMiddleware, type AuthRequest } from "../middleware/auth";
import { db } from "@nua-assignment/db";
import { file, activityLog } from "@nua-assignment/db";
import { eq, desc, inArray } from "drizzle-orm";

const router: RouterType = Router();

router.get("/files/:fileId", authMiddleware, async (req: AuthRequest, res) => {
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
				.json({ error: "Only file owner can view activity logs" });
		}

		const activities = await db.query.activityLog.findMany({
			where: eq(activityLog.fileId, fileId),
			orderBy: [desc(activityLog.createdAt)],
			with: {
				user: {
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
			activities: activities.map((a) => ({
				id: a.id,
				activityType: a.activityType,
				user: a.user,
				metadata: a.metadata,
				createdAt: a.createdAt,
			})),
		});
	} catch (error) {
		console.error("Get activity log error:", error);
		res.status(500).json({
			error: error instanceof Error ? error.message : "Failed to fetch activity log",
		});
	}
});

router.get("/user", authMiddleware, async (req: AuthRequest, res) => {
	try {
		if (!req.user) {
			return res.status(401).json({ error: "Unauthorized" });
		}

		const activities = await db.query.activityLog.findMany({
			where: eq(activityLog.userId, req.user.id),
			orderBy: [desc(activityLog.createdAt)],
			limit: 50,
			with: {
				file: {
					columns: {
						id: true,
						filename: true,
					},
				},
				user: {
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
			activities: activities.map((a) => ({
				id: a.id,
				activityType: a.activityType,
				file: a.file,
				user: a.user,
				metadata: a.metadata,
				createdAt: a.createdAt,
			})),
		});
	} catch (error) {
		console.error("Get user activity error:", error);
		res.status(500).json({
			error: error instanceof Error ? error.message : "Failed to fetch user activity",
		});
	}
});

router.get("/", authMiddleware, async (req: AuthRequest, res) => {
	try {
		if (!req.user) {
			return res.status(401).json({ error: "Unauthorized" });
		}

		const userFiles = await db.query.file.findMany({
			where: eq(file.ownerId, req.user.id),
			columns: {
				id: true,
			},
		});

		const fileIds = userFiles.map((f) => f.id);

		if (fileIds.length === 0) {
			return res.json({
				success: true,
				activities: [],
			});
		}

		const activities = await db
			.select()
			.from(activityLog)
			.where(inArray(activityLog.fileId, fileIds))
			.orderBy(desc(activityLog.createdAt))
			.limit(100);

		const activitiesWithDetails = await Promise.all(
			activities.map(async (a) => {
				const activityWithUser = await db.query.activityLog.findFirst({
					where: eq(activityLog.id, a.id),
					with: {
						file: {
							columns: {
								id: true,
								filename: true,
							},
						},
						user: {
							columns: {
								id: true,
								name: true,
								email: true,
							},
						},
					},
				});
				return activityWithUser;
			}),
		);

		res.json({
			success: true,
			activities: activitiesWithDetails.map((a) => ({
				id: a!.id,
				activityType: a!.activityType,
				file: a!.file,
				user: a!.user,
				metadata: a!.metadata,
				createdAt: a!.createdAt,
			})),
		});
	} catch (error) {
		console.error("Get all activities error:", error);
		res.status(500).json({
			error: error instanceof Error ? error.message : "Failed to fetch activities",
		});
	}
});

export default router;
