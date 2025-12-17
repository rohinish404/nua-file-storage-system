import { useState, useEffect } from "react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "./ui/dialog";
import { Badge } from "./ui/badge";
import { toast } from "sonner";
import { getFileActivityLog } from "@/lib/api";
import {
	Upload,
	Download,
	Share2,
	UserMinus,
	Trash2,
	Activity,
} from "lucide-react";

interface ActivityLogModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	fileId: string;
	filename: string;
}

interface ActivityItem {
	id: string;
	activityType: "upload" | "download" | "share" | "unshare" | "delete";
	user: {
		id: string;
		name: string;
		email: string;
	};
	metadata?: string | null;
	createdAt: string;
}

export default function ActivityLogModal({
	open,
	onOpenChange,
	fileId,
	filename,
}: ActivityLogModalProps) {
	const [activities, setActivities] = useState<ActivityItem[]>([]);
	const [isLoading, setIsLoading] = useState(false);

	const loadActivityLog = async () => {
		setIsLoading(true);
		try {
			const response = await getFileActivityLog(fileId);
			setActivities(response.activities || []);
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "Failed to load activity log",
			);
		} finally {
			setIsLoading(false);
		}
	};

	useEffect(() => {
		if (open) {
			loadActivityLog();
		}
	}, [open, fileId]);

	const getActivityIcon = (type: string) => {
		switch (type) {
			case "upload":
				return <Upload className="h-4 w-4" />;
			case "download":
				return <Download className="h-4 w-4" />;
			case "share":
				return <Share2 className="h-4 w-4" />;
			case "unshare":
				return <UserMinus className="h-4 w-4" />;
			case "delete":
				return <Trash2 className="h-4 w-4" />;
			default:
				return <Activity className="h-4 w-4" />;
		}
	};

	const getActivityColor = (type: string) => {
		switch (type) {
			case "upload":
				return "default";
			case "download":
				return "secondary";
			case "share":
				return "default";
			case "unshare":
				return "outline";
			case "delete":
				return "destructive";
			default:
				return "outline";
		}
	};

	const formatDate = (dateString: string) => {
		const date = new Date(dateString);
		const now = new Date();
		const diff = now.getTime() - date.getTime();
		const seconds = Math.floor(diff / 1000);
		const minutes = Math.floor(seconds / 60);
		const hours = Math.floor(minutes / 60);
		const days = Math.floor(hours / 24);

		if (days > 7) {
			return date.toLocaleDateString() + " " + date.toLocaleTimeString();
		} else if (days > 0) {
			return `${days} day${days > 1 ? "s" : ""} ago`;
		} else if (hours > 0) {
			return `${hours} hour${hours > 1 ? "s" : ""} ago`;
		} else if (minutes > 0) {
			return `${minutes} minute${minutes > 1 ? "s" : ""} ago`;
		} else {
			return "Just now";
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle>Activity Log - "{filename}"</DialogTitle>
					<DialogDescription>
						View all activity related to this file
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-3">
					{isLoading ? (
						<div className="text-center py-8">
							<p className="text-muted-foreground">Loading activity log...</p>
						</div>
					) : activities.length === 0 ? (
						<div className="text-center py-8">
							<Activity className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
							<p className="text-muted-foreground">No activity recorded yet</p>
						</div>
					) : (
						<div className="space-y-2">
							{activities.map((activity) => (
								<div
									key={activity.id}
									className="flex items-start gap-3 p-3 border rounded-lg hover:bg-accent/50 transition-colors"
								>
									<div className="mt-1">
										<Badge variant={getActivityColor(activity.activityType) as any}>
											{getActivityIcon(activity.activityType)}
										</Badge>
									</div>
									<div className="flex-1 min-w-0">
										<div className="flex items-start justify-between gap-2">
											<div className="flex-1">
												<p className="font-medium">
													{activity.user.name}
													<span className="font-normal text-muted-foreground ml-2">
														{activity.activityType}ed the file
													</span>
												</p>
												<p className="text-sm text-muted-foreground">
													{activity.user.email}
												</p>
												{activity.metadata && (
													<p className="text-sm text-muted-foreground mt-1">
														{activity.metadata}
													</p>
												)}
											</div>
											<p className="text-xs text-muted-foreground whitespace-nowrap">
												{formatDate(activity.createdAt)}
											</p>
										</div>
									</div>
								</div>
							))}
						</div>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
}
