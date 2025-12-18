/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    "@polkadot-agent-kit/sdk",
    "@polkadot-agent-kit/common",
    "@polkadot-agent-kit/core",
    "@polkadot-agent-kit/llm"
  ],
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  webpack: (config, { isServer }) => {
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };

    // Correctly handle WASM in both server and client
    config.module.rules.push({
      test: /\.wasm$/,
      type: "webassembly/async",
    });

    if (!isServer) {
      config.output.environment = {
        ...config.output.environment,
        asyncFunction: true,
      };
      // Polyfill Node.js built-ins for client-side
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        os: false,
        crypto: false,
      };
    }

    return config;
  },
}

export default nextConfig