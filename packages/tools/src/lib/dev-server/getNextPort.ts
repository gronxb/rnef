import { isDevServerRunning } from './isDevServerRunning.js';

type Result = {
  start: boolean;
  nextPort: number;
};

/**
 * Increases by one the port number until it finds an available port.
 * @param port Port number to start with.
 * @param root Root of the project.
 */

const getNextPort = async (port: number, root: string): Promise<Result> => {
  const nextPort = port + 1;
  let start = true;

  const result = await isDevServerRunning(nextPort);
  const isRunning = result.status === 'running';

  if (isRunning && result.root === root) {
    // Found running bundler for this project, so we do not need to start dev server!
    start = false;
  } else if (isRunning || result.status === 'unrecognized') {
    return getNextPort(nextPort, root);
  }

  return { start, nextPort };
};

export default getNextPort;
