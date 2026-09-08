// Resolve the web project's existing TS aliases for standalone Node tests/benchmarks.
// Production Next.js resolution is unchanged.
import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const source=path.resolve(import.meta.dirname,'../src');
registerHooks({resolve(specifier,context,nextResolve){
  if(specifier.startsWith('@/')) {
    const base=path.join(source,specifier.slice(2));
    for(const file of [base,base+'.ts',base+'.mjs',base+'.js',path.join(base,'index.ts')]) {
      if(existsSync(file)) return nextResolve(pathToFileURL(file).href,context);
    }
  }
  if(['next/headers','next/server','next/cache'].includes(specifier)) return nextResolve(specifier+'.js',context);
  return nextResolve(specifier,context);
}});
