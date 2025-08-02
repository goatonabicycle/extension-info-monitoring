"use client";

import { ExternalLink } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

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

interface StatusInfo {
	status: 'live' | 'pending' | 'mismatch';
	message: string;
}

interface BrowserRowStatus {
	status: string;
	textColor: string;
}

interface RawExtensionData {
	extension?: string;
	name?: string;
	version: string;
	lastUpdated: string;
	users: number | string;
	url: string;
	lastChecked: string;
}

interface GitlabInfo {
	version?: string;
	releaseDate?: string;
}

interface ApiResponse {
	[browserName: string]: RawExtensionData[] | { [key: string]: GitlabInfo };
}

const compareVersions = (versionA: string, versionB: string): number => {
	const partsA = versionA.split(".").map(Number);
	const partsB = versionB.split(".").map(Number);

	for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
		const partA = partsA[i] || 0;
		const partB = partsB[i] || 0;
		if (partA !== partB) return partA - partB;
	}
	return 0;
};

const isSequentialVersionUpdate = (currentVersion: string, targetVersion: string): boolean => {
	const currentParts = currentVersion.split(".").map(Number);
	
	for (let i = 0; i < currentParts.length; i++) {
		const testVersion = [...currentParts];
		testVersion[i]++;
		for (let j = i + 1; j < testVersion.length; j++) {
			testVersion[j] = 0;
		}
		
		if (testVersion.join(".") === targetVersion) {
			return true;
		}
	}
	return false;
};

const formatUserCount = (users: number | string): string => {
	const userNumber = typeof users === "number" 
		? users 
		: parseInt(users.toString().replace(/,/g, ""));
	
	if (userNumber >= 1000000) return `${(userNumber / 1000000).toFixed(1)}M`;
	if (userNumber >= 1000) return `${Math.round(userNumber / 1000)}K`;
	return userNumber.toString();
};

const formatDate = (dateString: string): string => {
	if (!dateString) return 'Unknown';
	const date = new Date(dateString);
	if (isNaN(date.getTime())) return 'Unknown';
	return date.toLocaleDateString();
};

const formatRelativeTime = (dateString: string): string => {
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

const formatDaysAgo = (dateString: string): string => {
	if (!dateString) return 'Unknown';
	const date = new Date(dateString);
	if (isNaN(date.getTime())) return 'Unknown';
	
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
	
	if (diffDays === 0) return 'Today';
	if (diffDays === 1) return '1 day ago';
	return `${diffDays} days ago`;
};

const normalizeExtensionName = (extensionName: string): string => {
	if (extensionName.includes("Adblock Plus")) return "Adblock Plus";
	if (extensionName.includes("AdBlock")) return "AdBlock";
	return extensionName;
};

const determineGroupStatus = (group: ExtensionGroup): StatusInfo => {
	if (!group.submittedVersion?.trim()) {
		return { status: 'live', message: 'No submission data' };
	}

	const allVersionsAreLive = group.browsers.every(browser => 
		compareVersions(browser.version, group.submittedVersion!) === 0
	);
	
	if (allVersionsAreLive) {
		return { status: 'live', message: 'All versions synchronized' };
	}

	const hasVersionMismatch = group.browsers.some(browser => {
		const versionComparison = compareVersions(browser.version, group.submittedVersion!);
		if (versionComparison >= 0) return false;
		
		return !isSequentialVersionUpdate(browser.version, group.submittedVersion!);
	});

	if (hasVersionMismatch) {
		return { status: 'mismatch', message: 'Version mismatch detected' };
	}
	
	return { status: 'pending', message: 'Updates pending approval' };
};

const determineBrowserRowStatus = (browser: BrowserInfo, group: ExtensionGroup): BrowserRowStatus => {
	if (!group.submittedVersion) {
		return {
			status: "✓ LIVE",
			textColor: "text-green-600 dark:text-green-400 font-semibold"
		};
	}

	const versionComparison = compareVersions(browser.version, group.submittedVersion);
	
	if (versionComparison === 0) {
		return {
			status: "✓ LIVE",
			textColor: "text-green-600 dark:text-green-400 font-semibold"
		};
	}
	
	if (versionComparison < 0) {
		const isSequentialUpdate = isSequentialVersionUpdate(browser.version, group.submittedVersion);
		
		if (isSequentialUpdate) {
			return {
				status: "○ PENDING",
				textColor: "text-blue-600 dark:text-blue-400 font-medium"
			};
		} else {
			return {
				status: "⚠ MISMATCH",
				textColor: "text-red-600 dark:text-red-400 font-bold"
			};
		}
	}
	
	return {
		status: "⚠ MISMATCH",
		textColor: "text-red-600 dark:text-red-400 font-bold"
	};
};


const getStatusBadgeStyles = (statusType: StatusInfo['status']): string => {
	const baseStyles = "inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium";
	
	switch (statusType) {
		case 'mismatch':
			return `${baseStyles} bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400`;
		case 'pending':
			return `${baseStyles} bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400`;
		case 'live':
		default:
			return `${baseStyles} bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400`;
	}
};

const processExtensionData = (apiData: ApiResponse): ExtensionGroup[] => {
	const extensionGroups: Record<string, { name: string; browsers: BrowserInfo[] }> = {};

	Object.entries(apiData).forEach(([browserName, extensionsData]) => {
		if (browserName === 'gitlab' || !Array.isArray(extensionsData)) return;

		extensionsData.forEach((extension: RawExtensionData) => {
			const extensionName = extension.extension || extension.name;
			if (!extensionName) return;

			const normalizedName = normalizeExtensionName(extensionName);

			if (!extensionGroups[normalizedName]) {
				extensionGroups[normalizedName] = {
					name: normalizedName,
					browsers: [],
				};
			}

			extensionGroups[normalizedName].browsers.push({
				browser: browserName,
				version: extension.version,
				lastUpdated: extension.lastUpdated,
				users: extension.users,
				url: extension.url,
				lastChecked: extension.lastChecked,
			});
		});
	});

	const gitlabData = (apiData.gitlab as Record<string, GitlabInfo>) || {};

	return Object.values(extensionGroups).map((group) => {
		const allVersions = group.browsers.map((browser) => browser.version);
		const latestVersion = allVersions.reduce((latest, current) =>
			compareVersions(current, latest) > 0 ? current : latest
		);

		const normalizedGroupName = group.name.toLowerCase().replace(/\s+/g, '');
		let gitlabInfo: GitlabInfo | null = null;
		
		if (normalizedGroupName.includes('adblockplus')) {
			gitlabInfo = gitlabData.adblockplus;
		} else if (normalizedGroupName.includes('adblock')) {
			gitlabInfo = gitlabData.adblock;
		}

		return {
			...group,
			latestVersion,
			isConsistent: allVersions.every((version) => version === allVersions[0]),
			releaseDate: gitlabInfo?.releaseDate,
			submittedVersion: gitlabInfo?.version,
		};
	});
};

const LoadingSpinner = () => (
	<div className="flex items-center justify-center min-h-screen">
		<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-gray-100" />
	</div>
);

const ErrorMessage = ({ error }: { error: string }) => (
	<div className="flex items-center justify-center min-h-screen">
		<p className="text-red-500">Error: {error}</p>
	</div>
);

const StatusBadge = ({ statusInfo }: { statusInfo: StatusInfo }) => (
	<div className={getStatusBadgeStyles(statusInfo.status)}>
		<span className="w-1 h-1 rounded-full bg-current"></span>
		{statusInfo.message}
	</div>
);

const VersionBadges = ({ group }: { group: ExtensionGroup }) => {
	const uniqueVersions = useMemo(() => 
		[...new Set(group.browsers.map(browser => browser.version))], 
		[group.browsers]
	);

	return (
		<div className="flex flex-wrap gap-1.5">
			{uniqueVersions.map(version => {				
				let displayColor = "";
				
				if (!group.submittedVersion) {
					displayColor = "text-gray-600 dark:text-gray-400";
				} else {
					const versionComparison = compareVersions(version, group.submittedVersion);
					
					if (versionComparison === 0) {						
						displayColor = "text-green-600 dark:text-green-400";
					} else if (versionComparison < 0) {						
						const isSequentialUpdate = isSequentialVersionUpdate(version, group.submittedVersion);
						
						if (isSequentialUpdate) {							
							displayColor = "text-blue-600 dark:text-blue-400";
						} else {							
							displayColor = "text-red-600 dark:text-red-400";
						}
					} else {						
						displayColor = "text-red-600 dark:text-red-400";
					}
				}
				
				const browserCount = group.browsers.filter(browser => browser.version === version).length;
				
				return (
					<div key={version} className="bg-muted px-1.5 py-0.5 rounded text-xs">
						<span className={`font-mono font-medium ${displayColor}`}>
							{version}
						</span>
						<span className="text-[10px] text-muted-foreground ml-0.5">
							({browserCount})
						</span>
					</div>
				);
			})}
		</div>
	);
};

const SubmittedVersionInfo = ({ group }: { group: ExtensionGroup }) => {
	if (!group.submittedVersion) return null;

	let extensionSlug = group.name.toLowerCase().replace(/\s+/g, '');
	
	const releaseTag = `${extensionSlug}-${group.submittedVersion}`;
	const gitlabReleaseUrl = `https://gitlab.com/eyeo/browser-extensions-and-premium/extensions/extensions/-/releases/${releaseTag}`;
	
	const hasLiveVersion = group.browsers.some(browser => 
		browser.version === group.submittedVersion
	);
	
	const bgColorClass = hasLiveVersion 
		? "bg-green-100 dark:bg-green-900/20" 
		: "bg-primary/10";
	const borderColorClass = hasLiveVersion 
		? "border-green-300 dark:border-green-800" 
		: "border-primary/20";
	const textColorClass = hasLiveVersion 
		? "text-green-700 dark:text-green-400" 
		: "";

	return (
		<div className="flex items-center gap-3">
			<div className="text-xs text-muted-foreground">Submitted:</div>
			<a
				href={gitlabReleaseUrl}
				target="_blank"
				rel="noopener noreferrer"
				className={`inline-flex items-center gap-1 ${bgColorClass} border ${borderColorClass} px-1.5 py-0.5 rounded hover:opacity-80 transition-opacity`}
			>
				<span className={`font-mono text-xs font-medium ${textColorClass}`}>
					{group.submittedVersion}
				</span>
				{group.releaseDate && (
					<span className="text-[10px] text-muted-foreground ml-1">
						({formatDate(group.releaseDate)})
					</span>
				)}
				<ExternalLink className="w-2.5 h-2.5 ml-0.5" />
			</a>
		</div>
	);
};

const BrowserRow = ({ browser, group }: { browser: BrowserInfo; group: ExtensionGroup }) => {
	const rowStatus = useMemo(() => 
		determineBrowserRowStatus(browser, group), 
		[browser, group]
	);

	const isOpera = browser.browser.toLowerCase() === 'opera';

	return (
		<tr key={`${group.name}-${browser.browser}`} className="border-b last:border-0">
			<td className="py-2 px-2 text-xs">
				<a
					href={browser.url}
					target="_blank"
					rel="noopener noreferrer"
					className="inline-flex items-center gap-0.5 capitalize hover:underline font-medium"
				>
					{browser.browser}
					<ExternalLink className="w-2.5 h-2.5" />
				</a>
			</td>
			<td className="py-2 px-2">
				<span className="text-[11px] font-bold">
					{rowStatus.status}
				</span>
			</td>
			<td className="py-2 px-2">
				<span className={`font-mono text-xs ${rowStatus.textColor}`}>
					{browser.version}
				</span>
			</td>
			<td className="py-2 px-2 text-right text-xs">
				{isOpera ? '-' : formatUserCount(browser.users)}
			</td>
			<td className="py-2 px-2 text-xs">
				<span 
					title={formatDate(browser.lastUpdated)}
					className="cursor-help"
				>
					{formatDaysAgo(browser.lastUpdated)}
				</span>
			</td>
		</tr>
	);
};

const ExtensionTable = ({ group }: { group: ExtensionGroup }) => (
	<div className="overflow-x-auto">
		<table className="w-full text-sm">
			<thead>
				<tr className="border-b text-xs">
					<th className="text-left py-1.5 px-2">Browser</th>
					<th className="text-left py-1.5 px-2">Status</th>
					<th className="text-left py-1.5 px-2">Version</th>
					<th className="text-right py-1.5 px-2">Users</th>
					<th className="text-left py-1.5 px-2">Updated</th>
				</tr>
			</thead>
			<tbody>
				{group.browsers.map((browser) => (
					<BrowserRow 
						key={`${group.name}-${browser.browser}`}
						browser={browser} 
						group={group} 
					/>
				))}
			</tbody>
		</table>
	</div>
);

const ExtensionCard = ({ group }: { group: ExtensionGroup }) => {
	const statusInfo = useMemo(() => determineGroupStatus(group), [group]);

	return (
		<Card key={group.name} className="border-white">
			<CardHeader>
				<div className="flex items-center justify-between mb-3">
					<div className="flex items-center gap-3">
						<CardTitle className="text-lg">{group.name}</CardTitle>
						<StatusBadge statusInfo={statusInfo} />
					</div>
					{group.browsers.length > 0 && (
						<div className="text-xs text-muted-foreground">
							last updated {formatRelativeTime(group.browsers[0].lastChecked)}
						</div>
					)}
				</div>
				
				<div className="space-y-2">
					<div className="flex items-center gap-3">
						<div className="text-xs text-muted-foreground">Live:</div>
						<VersionBadges group={group} />
					</div>
					<SubmittedVersionInfo group={group} />
				</div>
			</CardHeader>
			<CardContent>
				<ExtensionTable group={group} />
			</CardContent>
		</Card>
	);
};

export function ExtensionMonitor() {
	const [extensions, setExtensions] = useState<ExtensionGroup[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const fetchExtensions = useCallback(async () => {
		try {
			const response = await fetch("/api/extensions");
			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}
			const apiData: ApiResponse = await response.json();
			const processedGroups = processExtensionData(apiData);
			setExtensions(processedGroups);
		} catch (err) {
			setError(err instanceof Error ? err.message : 'An unknown error occurred');
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchExtensions();
	}, [fetchExtensions]);

	if (loading) return <LoadingSpinner />;
	if (error) return <ErrorMessage error={error} />;

	return (
		<div className="max-w-6xl mx-auto p-6">
			<div className="space-y-6">
				{extensions.map((group) => (
					<ExtensionCard key={group.name} group={group} />
				))}
			</div>
		</div>
	);
}