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

const getStatusInfo = (group: ExtensionGroup) => {
	const hasSubmittedVersion = group.submittedVersion && group.submittedVersion.trim() !== '';
	const hasReleaseDate = group.releaseDate && group.releaseDate.trim() !== '';
	
	if (!hasSubmittedVersion) {
		return { status: 'unknown', message: 'No submission data', color: 'gray' };
	}

	const isVersionMismatch = group.submittedVersion !== group.latestVersion;
	const isInconsistent = !group.isConsistent;
	
	const isSubmittedNewer = group.browsers.some(browser => 
		compareVersions(group.submittedVersion!, browser.version) > 0
	);
	
	const isSubmittedOlder = group.browsers.some(browser => 
		compareVersions(group.submittedVersion!, browser.version) < 0
	);

	if (isInconsistent && isVersionMismatch) {
		return { 
			status: 'critical', 
			message: 'Version inconsistency + Submission mismatch', 
			color: 'red' 
		};
	}
	
	if (isInconsistent) {
		return { 
			status: 'warning', 
			message: 'Store versions are inconsistent', 
			color: 'orange' 
		};
	}
	
	if (isSubmittedNewer) {
		return { 
			status: 'pending', 
			message: 'New version pending store approval', 
			color: 'blue' 
		};
	}
	
	if (isSubmittedOlder) {
		return { 
			status: 'outdated', 
			message: 'Submission is older than live versions', 
			color: 'yellow' 
		};
	}
	
	if (isVersionMismatch) {
		return { 
			status: 'mismatch', 
			message: 'Submitted version differs from live', 
			color: 'yellow' 
		};
	}
	
	return { status: 'synced', message: 'All versions synchronized', color: 'green' };
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
	releaseDate?: string;
	submittedVersion?: string;
}

export function ExtensionMonitor() {
	const [extensions, setExtensions] = useState<ExtensionGroup[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const groupExtensionsByName = (data: Record<string, any>) => {
			const groups: Record<string, { name: string; browsers: any[] }> = {};

			Object.entries(data).forEach(([browser, exts]) => {
				if (browser === 'gitlab' || !Array.isArray(exts)) return;

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

			const gitlabData = data.gitlab || {};

			return Object.values(groups).map((group) => {
				const versions = group.browsers.map((b) => b.version);
				const latestVersion = versions.reduce((latest, current) =>
					compareVersions(current, latest) > 0 ? current : latest,
				);

				const normalizedGroupName = group.name.toLowerCase().replace(/\s+/g, '');
				let gitlabInfo = null;
				
				if (normalizedGroupName.includes('adblockplus')) {
					gitlabInfo = gitlabData.adblockplus;
				} else if (normalizedGroupName.includes('adblock')) {
					gitlabInfo = gitlabData.adblock;
				}

				return {
					...group,
					latestVersion,
					isConsistent: versions.every((v) => v === versions[0]),
					releaseDate: gitlabInfo?.releaseDate,
					submittedVersion: gitlabInfo?.version,
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
				{extensions.map((group) => {
					const statusInfo = getStatusInfo(group);
					const statusColor = {
						red: 'border-red-500 bg-red-50 dark:bg-red-950/20',
						orange: 'border-orange-500 bg-orange-50 dark:bg-orange-950/20',
						yellow: 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20',
						blue: 'border-blue-500 bg-blue-50 dark:bg-blue-950/20',
						green: 'border-green-500 bg-green-50 dark:bg-green-950/20',
						gray: 'border-gray-300 bg-gray-50 dark:bg-gray-950/20'
					}[statusInfo.color] || '';

					const badgeVariant = {
						red: 'destructive',
						orange: 'destructive', 
						yellow: 'secondary',
						blue: 'default',
						green: 'default',
						gray: 'secondary'
					}[statusInfo.color] as 'default' | 'secondary' | 'destructive';

					return (
						<Card key={group.name} className={`border-2 ${statusColor}`}>
							<CardHeader>
								<div className="flex items-start justify-between mb-3">
									<div>
										<CardTitle className="text-xl mb-1">{group.name}</CardTitle>
										<div className="flex items-center gap-2">
											<Badge variant={badgeVariant} className="text-xs font-medium">
												{statusInfo.status.toUpperCase()}
											</Badge>
											<span className="text-sm text-muted-foreground">
												{statusInfo.message}
											</span>
										</div>
									</div>
								</div>
								
								<div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
									<div>
										<span className="text-muted-foreground">Live Version(s):</span>
										<div className="flex flex-wrap gap-1 mt-1">
											{[...new Set(group.browsers.map(b => b.version))].map(version => (
												<span key={version} className="font-mono bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-xs">
													{version}
												</span>
											))}
										</div>
									</div>
									
									{group.submittedVersion && (
										<div>
											<span className="text-muted-foreground">Submitted:</span>
											<div className="mt-1">
												<span className="font-mono bg-blue-100 dark:bg-blue-900 px-2 py-1 rounded text-xs font-medium">
													{group.submittedVersion}
												</span>
												{group.releaseDate && (
													<div className="text-xs text-muted-foreground mt-1">
														on {formatDate(group.releaseDate)}
													</div>
												)}
											</div>
										</div>
									)}
								</div>
							</CardHeader>
						<CardContent>
							<div className="overflow-x-auto">
								<table className="w-full text-sm">
									<thead>
										<tr className="border-b">
											<th className="text-left py-2 px-3">Browser</th>
											<th className="text-left py-2 px-3">Status</th>
											<th className="text-left py-2 px-3">Current store version</th>
											<th className="text-right py-2 px-3">Users</th>
											<th className="text-left py-2 px-3">Updated</th>
										</tr>
									</thead>
									<tbody>
										{group.browsers.map((item) => {
											const vsSubmitted = group.submittedVersion ? 
												compareVersions(item.version, group.submittedVersion) : 0;
											const vsLatest = compareVersions(item.version, group.latestVersion);

											let status = "";
											let borderClass = "";
											let textColor = "";

											if (group.submittedVersion) {
												if (vsSubmitted === 0) {
													status = "✅ LIVE";
													borderClass = "border-2 border-green-500 bg-green-50 dark:bg-green-950/20";
													textColor = "text-green-600 dark:text-green-400 font-semibold";
												} else if (vsSubmitted < 0) {
													// Check if also behind other live versions
													if (vsLatest < 0) {
														status = "🚨 SUBMISSION MISMATCH";
														borderClass = "border-2 border-red-500 bg-red-50 dark:bg-red-950/20";
														textColor = "text-red-600 dark:text-red-400 font-bold";
													} else {
														status = "⏳ PENDING";
														borderClass = "border-2 border-blue-500 bg-blue-50 dark:bg-blue-950/20";
														textColor = "text-blue-600 dark:text-blue-400";
													}
												} else {
													status = "🚨 SUBMISSION MISMATCH";
													borderClass = "border-2 border-red-500 bg-red-50 dark:bg-red-950/20";
													textColor = "text-red-600 dark:text-red-400 font-bold";
												}
											} else {
												status = "✅ LIVE";
												borderClass = "border-2 border-green-500 bg-green-50 dark:bg-green-950/20";
												textColor = "text-green-600 dark:text-green-400";
											}

											return (
												<tr
													key={`${group.name}-${item.browser}`}
													className={`${borderClass} rounded`}
												>
													<td className="py-3 px-3 font-medium">
														<a
															href={item.url}
															target="_blank"
															rel="noopener noreferrer"
															className="inline-flex items-center gap-1 capitalize hover:underline"
														>
															{item.browser}
															<ExternalLink className="w-3 h-3" />
														</a>
													</td>
													<td className="py-3 px-3">
														<span className="text-xs font-bold">
															{status}
														</span>
													</td>
													<td className="py-3 px-3">
														<span className={`font-mono text-sm ${textColor}`}>
															{item.version}
														</span>
													</td>
													<td className="py-3 px-3 text-right">
														{formatUsers(item.users)}
													</td>
													<td className="py-3 px-3">
														{formatDate(item.lastUpdated)}
													</td>
												</tr>
											);
										})}
									</tbody>
								</table>
							</div>
						</CardContent>
					</Card>
					);
				})}
			</div>
		</div>
	);
}
