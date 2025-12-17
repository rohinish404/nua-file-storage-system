import { authClient } from "@/lib/auth-client";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { getSharedFileByToken } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Download, File as FileIcon, User, Clock } from "lucide-react";

interface SharedFileData {
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
	downloadUrl: string;
	role: string;
}

export default function SharedFilePage() {
	const { data: session, isPending } = authClient.useSession();
	const navigate = useNavigate();
	const { token } = useParams();
	const [fileData, setFileData] = useState<SharedFileData | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!session && !isPending) {
			toast.error("You must be logged in to access shared files");
			navigate("/login");
		}
	}, [session, isPending, navigate]);

	useEffect(() => {
		const loadSharedFile = async () => {
			if (!token) {
				setError("Invalid share link");
				setIsLoading(false);
				return;
			}

			if (!session) {
				return;
			}

			setIsLoading(true);
			setError(null);

			try {
				const response = await getSharedFileByToken(token);
				setFileData(response.file);
			} catch (error) {
				const errorMessage =
					error instanceof Error ? error.message : "Failed to load shared file";
				setError(errorMessage);
				toast.error(errorMessage);
			} finally {
				setIsLoading(false);
			}
		};

		if (session) {
			loadSharedFile();
		}
	}, [token, session]);

	const handleDownload = () => {
		if (fileData?.downloadUrl) {
			window.open(fileData.downloadUrl, "_blank");
			toast.success(`Downloading ${fileData.filename}`);
		}
	};

	const formatFileSize = (bytes: number): string => {
		if (bytes === 0) return "0 Bytes";
		const k = 1024;
		const sizes = ["Bytes", "KB", "MB", "GB"];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
	};

	const formatDate = (dateString: string): string => {
		const date = new Date(dateString);
		return date.toLocaleDateString() + " " + date.toLocaleTimeString();
	};

	if (isPending || isLoading) {
		return (
			<div className="flex items-center justify-center min-h-[400px]">
				<div className="text-center">
					<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
					<p className="mt-4 text-muted-foreground">Loading shared file...</p>
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="container mx-auto max-w-2xl px-4 py-8">
				<Card className="border-destructive">
					<CardHeader>
						<CardTitle className="text-destructive">
							Unable to Access File
						</CardTitle>
						<CardDescription>{error}</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="space-y-4">
							<p className="text-sm text-muted-foreground">
								This could be because:
							</p>
							<ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
								<li>The share link has expired</li>
								<li>The share link has been revoked</li>
								<li>The file has been deleted</li>
								<li>You don't have permission to access this file</li>
							</ul>
							<Button onClick={() => navigate("/dashboard")} className="mt-4">
								Go to Dashboard
							</Button>
						</div>
					</CardContent>
				</Card>
			</div>
		);
	}

	if (!fileData) {
		return null;
	}

	return (
		<div className="container mx-auto max-w-2xl px-4 py-8">
			<div className="space-y-6">
				<div>
					<h1 className="text-3xl font-bold">Shared File</h1>
					<p className="text-muted-foreground mt-1">
						This file has been shared with you
					</p>
				</div>

				<Card>
					<CardHeader>
						<div className="flex items-start gap-4">
							<FileIcon className="h-10 w-10 text-muted-foreground flex-shrink-0 mt-1" />
							<div className="flex-1 min-w-0">
								<CardTitle className="text-2xl break-words">
									{fileData.filename}
								</CardTitle>
								<CardDescription className="mt-2">
									{formatFileSize(fileData.size)} • {fileData.type}
								</CardDescription>
							</div>
						</div>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="grid gap-4">
							<div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
								<User className="h-5 w-5 text-muted-foreground" />
								<div className="flex-1">
									<p className="text-sm font-medium">Shared by</p>
									<p className="text-sm text-muted-foreground">
										{fileData.owner.name} ({fileData.owner.email})
									</p>
								</div>
							</div>

							<div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
								<Clock className="h-5 w-5 text-muted-foreground" />
								<div className="flex-1">
									<p className="text-sm font-medium">Uploaded</p>
									<p className="text-sm text-muted-foreground">
										{formatDate(fileData.uploadDate)}
									</p>
								</div>
							</div>

							<div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
								<Badge variant="secondary">{fileData.role}</Badge>
								<p className="text-sm text-muted-foreground">
									You have {fileData.role} access to this file
								</p>
							</div>
						</div>

						<div className="flex gap-3 pt-4">
							<Button onClick={handleDownload} className="flex-1">
								<Download className="mr-2 h-4 w-4" />
								Download File
							</Button>
							<Button
								variant="outline"
								onClick={() => navigate("/dashboard")}
								className="flex-1"
							>
								Go to Dashboard
							</Button>
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
