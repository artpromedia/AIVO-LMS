// Local entry shim for expo-router, required for pnpm + Metro on EAS.
// Re-exports expo-router's entry so Metro can resolve it through normal
// node_modules walking instead of via package.json main + nested symlink.
import 'expo-router/entry';
