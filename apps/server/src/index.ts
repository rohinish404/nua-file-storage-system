import "dotenv/config";
import cors from "cors";
import express from "express";
import { auth } from "@nua-assignment/auth";
import { toNodeHandler } from "better-auth/node";
import filesRouter from "./routes/files";
import shareRouter from "./routes/share";
import activityRouter from "./routes/activity";

const app = express();

app.use(
	cors({
		origin: process.env.CORS_ORIGIN || "http://localhost:3000",
		methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
		allowedHeaders: ["Content-Type", "Authorization"],
		credentials: true,
	}),
);

app.use(express.json());

// Mount better-auth handler for all /api/auth routes
app.use("/api/auth", toNodeHandler(auth));

app.get("/", (_req, res) => {
	res.status(200).send("OK");
});

app.use("/api/files", filesRouter);
app.use("/api/share", shareRouter);
app.use("/api/activity", activityRouter);

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
	console.error("Error:", err);
	res.status(err.status || 500).json({
		error: err.message || "Internal server error",
	});
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
	console.log(`Server is running on port ${port}`);
});
