import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
const lockPath = resolve(root, 'package-lock.json');
const outputPath = resolve(root, 'THIRD_PARTY_LICENSES.json');
const lock = JSON.parse(await readFile(lockPath, 'utf8'));
const rootPackage = lock.packages?.[''] ?? {};
const productionDependencies = new Set(Object.keys(rootPackage.dependencies ?? {}));
const developmentDependencies = new Set(Object.keys(rootPackage.devDependencies ?? {}));

function dependencyKind(name) {
  if (productionDependencies.has(name)) return 'direct-production';
  if (developmentDependencies.has(name)) return 'direct-development';
  return 'transitive';
}

function packageNameFromLocation(location) {
  const prefix = 'node_modules/';
  const lastPackageLocation = location.slice(location.lastIndexOf(prefix) + prefix.length);
  return lastPackageLocation;
}

const packageEntries = Object.entries(lock.packages ?? {})
  .filter(([location]) => location.startsWith('node_modules/'))
  .map(([location, packageData]) => {
    const name = packageData.name ?? packageNameFromLocation(location);
    return {
      name,
      version: packageData.version ?? 'UNRESOLVED',
      license: packageData.license ?? 'UNSPECIFIED',
      dependencyKind: dependencyKind(name),
    };
  })
  .sort((left, right) => left.name.localeCompare(right.name) || left.version.localeCompare(right.version));

const inventory = {
  format: 'bible-map-license-inventory/v1',
  lockfileVersion: lock.lockfileVersion,
  packageCount: packageEntries.length,
  packages: packageEntries,
};

await writeFile(outputPath, `${JSON.stringify(inventory, null, 2)}\n`);
