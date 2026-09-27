/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Aucune image n'est optimisée par l'app : désactiver /_next/image supprime
  // l'exposition aux failles de l'optimiseur non corrigées en 14.x.
  images: { unoptimized: true },
};

export default nextConfig;
