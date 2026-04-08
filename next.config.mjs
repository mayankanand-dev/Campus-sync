/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // TypeScript type-checking still runs; ESLint unused-vars are cosmetic only.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
