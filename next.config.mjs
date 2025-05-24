// next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  // ... other configurations
  devIndicators: {
    buildActivity: true, // Optional: shows build activity indicator
    buildActivityPosition: 'bottom-right', // Optional
  },
  // Add this for the cross-origin warning
  experimental: {
    allowedDevOrigins: ["http://192.168.56.1:3000"], // Replace 3000 with your dev server port if different
  },
};

export default nextConfig;