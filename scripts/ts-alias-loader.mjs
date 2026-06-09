import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';

const root = process.cwd();

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) {
    const target = path.join(root, 'src', specifier.slice(2));
    return nextResolve(pathToFileURL(`${target}.ts`).href, context);
  }
  if ((specifier.startsWith('./') || specifier.startsWith('../')) && context.parentURL?.startsWith('file:')) {
    const parentDir = path.dirname(fileURLToPath(context.parentURL));
    const target = path.resolve(parentDir, specifier);
    if (!path.extname(target)) {
      return nextResolve(pathToFileURL(`${target}.ts`).href, context);
    }
  }
  return nextResolve(specifier, context);
}
