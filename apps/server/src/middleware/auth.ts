import type { Request, Response, NextFunction } from "express";
import { auth } from "@nua-assignment/auth";

export interface AuthRequest extends Request {
	user?: {
		id: string;
		email: string;
		name: string;
	};
}

export const authMiddleware = async (
	req: AuthRequest,
	res: Response,
	next: NextFunction,
) => {
	try {
		const session = await auth.api.getSession({
			headers: req.headers as any,
		});

		if (!session) {
			return res.status(401).json({ error: "Unauthorized" });
		}

		if (!session.user) {
			return res.status(401).json({ error: "Unauthorized" });
		}

		req.user = {
			id: session.user.id,
			email: session.user.email,
			name: session.user.name,
		};

		next();
	} catch (error) {
		console.error("Auth middleware error:", error);
		return res.status(401).json({ error: "Unauthorized" });
	}
};
