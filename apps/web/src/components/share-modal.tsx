import { useState, useEffect } from "react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "./ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "./ui/select";
import { Badge } from "./ui/badge";
import { toast } from "sonner";
import {
	shareWithUser,
	generateShareLink,
	getFileShares,
	revokeShare,
} from "@/lib/api";
import { Copy, Trash2, Users, Link2, Clock } from "lucide-react";

interface ShareModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	fileId: string;
	filename: string;
}

interface ShareItem {
	id: string;
	shareType: "user" | "link";
	sharedWith?: {
		id: string;
		name: string;
		email: string;
	};
	token?: string;
	role: string;
	expiresAt?: string | null;
	createdAt: string;
}

export default function ShareModal({
	open,
	onOpenChange,
	fileId,
	filename,
}: ShareModalProps) {
	const [userEmail, setUserEmail] = useState("");
	const [role, setRole] = useState<"viewer" | "owner">("viewer");
	const [userExpiresAt, setUserExpiresAt] = useState("");
	const [linkExpiresAt, setLinkExpiresAt] = useState("");
	const [isSharing, setIsSharing] = useState(false);
	const [isGeneratingLink, setIsGeneratingLink] = useState(false);
	const [shares, setShares] = useState<ShareItem[]>([]);
	const [isLoadingShares, setIsLoadingShares] = useState(false);
	const [generatedLink, setGeneratedLink] = useState("");

	const loadShares = async () => {
		setIsLoadingShares(true);
		try {
			const response = await getFileShares(fileId);
			setShares(response.shares || []);
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Failed to load shares",
			);
		} finally {
			setIsLoadingShares(false);
		}
	};

	useEffect(() => {
		if (open) {
			loadShares();
			setGeneratedLink("");
			setUserEmail("");
			setRole("viewer");
			setUserExpiresAt("");
			setLinkExpiresAt("");
		}
	}, [open, fileId]);

	const handleShareWithUser = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!userEmail.trim()) {
			toast.error("Please enter a user email");
			return;
		}

		setIsSharing(true);
		try {
			await shareWithUser(
				fileId,
				userEmail.trim(),
				role,
				userExpiresAt || undefined,
			);
			toast.success(`File shared with ${userEmail}`);
			setUserEmail("");
			setUserExpiresAt("");
			loadShares();
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed to share");
		} finally {
			setIsSharing(false);
		}
	};

	const handleGenerateLink = async () => {
		setIsGeneratingLink(true);
		try {
			const response = await generateShareLink(
				fileId,
				linkExpiresAt || undefined,
			);
			setGeneratedLink(response.shareLink);
			toast.success("Share link generated successfully");
			setLinkExpiresAt("");
			loadShares();
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Failed to generate link",
			);
		} finally {
			setIsGeneratingLink(false);
		}
	};

	const handleCopyLink = (link: string) => {
		navigator.clipboard.writeText(link);
		toast.success("Link copied to clipboard");
	};

	const handleRevokeShare = async (shareId: string, shareType: string) => {
		if (
			!confirm(
				`Are you sure you want to revoke this ${shareType === "user" ? "user" : "link"} share?`,
			)
		) {
			return;
		}

		try {
			await revokeShare(shareId);
			toast.success("Share revoked successfully");
			loadShares();
			if (shareType === "link") {
				setGeneratedLink("");
			}
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Failed to revoke share",
			);
		}
	};

	const formatDate = (dateString: string) => {
		const date = new Date(dateString);
		return date.toLocaleDateString() + " " + date.toLocaleTimeString();
	};

	const isExpired = (expiresAt?: string | null) => {
		if (!expiresAt) return false;
		return new Date(expiresAt) < new Date();
	};

	const userShares = shares.filter((s) => s.shareType === "user");
	const linkShares = shares.filter((s) => s.shareType === "link");

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle>Share "{filename}"</DialogTitle>
					<DialogDescription>
						Share this file with other users or generate a shareable link
					</DialogDescription>
				</DialogHeader>

				<Tabs defaultValue="user" className="w-full">
					<TabsList className="grid w-full grid-cols-2">
						<TabsTrigger value="user">
							<Users className="h-4 w-4 mr-2" />
							Share with User
						</TabsTrigger>
						<TabsTrigger value="link">
							<Link2 className="h-4 w-4 mr-2" />
							Generate Link
						</TabsTrigger>
					</TabsList>

					<TabsContent value="user" className="space-y-4">
						<form onSubmit={handleShareWithUser} className="space-y-4">
							<div>
								<Label htmlFor="email">User Email</Label>
								<Input
									id="email"
									type="email"
									placeholder="user@example.com"
									value={userEmail}
									onChange={(e) => setUserEmail(e.target.value)}
									className="mt-1"
								/>
							</div>

							<div>
								<Label htmlFor="role">Role</Label>
								<Select value={role} onValueChange={(value: any) => setRole(value)}>
									<SelectTrigger id="role" className="mt-1">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="viewer">Viewer (can view and download)</SelectItem>
										<SelectItem value="owner">Owner (full access)</SelectItem>
									</SelectContent>
								</Select>
							</div>

							<div>
								<Label htmlFor="userExpiry">
									Expiration Date (Optional)
								</Label>
								<Input
									id="userExpiry"
									type="datetime-local"
									value={userExpiresAt}
									onChange={(e) => setUserExpiresAt(e.target.value)}
									className="mt-1"
								/>
							</div>

							<Button type="submit" disabled={isSharing} className="w-full">
								{isSharing ? "Sharing..." : "Share File"}
							</Button>
						</form>

						<div className="border-t pt-4">
							<h3 className="font-semibold mb-3 flex items-center gap-2">
								<Users className="h-4 w-4" />
								Shared with Users ({userShares.length})
							</h3>
							{isLoadingShares ? (
								<p className="text-sm text-muted-foreground">Loading...</p>
							) : userShares.length === 0 ? (
								<p className="text-sm text-muted-foreground">
									Not shared with any users yet
								</p>
							) : (
								<div className="space-y-2">
									{userShares.map((share) => (
										<div
											key={share.id}
											className="flex items-center justify-between p-3 border rounded-lg"
										>
											<div className="flex-1 min-w-0">
												<p className="font-medium truncate">
													{share.sharedWith?.name}
												</p>
												<p className="text-sm text-muted-foreground truncate">
													{share.sharedWith?.email}
												</p>
												<div className="flex items-center gap-2 mt-1">
													<Badge variant="secondary">{share.role}</Badge>
													{share.expiresAt && (
														<Badge
															variant={isExpired(share.expiresAt) ? "destructive" : "outline"}
														>
															<Clock className="h-3 w-3 mr-1" />
															{isExpired(share.expiresAt)
																? "Expired"
																: `Expires ${formatDate(share.expiresAt)}`}
														</Badge>
													)}
												</div>
											</div>
											<Button
												variant="outline"
												size="sm"
												onClick={() => handleRevokeShare(share.id, "user")}
											>
												<Trash2 className="h-4 w-4" />
											</Button>
										</div>
									))}
								</div>
							)}
						</div>
					</TabsContent>

					<TabsContent value="link" className="space-y-4">
						<div className="space-y-4">
							<div>
								<Label htmlFor="linkExpiry">
									Expiration Date (Optional)
								</Label>
								<Input
									id="linkExpiry"
									type="datetime-local"
									value={linkExpiresAt}
									onChange={(e) => setLinkExpiresAt(e.target.value)}
									className="mt-1"
								/>
							</div>

							<Button
								onClick={handleGenerateLink}
								disabled={isGeneratingLink}
								className="w-full"
							>
								{isGeneratingLink ? "Generating..." : "Generate Share Link"}
							</Button>

							{generatedLink && (
								<div className="p-3 bg-muted rounded-lg">
									<Label className="text-xs text-muted-foreground">
										Generated Link
									</Label>
									<div className="flex items-center gap-2 mt-2">
										<Input
											value={generatedLink}
											readOnly
											className="font-mono text-sm"
										/>
										<Button
											variant="outline"
											size="sm"
											onClick={() => handleCopyLink(generatedLink)}
										>
											<Copy className="h-4 w-4" />
										</Button>
									</div>
								</div>
							)}
						</div>

						<div className="border-t pt-4">
							<h3 className="font-semibold mb-3 flex items-center gap-2">
								<Link2 className="h-4 w-4" />
								Active Share Links ({linkShares.length})
							</h3>
							{isLoadingShares ? (
								<p className="text-sm text-muted-foreground">Loading...</p>
							) : linkShares.length === 0 ? (
								<p className="text-sm text-muted-foreground">
									No share links generated yet
								</p>
							) : (
								<div className="space-y-2">
									{linkShares.map((share) => {
										const shareLink = `${window.location.origin}/shared/${share.token}`;
										return (
											<div
												key={share.id}
												className="flex items-center justify-between p-3 border rounded-lg"
											>
												<div className="flex-1 min-w-0 mr-2">
													<div className="flex items-center gap-2 mb-1">
														<Badge variant="secondary">{share.role}</Badge>
														{share.expiresAt && (
															<Badge
																variant={
																	isExpired(share.expiresAt) ? "destructive" : "outline"
																}
															>
																<Clock className="h-3 w-3 mr-1" />
																{isExpired(share.expiresAt)
																	? "Expired"
																	: `Expires ${formatDate(share.expiresAt)}`}
															</Badge>
														)}
													</div>
													<p className="text-xs text-muted-foreground font-mono truncate">
														{shareLink}
													</p>
												</div>
												<div className="flex gap-2">
													<Button
														variant="outline"
														size="sm"
														onClick={() => handleCopyLink(shareLink)}
													>
														<Copy className="h-4 w-4" />
													</Button>
													<Button
														variant="outline"
														size="sm"
														onClick={() => handleRevokeShare(share.id, "link")}
													>
														<Trash2 className="h-4 w-4" />
													</Button>
												</div>
											</div>
										);
									})}
								</div>
							)}
						</div>
					</TabsContent>
				</Tabs>
			</DialogContent>
		</Dialog>
	);
}
