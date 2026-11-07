// Imports the stripped game modules for the unit tests (built by run.mjs).
export const game = (p) => import(`./.run/src/${p}.js`);
