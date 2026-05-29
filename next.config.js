/** @type {import('next').NextConfig} */
const nextConfig = {
  images: { unoptimized: true },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@mediapipe/tasks-vision': false,
    };
    return config;
  },
};

module.exports = nextConfig;
