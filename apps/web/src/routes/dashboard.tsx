import { authClient } from "@/lib/auth-client";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { getFiles } from "@/lib/api";
import FileUpload from "@/components/file-upload";
import FileList from "@/components/file-list";
import { toast } from "sonner";

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
	role?: string;
	sharedBy?: {
		id: string;
		name: string;
		email: string;
	};
}

export default function Dashboard() {
	const { data: session, isPending } = authClient.useSession();
	const navigate = useNavigate();
	const [files, setFiles] = useState<FileItem[]>([]);
	const [sharedFiles, setSharedFiles] = useState<FileItem[]>([]);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		if (!session && !isPending) {
			navigate("/login");
		}
	}, [session, isPending, navigate]);

	const loadFiles = async () => {
		setIsLoading(true);
		try {
			const response = await getFiles();
			setFiles(response.ownedFiles || []);
			setSharedFiles(response.sharedFiles || []);
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Failed to load files",
			);
		} finally {
			setIsLoading(false);
		}
	};

	useEffect(() => {
		if (session) {
			loadFiles();
		}
	}, [session]);

	if (isPending || isLoading) {
		return (
			<div className="flex items-center justify-center min-h-[400px]">
				<div className="text-center">
					<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
					<p className="mt-4 text-muted-foreground">Loading...</p>
				</div>
			</div>
		);
	}

	return (
		<div className="container mx-auto max-w-4xl px-4 py-8">
			<div className="space-y-6">
				<div>
					<h1 className="text-3xl font-bold">My Files</h1>
					<p className="text-muted-foreground mt-1">
						Welcome back, {session?.user.name}
					</p>
				</div>

				<FileUpload onUploadSuccess={loadFiles} />

				<div className="pt-4">
					<h2 className="text-xl font-semibold mb-4">My Uploaded Files</h2>
					<FileList files={files} onFileDeleted={loadFiles} />
				</div>

				{sharedFiles.length > 0 && (
					<div className="pt-4">
						<h2 className="text-xl font-semibold mb-4">
							Files Shared With Me
						</h2>
						<FileList files={sharedFiles} onFileDeleted={loadFiles} />
					</div>
				)}
			</div>
		</div>
	);
}
