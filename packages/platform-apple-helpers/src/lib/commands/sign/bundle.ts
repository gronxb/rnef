import fs from 'node:fs';
import type {
  SubprocessError} from '@rnef/tools';
import {
  logger,
  RnefError,
  runHermes,
  spawn
} from '@rnef/tools';

type BuildJsBundleOptions = {
  bundleOutputPath: string;
  assetsDestPath: string;
  sourcemapOutputPath?: string;
  useHermes?: boolean;
};

/**
 * This function is modelled after [react-native-xcode.sh](https://github.com/facebook/react-native/blob/main/packages/react-native/scripts/react-native-xcode.sh).
 */
export async function buildJsBundle(options: BuildJsBundleOptions) {
  if (fs.existsSync(options.bundleOutputPath)) {
    fs.unlinkSync(options.bundleOutputPath);
    logger.debug('Removed existing JS bundle:', options.bundleOutputPath);
  }

  // Reasonable defaults
  // If user wants to build bundle differently, they should use `rnef bundle` command directly
  // and provide the JS bundle path to `--jsbundle` flag
  const rnefBundleArgs = [
    'bundle',
    `--entry-file`,
    `index.js`,
    '--platform',
    'ios',
    `--dev`,
    'false',
    '--minify',
    'false',
    '--reset-cache',
    '--bundle-output',
    options.bundleOutputPath,
    '--assets-dest',
    options.assetsDestPath,
  ];
  try {
    await spawn('rnef', rnefBundleArgs, { preferLocal: true });
  } catch (error) {
    throw new RnefError('Failed to build JS bundle', {
      cause: (error as SubprocessError).stderr,
    });
  }

  if (!options.useHermes) {
    return;
  }

  await runHermes({
    bundleOutputPath: options.bundleOutputPath,
    sourcemapOutputPath: options.sourcemapOutputPath,
  });
}
