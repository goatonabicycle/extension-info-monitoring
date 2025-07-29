import { NextResponse } from "next/server";

export async function GET() {
	try {
		const response = await fetch(
			"https://pub-079f1d96c32c4039998e87fd3c5b549d.r2.dev/extension-latest.json",
			{
				headers: {
					"User-Agent":
						"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
				},
			},
		);

		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}

		const data = await response.json();

		return NextResponse.json(data, {
			headers: {
				"Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
			},
		});
	} catch (error) {
		console.error("Error fetching extension data:", error);
		return NextResponse.json(
			{ error: "Failed to fetch extension data" },
			{ status: 500 },
		);
	}
}
