import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { getLocalOS } from './env.js';
import { RnefError } from './error.js';
import { getProjectRoot } from './project.js';
import type { SubprocessError } from './spawn.js';
import { spawn } from './spawn.js';

function getReactNativePackagePath() {
  const require = createRequire(import.meta.url);
  const root = getProjectRoot();
  const input = require.resolve('react-native', { paths: [root] });
  return path.dirname(input);
}

function getComposeSourceMapsPath(): string | null {
  const rnPackagePath = getReactNativePackagePath();
  const composeSourceMaps = path.join(
    rnPackagePath,
    "scripts",
    "compose-source-maps.js",
  );
  return fs.existsSync(composeSourceMaps) ? composeSourceMaps : null;
}


export async function runHermes({
  bundleOutputPath,
  sourcemapOutputPath,
}: {
  bundleOutputPath: string;
  sourcemapOutputPath?: string;
}) {
  const hermescPath = getHermescPath();
  if (!hermescPath) {
    throw new RnefError(
      'Hermesc binary not found. Use `--no-hermes` flag to disable Hermes.'
    );
  }
  
  const hermescArgs = [
    '-emit-binary',
    '-max-diagnostic-width=80',
    '-O',
    '-w',
    '-out',
    bundleOutputPath, // Needs `-out` path, or otherwise outputs to stdout
    bundleOutputPath,
    ...(sourcemapOutputPath ? ['-emit-sourcemap', sourcemapOutputPath] : []),
  ];
  try {
    await spawn(hermescPath, hermescArgs);
  } catch (error) {
    throw new RnefError(
      'Compiling JS bundle with Hermes failed. Use `--no-hermes` flag to disable Hermes.',
      { cause: (error as SubprocessError).stderr }
    );
  }

  // Compose source maps if provided
  if (sourcemapOutputPath) {
    const hermesSourceMapFile = [path.basename(sourcemapOutputPath, '.map'), '.hbc.map'].join('');
    const composeSourceMapsPath = getComposeSourceMapsPath();

    if (!composeSourceMapsPath) {
      throw new Error(
        "Could not find react-native's compose-source-maps.js script.",
      );
    }
  
    try {
      await spawn("node", [
        composeSourceMapsPath,
        sourcemapOutputPath,
        hermesSourceMapFile,
        "-o",
        hermesSourceMapFile,
      ]);
    } catch (error) {
      throw new RnefError(
        'Composing source maps with Hermes failed.',
        { cause: (error as SubprocessError).stderr }
      );
    }    
  }
}

/**
 * Get `hermesc` binary path.
 * Based on: https://github.com/facebook/react-native/blob/f2c78af56ae492f49b90d0af61ca9bf4d124fca0/packages/gradle-plugin/react-native-gradle-plugin/src/main/kotlin/com/facebook/react/utils/PathUtils.kt#L48-L55
 */
function getHermescPath() {
  const reactNativePath = getReactNativePackagePath();

  // Local build from source: node_modules/react-native/sdks/hermes/build/bin/hermesc
  const localBuildPath = path.join(
    reactNativePath,
    'sdks/hermes/build/bin/hermesc'
  );
  if (fs.existsSync(localBuildPath)) {
    return localBuildPath;
  }

  // Precompiled binaries: node_modules/react-native/sdks/hermesc/%OS-BIN%/hermesc
  const prebuildPaths = {
    macos: `${reactNativePath}/sdks/hermesc/osx-bin/hermesc`,
    linux: `${reactNativePath}/sdks/hermesc/linux64-bin/hermesc`,
    windows: `${reactNativePath}/sdks/hermesc/win64-bin/hermesc.exe`,
  };

  const os = getLocalOS();
  return prebuildPaths[os];
}
