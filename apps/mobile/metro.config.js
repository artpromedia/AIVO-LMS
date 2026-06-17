process.env.EXPO_ROUTER_APP_ROOT = process.env.EXPO_ROUTER_APP_ROOT || "app";
process.env.EXPO_ROUTER_IMPORT_MODE = process.env.EXPO_ROUTER_IMPORT_MODE || "lazy";

const { getDefaultConfig } = require("expo/metro-config");
const fs = require("fs");
const path = require("path");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [
  path.resolve(monorepoRoot, "node_modules"),
  path.resolve(monorepoRoot, "packages/aac-bridge"),
  path.resolve(monorepoRoot, "packages/accessibility-contract"),
  path.resolve(monorepoRoot, "packages/adaptive-baseline"),
  path.resolve(monorepoRoot, "packages/billing-entitlements"),
  path.resolve(monorepoRoot, "packages/brand"),
  path.resolve(monorepoRoot, "packages/mobile-ui"),
  path.resolve(monorepoRoot, "packages/nav"),
  path.resolve(monorepoRoot, "packages/observability"),
];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

config.resolver.unstable_enableSymlinks = true;
config.resolver.disableHierarchicalLookup = false;

const singletonPackages = {
  react: path.resolve(projectRoot, "node_modules/react"),
  "react-dom": path.resolve(projectRoot, "node_modules/react-dom"),
  "react-native": path.resolve(projectRoot, "node_modules/react-native"),
  "react-native-web": path.resolve(projectRoot, "node_modules/react-native-web"),
  // pnpm exposes these as junctions. Explicit mappings keep Metro able to
  // resolve package subpaths such as expo-router/entry during EAS/export.
  "expo-router": path.resolve(projectRoot, "node_modules/expo-router"),
  "expo-speech": path.resolve(projectRoot, "node_modules/expo-speech"),
};

config.resolver.extraNodeModules = singletonPackages;

const explicitModuleEntrypoints = {
  "expo-router/entry": require.resolve("expo-router/entry", { paths: [projectRoot] }),
};

const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (explicitModuleEntrypoints[moduleName]) {
    return {
      type: "sourceFile",
      filePath: explicitModuleEntrypoints[moduleName],
    };
  }
  if (singletonPackages[moduleName]) {
    return {
      type: "sourceFile",
      filePath: require.resolve(moduleName, { paths: [projectRoot] }),
    };
  }
  // Workspace TS packages use NodeNext-style `.js` relative imports in their
  // source. Metro consumes the source directly, so map those specifiers back
  // to the corresponding `.ts` file before its default resolver runs.
  if (
    moduleName.startsWith(".") &&
    moduleName.endsWith(".js") &&
    context.originModulePath.startsWith(path.resolve(monorepoRoot, "packages"))
  ) {
    const sourcePath = path.resolve(
      path.dirname(context.originModulePath),
      moduleName.replace(/\.js$/, ".ts"),
    );
    if (fs.existsSync(sourcePath)) {
      return { type: "sourceFile", filePath: sourcePath };
    }
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
