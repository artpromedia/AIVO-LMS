const {
  withProjectBuildGradle,
  withAppBuildGradle,
} = require('@expo/config-plugins');

/**
 * Two Android build fixes that must survive `expo prebuild --clean`
 * (which regenerates the native android/ project from scratch):
 *
 * 1. @react-native-async-storage/async-storage v3 ships its native
 *    `org.asyncstorage.shared_storage:storage-android` artifact in a bundled
 *    Maven repo (`android/local_repo`) but never registers that repo, so a
 *    release Gradle build can't resolve it. Register the repo in the root
 *    project's `allprojects { repositories { } }` via the autolinked Gradle
 *    project path so it stays portable across machines.
 *
 * 2. react-native-reanimated 4 + react-native-worklets under pnpm: two
 *    peer-hashed worklets copies exist, and Reanimated's CMake resolves a
 *    different copy (via `node require.resolve`) than the one Expo autolinking
 *    actually builds, so it links a `libworklets.so` that was never produced.
 *    Pin Reanimated to the autolinked worklets project via the official
 *    `REACT_NATIVE_WORKLETS_NODE_MODULES_DIR` app ext property.
 */

const REPO_MARKER = 'async-storage local_repo';
const REPO_BLOCK = [
  `    // ${REPO_MARKER}`,
  `    maven { url "\${project(':react-native-async-storage_async-storage').projectDir}/local_repo" }`,
].join('\n');

const WORKLETS_MARKER = 'REACT_NATIVE_WORKLETS_NODE_MODULES_DIR';
const WORKLETS_LINE =
  'ext.REACT_NATIVE_WORKLETS_NODE_MODULES_DIR = project(":react-native-worklets").projectDir.parentFile.absolutePath';

const withAsyncStorageMavenRepo = (config) =>
  withProjectBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy') {
      throw new Error(
        'withAndroidNativeBuildFixes: expected a groovy android/build.gradle.'
      );
    }

    const contents = cfg.modResults.contents;
    if (contents.includes(REPO_MARKER)) {
      return cfg;
    }

    const anchor = "maven { url 'https://www.jitpack.io' }";
    if (!contents.includes(anchor)) {
      throw new Error(
        'withAndroidNativeBuildFixes: could not find the jitpack repositories anchor in android/build.gradle.'
      );
    }

    cfg.modResults.contents = contents.replace(
      anchor,
      `${anchor}\n${REPO_BLOCK}`
    );
    return cfg;
  });

const withReanimatedWorkletsDir = (config) =>
  withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy') {
      throw new Error(
        'withAndroidNativeBuildFixes: expected a groovy android/app/build.gradle.'
      );
    }

    const contents = cfg.modResults.contents;
    if (contents.includes(WORKLETS_MARKER)) {
      return cfg;
    }

    const anchor = 'apply plugin: "com.facebook.react"';
    if (!contents.includes(anchor)) {
      throw new Error(
        'withAndroidNativeBuildFixes: could not find the react plugin anchor in android/app/build.gradle.'
      );
    }

    cfg.modResults.contents = contents.replace(
      anchor,
      `${anchor}\n\n// Pin Reanimated's native worklets dependency to the worklets Gradle\n// project autolinking actually builds (pnpm otherwise splits them).\n${WORKLETS_LINE}`
    );
    return cfg;
  });

module.exports = (config) =>
  withReanimatedWorkletsDir(withAsyncStorageMavenRepo(config));
