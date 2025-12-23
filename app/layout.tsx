import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SessionProvider } from "@/components/session-provider";
import "./globals.css";

const geistSans = Geist({
    variable: "--font-geist-sans",
    subsets: ["latin"],
    display: "swap",
});

const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"],
    display: "swap",
});

export const viewport: Viewport = {
    themeColor: "#18181b",
    width: "device-width",
    initialScale: 1,
    maximumScale: 5,
};

export const metadata: Metadata = {
    title: {
        default: "Collection Tracker | 1st Bowman Chrome Base Autos",
        template: "%s | Collection Tracker",
    },
    description: "Track price movements for 1st Bowman Chrome Base Autographs. Monitor market trends, compare against article prices, and identify investment opportunities.",
    keywords: [
        "bowman",
        "chrome",
        "baseball cards",
        "price tracking",
        "autographs",
        "prospects",
        "1st bowman",
        "hobby",
        "investment",
        "ebay",
        "comps",
    ],
    authors: [{ name: "Collection Tracker" }],
    creator: "Collection Tracker",
    robots: {
        index: true,
        follow: true,
    },
    openGraph: {
        title: "Collection Tracker | 1st Bowman Chrome Base Autos",
        description: "Track price movements for 1st Bowman Chrome Base Autographs. Real-time market analysis and trend monitoring.",
        type: "website",
        locale: "en_US",
    },
    twitter: {
        card: "summary_large_image",
        title: "Collection Tracker",
        description: "Track 1st Bowman Chrome Base Auto prices",
    },
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" className="dark" suppressHydrationWarning>
            <head>
                <link rel="icon" href="/favicon.ico" sizes="any" />
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
            </head>
            <body
                className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased bg-zinc-950 text-white min-h-screen`}
            >
                <SessionProvider>
                    {children}
                </SessionProvider>
            </body>
        </html>
    );
}

