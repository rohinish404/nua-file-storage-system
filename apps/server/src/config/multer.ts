import multer from "multer";
import path from "path";
import fs from "fs";
import os from "os";
import crypto from "crypto";

// Use OS temp directory for better cleanup
const uploadsDir = process.env.UPLOAD_TEMP_DIR || path.join(os.tmpdir(), "file-uploads");

// Create directory if it doesn't exist
try {
	if (!fs.existsSync(uploadsDir)) {
		fs.mkdirSync(uploadsDir, { recursive: true });
	}
} catch (error) {
	console.error("Failed to create upload directory:", error);
	throw error;
}

// Cleanup configuration
const CLEANUP_ENABLED = process.env.CLEANUP_ENABLED !== "false"; // Default true
const CLEANUP_RETENTION_HOURS = parseInt(process.env.CLEANUP_RETENTION_HOURS || "24", 10);
const CLEANUP_INTERVAL_HOURS = parseInt(process.env.CLEANUP_INTERVAL_HOURS || "1", 10);

if (isNaN(CLEANUP_RETENTION_HOURS) || CLEANUP_RETENTION_HOURS <= 0) {
	throw new Error("CLEANUP_RETENTION_HOURS must be a positive number");
}
if (isNaN(CLEANUP_INTERVAL_HOURS) || CLEANUP_INTERVAL_HOURS <= 0) {
	throw new Error("CLEANUP_INTERVAL_HOURS must be a positive number");
}

// Sanitize filename to prevent path traversal and injection
function sanitizeFilename(originalName: string): string {
	// Remove null bytes
	let sanitized = originalName.replace(/\0/g, "");

	// Get only the basename (no directory components)
	sanitized = path.basename(sanitized);

	// Replace unsafe characters - only keep alphanumeric, dots, dashes, and underscores
	sanitized = sanitized.replace(/[^a-zA-Z0-9._-]/g, "_");

	// Enforce max length (255 is typical filesystem limit, use 200 to be safe)
	const maxLength = 200;
	if (sanitized.length > maxLength) {
		const ext = path.extname(sanitized);
		const nameWithoutExt = path.basename(sanitized, ext);
		sanitized = nameWithoutExt.substring(0, maxLength - ext.length) + ext;
	}

	// Ensure filename is not empty after sanitization
	if (!sanitized || sanitized === ".") {
		sanitized = "file";
	}

	return sanitized;
}

// Cleanup old files
async function cleanupOldFiles(): Promise<void> {
	if (!CLEANUP_ENABLED) {
		return;
	}

	try {
		const now = Date.now();
		const retentionMs = CLEANUP_RETENTION_HOURS * 60 * 60 * 1000;

		const files = await fs.promises.readdir(uploadsDir);

		const cleanupPromises = files.map(async (file) => {
			const filePath = path.join(uploadsDir, file);
			try {
				const stats = await fs.promises.stat(filePath);
				const fileAge = now - stats.mtimeMs;

				if (fileAge > retentionMs) {
					await fs.promises.unlink(filePath);
					console.log(`Cleaned up old temp file: ${file}`);
				}
			} catch (err) {
				console.error(`Error checking/deleting file ${file}:`, err);
			}
		});

		await Promise.allSettled(cleanupPromises);
	} catch (error) {
		console.error("Error during cleanup:", error);
	}
}

// Schedule cleanup job
if (CLEANUP_ENABLED) {
	const intervalMs = CLEANUP_INTERVAL_HOURS * 60 * 60 * 1000;
	setInterval(() => {
		cleanupOldFiles().catch((err) => {
			console.error("Error in scheduled cleanup:", err);
		});
	}, intervalMs);
	// Run cleanup on startup
	cleanupOldFiles().catch((err) => {
		console.error("Error in startup cleanup:", err);
	});
	console.log(
		`Temp file cleanup enabled: retention=${CLEANUP_RETENTION_HOURS}h, interval=${CLEANUP_INTERVAL_HOURS}h`,
	);
}

const storage = multer.diskStorage({
	destination: (_req, _file, cb) => {
		cb(null, uploadsDir);
	},
	filename: (_req, file, cb) => {
		try {
			// Sanitize the original filename
			const sanitized = sanitizeFilename(file.originalname);

			// Generate cryptographically strong random suffix
			const randomSuffix = crypto.randomBytes(8).toString("hex");

			// Construct final filename: timestamp-randomSuffix-sanitizedName
			const timestamp = Date.now();
			const finalName = `${timestamp}-${randomSuffix}-${sanitized}`;

			cb(null, finalName);
		} catch (error) {
			cb(error as Error, "");
		}
	},
});

const fileFilter = (
	_req: Express.Request,
	file: Express.Multer.File,
	cb: multer.FileFilterCallback,
) => {
	const allowedTypes = [
		"image/jpeg",
		"image/jpg",
		"image/png",
		"image/gif",
		"image/webp",
		"application/pdf",
		"text/csv",
		"application/vnd.ms-excel",
		"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
		"video/mp4",
		"video/mpeg",
		"video/quicktime",
		"audio/mpeg",
		"audio/wav",
	];

	if (allowedTypes.includes(file.mimetype)) {
		cb(null, true);
	} else {
		cb(new Error("Invalid file type. Only images, PDFs, CSVs, videos, and audio files are allowed."));
	}
};

export const upload = multer({
	storage,
	limits: {
		fileSize: 50 * 1024 * 1024, // 50MB per file
		files: 10, // Maximum 10 files per request
		fields: 20, // Maximum 20 non-file fields
		fieldSize: 1 * 1024 * 1024, // 1MB per field value
	},
	fileFilter,
});
