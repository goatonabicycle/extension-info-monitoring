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
	if (!dateString) return 'Unknown';
	const date = new Date(dateString);
	if (isNaN(date.getTime())) return 'Unknown';
	return date.toLocaleDateString();
};

const formatRelativeTime = (dateString: string) => {
	if (!dateString) return 'Unknown';
	const date = new Date(dateString);
	if (isNaN(date.getTime())) return 'Unknown';
	
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffMinutes = Math.floor(diffMs / (1000 * 60));
	const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
	
	if (diffMinutes < 1) return 'Just now';
	if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} ago`;
	if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
	
	return formatDate(dateString);
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
	lastChecked: string;
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
						lastChecked: ext.lastChecked,
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
						<Card key={group.name} className="border-2 border-white">
							<CardHeader>
								<div className="flex items-center justify-between mb-3">
									<div className="flex items-center gap-4">
										<CardTitle className="text-xl">{group.name}</CardTitle>
										<div className={`inline-flex items-center gap-2 px-2 py-1 rounded text-sm font-medium ${
											statusInfo.color === 'red' ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400' :
											statusInfo.color === 'orange' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400' :
											statusInfo.color === 'blue' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400' :
											'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
										}`}>
											<span className="w-1.5 h-1.5 rounded-full bg-current"></span>
											{statusInfo.message}
										</div>
									</div>
									{group.browsers.length > 0 && (
										<div className="flex items-center gap-2 text-sm text-muted-foreground">
											<span>Last checked:</span>
											<span className="text-xs">
												{formatRelativeTime(group.browsers[0].lastChecked)}
											</span>
										</div>
									)}
								</div>
								
								<div className="space-y-2">
									<div className="flex items-center gap-4">
										<div className="text-sm text-muted-foreground">Live:</div>
										<div className="flex flex-wrap gap-2">
											{[...new Set(group.browsers.map(b => b.version))].map(version => {
												// Find a browser with this version to get its color
												const sampleBrowser = group.browsers.find(b => b.version === version);
												const vsSubmitted = group.submittedVersion ? 
													compareVersions(version, group.submittedVersion) : 0;
												const vsLatest = compareVersions(version, group.latestVersion);
												
												let textColor = "text-foreground";
												if (group.submittedVersion) {
													if (vsSubmitted === 0) {
														textColor = "text-green-600 dark:text-green-400";
													} else if (vsSubmitted < 0) {
														if (vsLatest < 0) {
															textColor = "text-red-600 dark:text-red-400";
														} else {
															textColor = "text-blue-600 dark:text-blue-400";
														}
													} else {
														textColor = "text-red-600 dark:text-red-400";
													}
												} else {
													textColor = "text-green-600 dark:text-green-400";
												}
												
												return (
													<div key={version} className="bg-muted px-2 py-1 rounded text-sm">
														<span className={`font-mono font-medium ${textColor}`}>{version}</span>
														<span className="text-xs text-muted-foreground ml-1">
															({group.browsers.filter(b => b.version === version).length})
														</span>
													</div>
												);
											})}
										</div>
									</div>
									
									{group.submittedVersion && (
										<div className="flex items-center gap-4">
											<div className="text-sm text-muted-foreground">Submitted:</div>
											<div className="bg-primary/10 border border-primary/20 px-2 py-1 rounded">
												<span className="font-mono text-sm font-medium">{group.submittedVersion}</span>
												{group.releaseDate && (
													<span className="text-xs text-muted-foreground ml-2">
														({formatDate(group.releaseDate)})
													</span>
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
													status = "✓ LIVE";
													borderClass = "";
													textColor = "text-green-600 dark:text-green-400 font-semibold";
												} else if (vsSubmitted < 0) {
													if (vsLatest < 0) {
														status = "⚠ MISMATCH";
														borderClass = "";
														textColor = "text-red-600 dark:text-red-400 font-bold";
													} else {
														status = "○ PENDING";
														borderClass = "";
														textColor = "text-blue-600 dark:text-blue-400 font-medium";
													}
												} else {
													status = "⚠ MISMATCH";
													borderClass = "";
													textColor = "text-red-600 dark:text-red-400 font-bold";
												}
											} else {
												status = "✓ LIVE";
												borderClass = "";
												textColor = "text-green-600 dark:text-green-400 font-semibold";
											}

											return (
												<tr
													key={`${group.name}-${item.browser}`}
													className="border-b last:border-0"
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
