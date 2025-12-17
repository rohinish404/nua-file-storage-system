import { useState } from "react";
import { Button } from "./ui/button";
import { toast } from "sonner";
import { downloadFile, deleteFile } from "@/lib/api";
import {
	Download,
	Trash2,
	File as FileIcon,
	Share2,
	Activity,
} from "lucide-react";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "./ui/card";
import ShareModal from "./share-modal";
import ActivityLogModal from "./activity-log-modal";

interface FileItem {
	id: string;
	filename: string;
	size: number;
	type: string;
	uploadDate: string;
	owner: {
		id: string;
		name: string;
		email: string;
	};
	isOwner: boolean;
}

interface FileListProps {
	files: FileItem[];
	onFileDeleted: () => void;
}

function formatFileSize(bytes: number): string {
	if (bytes === 0) return "0 Bytes";
	const k = 1024;
	const sizes = ["Bytes", "KB", "MB", "GB"];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
}

function formatDate(dateString: string): string {
	const date = new Date(dateString);
	return date.toLocaleDateString() + " " + date.toLocaleTimeString();
}

export default function FileList({ files, onFileDeleted }: FileListProps) {
	const [deletingId, setDeletingId] = useState<string | null>(null);
	const [shareModalOpen, setShareModalOpen] = useState(false);
	const [activityLogModalOpen, setActivityLogModalOpen] = useState(false);
	const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);

	const handleDownload = async (fileId: string, filename: string) => {
		try {
			const response = await downloadFile(fileId);
			window.open(response.downloadUrl, "_blank");
			toast.success(`Downloading ${filename}`);
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Failed to download file",
			);
		}
	};

	const handleDelete = async (fileId: string, filename: string) => {
		if (!confirm(`Are you sure you want to delete "${filename}"?`)) {
			return;
		}

		setDeletingId(fileId);
		try {
			await deleteFile(fileId);
			toast.success(`File "${filename}" deleted successfully`);
			onFileDeleted();
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Failed to delete file",
			);
		} finally {
			setDeletingId(null);
		}
	};

	const handleOpenShareModal = (file: FileItem) => {
		setSelectedFile(file);
		setShareModalOpen(true);
	};

	const handleOpenActivityLog = (file: FileItem) => {
		setSelectedFile(file);
		setActivityLogModalOpen(true);
	};

	if (files.length === 0) {
		return (
			<Card>
				<CardContent className="pt-6">
					<p className="text-center text-muted-foreground">
						No files uploaded yet. Upload your first file to get started!
					</p>
				</CardContent>
			</Card>
		);
	}

	return (
		<>
			<div className="space-y-4">
				{files.map((file) => (
					<Card key={file.id}>
						<CardHeader className="pb-3">
							<div className="flex items-start justify-between gap-4">
								<div className="flex items-start gap-3 min-w-0">
									<FileIcon className="h-5 w-5 mt-0.5 flex-shrink-0 text-muted-foreground" />
									<div className="min-w-0">
										<CardTitle className="text-base truncate">
											{file.filename}
										</CardTitle>
										<CardDescription className="mt-1">
											{formatFileSize(file.size)} • {formatDate(file.uploadDate)}
										</CardDescription>
									</div>
								</div>
								<div className="flex gap-2 flex-shrink-0">
									<Button
										variant="outline"
										size="sm"
										onClick={() => handleDownload(file.id, file.filename)}
										title="Download"
									>
										<Download className="h-4 w-4" />
									</Button>
									{file.isOwner && (
										<>
											<Button
												variant="outline"
												size="sm"
												onClick={() => handleOpenShareModal(file)}
												title="Share"
											>
												<Share2 className="h-4 w-4" />
											</Button>
											<Button
												variant="outline"
												size="sm"
												onClick={() => handleOpenActivityLog(file)}
												title="Activity Log"
											>
												<Activity className="h-4 w-4" />
											</Button>
											<Button
												variant="outline"
												size="sm"
												onClick={() => handleDelete(file.id, file.filename)}
												disabled={deletingId === file.id}
												title="Delete"
											>
												<Trash2 className="h-4 w-4" />
											</Button>
										</>
									)}
								</div>
							</div>
						</CardHeader>
					</Card>
				))}
			</div>

			{selectedFile && (
				<>
					<ShareModal
						open={shareModalOpen}
						onOpenChange={setShareModalOpen}
						fileId={selectedFile.id}
						filename={selectedFile.filename}
					/>
					<ActivityLogModal
						open={activityLogModalOpen}
						onOpenChange={setActivityLogModalOpen}
						fileId={selectedFile.id}
						filename={selectedFile.filename}
					/>
				</>
			)}
		</>
	);
}
