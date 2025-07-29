"use client";

import { ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

const compareVersions = (a: string, b: string) => {
	const aParts = a.split(".").map(Number);
	const bParts = b.split(".").map(Number);

	for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
		const aPart = aParts[i] || 0;
		const bPart = bParts[i] || 0;
		if (aPart !== bPart) return aPart - bPart;
	}
	return 0;
};

const formatUsers = (users: number | string) => {
	const num =
		typeof users === "number"
			? users
			: parseInt(users.toString().replace(/,/g, ""));
	if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
	if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
	return num.toString();
};

const formatDate = (dateString: string) => {
	return new Date(dateString).toLocaleDateString();
};

interface BrowserInfo {
	browser: string;
	version: string;
	lastUpdated: string;
	users: number | string;
	url: string;
}

interface ExtensionGroup {
	name: string;
	browsers: BrowserInfo[];
	latestVersion: string;
	isConsistent: boolean;
}

export function ExtensionMonitor() {
	const [extensions, setExtensions] = useState<ExtensionGroup[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const groupExtensionsByName = (data: Record<string, any>) => {
			const groups: Record<string, { name: string; browsers: any[] }> = {};

			Object.entries(data).forEach(([browser, exts]) => {
				if (!Array.isArray(exts)) return;

				exts.forEach((ext) => {
					const name = ext.extension || ext.name;
					if (!name) return;

					const normalizedName = name.includes("Adblock Plus")
						? "Adblock Plus"
						: name.includes("AdBlock")
							? "AdBlock"
							: name;

					if (!groups[normalizedName]) {
						groups[normalizedName] = {
							name: normalizedName,
							browsers: [],
						};
					}

					groups[normalizedName].browsers.push({
						browser,
						version: ext.version,
						lastUpdated: ext.lastUpdated,
						users: ext.users,
						url: ext.url,
					});
				});
			});

			return Object.values(groups).map((group) => {
				const versions = group.browsers.map((b) => b.version);
				const latestVersion = versions.reduce((latest, current) =>
					compareVersions(current, latest) > 0 ? current : latest,
				);

				return {
					...group,
					latestVersion,
					isConsistent: versions.every((v) => v === versions[0]),
				};
			});
		};

		fetch("/api/extensions")
			.then((res) => res.json())
			.then((data) => {
				const grouped = groupExtensionsByName(data);
				setExtensions(grouped);
			})
			.catch((err) => setError(err.message))
			.finally(() => setLoading(false));
	}, []);

	if (loading) {
		return (
			<div className="flex items-center justify-center min-h-screen">
				<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-gray-100" />
			</div>
		);
	}

	if (error) {
		return (
			<div className="flex items-center justify-center min-h-screen">
				<p className="text-red-500">Error: {error}</p>
			</div>
		);
	}

	return (
		<div className="max-w-6xl mx-auto p-6">
			<div className="space-y-6">
				{extensions.map((group) => (
					<Card key={group.name}>
						<CardHeader>
							<div className="flex items-center justify-between">
								<CardTitle className="text-xl">{group.name}</CardTitle>
								<Badge variant={group.isConsistent ? "default" : "destructive"}>
									{group.isConsistent ? "Consistent" : "Version Mismatch"}
								</Badge>
							</div>
						</CardHeader>
						<CardContent>
							<div className="overflow-x-auto">
								<table className="w-full text-sm">
									<thead>
										<tr className="border-b">
											<th className="text-left py-2 px-3">Browser</th>
											<th className="text-left py-2 px-3">Version</th>
											<th className="text-right py-2 px-3">Users</th>
											<th className="text-left py-2 px-3">Updated</th>
											<th className="text-center py-2 px-3">Link</th>
										</tr>
									</thead>
									<tbody>
										{group.browsers.map((item) => {
											const isLatest = item.version === group.latestVersion;
											const isOutdated =
												compareVersions(item.version, group.latestVersion) < 0;

											return (
												<tr
													key={`${group.name}-${item.browser}`}
													className={`border-b last:border-0 ${
														isLatest
															? "bg-green-50 dark:bg-green-950/20"
															: isOutdated
																? "bg-yellow-50 dark:bg-yellow-950/20"
																: ""
													}`}
												>
													<td className="py-2 px-3 font-medium capitalize">
														{item.browser}
													</td>
													<td className="py-2 px-3">
														<span className={`font-mono ${
															isLatest ? "text-green-600 dark:text-green-400" : 
															isOutdated ? "text-yellow-600 dark:text-yellow-400" : ""
														}`}>
															{item.version}
														</span>
													</td>
													<td className="py-2 px-3 text-right">
														{formatUsers(item.users)}
													</td>
													<td className="py-2 px-3">
														{formatDate(item.lastUpdated)}
													</td>
													<td className="py-2 px-3 text-center">
														<a
															href={item.url}
															target="_blank"
															rel="noopener noreferrer"
															className="inline-flex items-center justify-center p-1 rounded hover:bg-accent"
														>
															<ExternalLink className="w-4 h-4" />
														</a>
													</td>
												</tr>
											);
										})}
									</tbody>
								</table>
							</div>
						</CardContent>
					</Card>
				))}
			</div>
		</div>
	);
}
