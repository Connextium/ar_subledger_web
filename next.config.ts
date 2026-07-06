import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
	transpilePackages: ["@ar-subledger/api-contracts"],
	turbopack: {
		root: path.resolve(__dirname, "../.."),
	},
};

export default nextConfig;
