import type { NextConfig } from "next";
import path from "node:path";

function parseAllowedDevOrigins(): string[] {
	const configured = [
		process.env.WEB_ALLOWED_DEV_ORIGINS,
		process.env.NEXT_ALLOWED_DEV_ORIGINS,
		process.env.ALLOWED_DEV_ORIGINS,
	]
		.filter((value): value is string => Boolean(value?.trim()))
		.flatMap((value) => value.split(/[\s,]+/))
		.map((value) => value.trim())
		.filter(Boolean);

	return Array.from(new Set(["localhost", "127.0.0.1", "0.0.0.0", "*.localhost", ...configured]));
}

const nextConfig: NextConfig = {
	allowedDevOrigins: parseAllowedDevOrigins(),
	transpilePackages: ["@ar-subledger/api-contracts"],
	turbopack: {
		root: path.resolve(__dirname, "../.."),
	},
};

export default nextConfig;
