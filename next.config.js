/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: { unoptimized: true },
  // If deploying to https://<user>.github.io/<repo>, set basePath to '/<repo>'.
  // For a user/organization site (https://<user>.github.io), leave both empty.
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || '',
  assetPrefix: process.env.NEXT_PUBLIC_BASE_PATH || '',
  trailingSlash: true,
};

module.exports = nextConfig;
