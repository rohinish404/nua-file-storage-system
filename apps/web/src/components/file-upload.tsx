import { useState, useRef } from "react";
import { Button } from "./ui/button";
import { toast } from "sonner";
import { uploadFile, uploadBulkFiles } from "@/lib/api";
import { Upload, FileUp } from "lucide-react";
import { Card, CardContent } from "./ui/card";

interface FileUploadProps {
	onUploadSuccess: () => void;
}

export default function FileUpload({ onUploadSuccess }: FileUploadProps) {
	const [isUploading, setIsUploading] = useState(false);
	const [uploadProgress, setUploadProgress] = useState<string[]>([]);
	const singleFileInputRef = useRef<HTMLInputElement>(null);
	const bulkFileInputRef = useRef<HTMLInputElement>(null);

	const handleSingleFileSelect = async (
		e: React.ChangeEvent<HTMLInputElement>,
	) => {
		const file = e.target.files?.[0];
		if (!file) return;

		setIsUploading(true);
		setUploadProgress([`Uploading ${file.name}...`]);
		try {
			await uploadFile(file);
			toast.success(`File "${file.name}" uploaded successfully`);
			onUploadSuccess();
			if (singleFileInputRef.current) {
				singleFileInputRef.current.value = "";
			}
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Failed to upload file",
			);
		} finally {
			setIsUploading(false);
			setUploadProgress([]);
		}
	};

	const handleBulkFileSelect = async (
		e: React.ChangeEvent<HTMLInputElement>,
	) => {
		const files = e.target.files;
		if (!files || files.length === 0) return;

		const fileArray = Array.from(files);
		const maxFiles = 10;

		if (fileArray.length > maxFiles) {
			toast.error(`You can only upload up to ${maxFiles} files at once`);
			return;
		}

		setIsUploading(true);
		setUploadProgress(fileArray.map((f) => `Uploading ${f.name}...`));

		try {
			await uploadBulkFiles(fileArray);
			toast.success(
				`${fileArray.length} file${fileArray.length > 1 ? "s" : ""} uploaded successfully`,
			);
			onUploadSuccess();
			if (bulkFileInputRef.current) {
				bulkFileInputRef.current.value = "";
			}
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Failed to upload files",
			);
		} finally {
			setIsUploading(false);
			setUploadProgress([]);
		}
	};

	return (
		<div className="space-y-4">
			<Card>
				<CardContent className="pt-6">
					<div className="flex flex-col sm:flex-row gap-3">
						<input
							ref={singleFileInputRef}
							type="file"
							onChange={handleSingleFileSelect}
							className="hidden"
							id="single-file-upload"
							disabled={isUploading}
							accept=".pdf,.jpg,.jpeg,.png,.gif,.csv,.xlsx,.xls"
						/>
						<Button
							onClick={() => singleFileInputRef.current?.click()}
							disabled={isUploading}
							className="flex-1"
						>
							<Upload className="mr-2 h-4 w-4" />
							Upload Single File
						</Button>

						<input
							ref={bulkFileInputRef}
							type="file"
							onChange={handleBulkFileSelect}
							className="hidden"
							id="bulk-file-upload"
							disabled={isUploading}
							multiple
							accept=".pdf,.jpg,.jpeg,.png,.gif,.csv,.xlsx,.xls"
						/>
						<Button
							onClick={() => bulkFileInputRef.current?.click()}
							disabled={isUploading}
							variant="outline"
							className="flex-1"
						>
							<FileUp className="mr-2 h-4 w-4" />
							Upload Multiple Files
						</Button>
					</div>

					{isUploading && uploadProgress.length > 0 && (
						<div className="mt-4 space-y-1">
							{uploadProgress.map((progress, index) => (
								<p key={index} className="text-sm text-muted-foreground">
									{progress}
								</p>
							))}
						</div>
					)}

					<p className="text-xs text-muted-foreground mt-3">
						Supported formats: PDF, Images (JPG, PNG, GIF), CSV, Excel. Max 10
						files at once.
					</p>
				</CardContent>
			</Card>
		</div>
	);
}
