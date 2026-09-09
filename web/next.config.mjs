/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep the application root independent from private Candidate directories.
  turbopack: { root: import.meta.dirname },
  // The server renderer uses these packages' installed workers and browser assets.
  serverExternalPackages: ['playwright-core', 'pdfjs-dist'],
  ...(process.env.BUILD_DIST ? { distDir: process.env.BUILD_DIST } : {}),
};
export default nextConfig;
