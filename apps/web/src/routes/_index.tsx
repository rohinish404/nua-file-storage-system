import type { Route } from "./+types/_index";
import { authClient } from "@/lib/auth-client";
import { useEffect } from "react";
import { useNavigate } from "react-router";

export function meta({}: Route.MetaArgs) {
	return [
		{ title: "File Sharing App" },
		{ name: "description", content: "Upload and share files securely" },
	];
}

export default function Home() {
	const { data: session, isPending } = authClient.useSession();
	const navigate = useNavigate();

	useEffect(() => {
		if (!isPending) {
			if (session) {
				navigate("/dashboard");
			} else {
				navigate("/login");
			}
		}
	}, [session, isPending, navigate]);

	return (
		<div className="flex items-center justify-center min-h-[400px]">
			<div className="text-center">
				<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
				<p className="mt-4 text-muted-foreground">Loading...</p>
			</div>
		</div>
	);
}
