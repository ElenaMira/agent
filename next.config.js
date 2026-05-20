const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
})
module.exports = withBundleAnalyzer({
  // 👇 加上这一段 → 解决 TS 未绑定断点！
  webpack(config) {
    config.devtool = 'source-map';
    return config;
  }
})