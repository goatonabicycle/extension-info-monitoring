import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
	title: "Extension Monitor",
	description: "Monitor browser extension versions across different browsers",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en">
			<body className="antialiased">
				{children}
			</body>
		</html>
	);
}
