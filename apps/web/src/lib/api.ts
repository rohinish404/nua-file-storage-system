const API_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:3000";
const DEFAULT_TIMEOUT = 30000; // 30 seconds

// Helper function to create fetch with timeout
async function fetchWithTimeout(
	url: string,
	options: RequestInit = {},
	timeout: number = DEFAULT_TIMEOUT,
): Promise<Response> {
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), timeout);

	try {
		const response = await fetch(url, {
			...options,
			signal: controller.signal,
		});

		if (!response.ok) {
			// Try to extract error message from response
			let errorMessage: string;
			try {
				const errorData = await response.json();
				errorMessage = errorData.error || `Request failed with status ${response.status}`;
			} catch {
				// If JSON parsing fails, try to get text or use default message
				try {
					errorMessage = await response.text() || `Request failed with status ${response.status}`;
				} catch {
					errorMessage = `Request failed with status ${response.status}`;
				}
			}
			throw new Error(errorMessage);
		}

		return response;
	} catch (error) {
		if (error instanceof Error) {
			if (error.name === 'AbortError') {
				throw new Error('Request timeout');
			}
			throw error;
		}
		throw new Error('Network request failed');
	} finally {
		clearTimeout(timeoutId);
	}
}

export async function uploadFile(file: File) {
	const formData = new FormData();
	formData.append("file", file);

	const response = await fetchWithTimeout(`${API_URL}/api/files/upload`, {
		method: "POST",
		body: formData,
		credentials: "include",
	}, 60000); // 60 seconds for file uploads

	return response.json();
}

export async function getFiles() {
	const response = await fetchWithTimeout(`${API_URL}/api/files`, {
		credentials: "include",
	});

	return response.json();
}

export async function downloadFile(fileId: string) {
	const response = await fetchWithTimeout(`${API_URL}/api/files/${fileId}/download`, {
		credentials: "include",
	});

	// The response contains JSON with downloadUrl, not the binary file itself
	return response.json();
}

export async function deleteFile(fileId: string) {
	const response = await fetchWithTimeout(`${API_URL}/api/files/${fileId}`, {
		method: "DELETE",
		credentials: "include",
	});

	return response.json();
}

export async function uploadBulkFiles(files: File[]) {
	const formData = new FormData();
	files.forEach((file) => {
		formData.append("files", file);
	});

	const response = await fetchWithTimeout(`${API_URL}/api/files/upload-bulk`, {
		method: "POST",
		body: formData,
		credentials: "include",
	}, 120000); // 120 seconds for bulk uploads

	return response.json();
}

export async function shareWithUser(
	fileId: string,
	userEmail: string,
	role: "viewer" | "owner" = "viewer",
	expiresAt?: string,
) {
	const response = await fetchWithTimeout(`${API_URL}/api/share/${fileId}/user`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify({ userEmail, role, expiresAt }),
		credentials: "include",
	});

	return response.json();
}

export async function generateShareLink(fileId: string, expiresAt?: string) {
	const response = await fetchWithTimeout(`${API_URL}/api/share/${fileId}/link`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify({ expiresAt }),
		credentials: "include",
	});

	return response.json();
}

export async function getFileShares(fileId: string) {
	const response = await fetchWithTimeout(`${API_URL}/api/share/${fileId}/shares`, {
		credentials: "include",
	});

	return response.json();
}

export async function revokeShare(shareId: string) {
	const response = await fetchWithTimeout(`${API_URL}/api/share/${shareId}`, {
		method: "DELETE",
		credentials: "include",
	});

	return response.json();
}

export async function getSharedFileByToken(token: string) {
	const response = await fetchWithTimeout(`${API_URL}/api/share/link/${token}`, {
		credentials: "include",
	});

	return response.json();
}

export async function getFileActivityLog(fileId: string) {
	const response = await fetchWithTimeout(`${API_URL}/api/activity/files/${fileId}`, {
		credentials: "include",
	});

	return response.json();
}

export async function getUserActivity() {
	const response = await fetchWithTimeout(`${API_URL}/api/activity/user`, {
		credentials: "include",
	});

	return response.json();
}

export async function getAllActivity() {
	const response = await fetchWithTimeout(`${API_URL}/api/activity`, {
		credentials: "include",
	});

	return response.json();
}
