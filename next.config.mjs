/** @type {import('next').NextConfig} */
const nextConfig = {
  // Next 15.1's bundled `next lint` invokes ESLint with legacy options (`useEslintrc`,
  // `extensions`) that ESLint 9 removed. Skipping lint *during build* avoids that crash;
  // CI runs `npm run lint` (eslint directly against our flat config) as the canonical gate.
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;