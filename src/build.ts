
import execa from 'execa';
import path from 'path';
import fs from 'fs-extra';

export async function buildLocalSchema(repoDir: string): Promise<any> {
    console.log('Building local AMIS schema...');

    // We need to ensure dependencies in packages/amis are installed
    const packageDir = path.join(repoDir, 'packages/amis');
    const scriptsDir = path.join(repoDir, 'scripts');
    const buildScript = path.join(scriptsDir, 'build-schemas.ts');

    console.log(`Installing dependencies in ${packageDir}...`);
    try {
        await execa('npm', ['install', '--legacy-peer-deps'], {
            cwd: packageDir,
            stdio: 'inherit'
        });
    } catch (e) {
        console.warn('npm install in packages/amis failed, continuing...');
    }

    console.log('Running build-schemas.ts using npx ts-node...');
    // We run it from packageDir so relative paths in the script (like ../packages/...) work if they rely on CWD being package? 
    // Wait, the script at lines 40-41 uses __dirname, so CWD matters less for paths, but maybe for node_modules resolution.
    // The script is in scripts/. 
    // Dependencies (ts-json-schema-generator) are in packages/amis/node_modules.
    // So running from packages/amis is correct.

    try {
        // Using array arguments avoids shell quoting issues on Windows
        // Equivalent to: ts-node -O '{"target":"es6"}' ../../scripts/build-schemas.ts
        await execa('npx', [
            'ts-node',
            '-O', '{"target":"es6"}',
            // We need to point to the script. relative to packageDir (packages/amis) it is ../../scripts/build-schemas.ts
            '../../scripts/build-schemas.ts'
        ], {
            cwd: packageDir,
            stdio: 'inherit',
            env: { ...process.env, FORCE_COLOR: 'true' }
        });
    } catch (e) {
        console.error('Error running ts-node build-schemas.ts. Detailed error above.');
        throw e;
    }

    // After build, locating the schema.
    const possiblePaths = [
        path.join(packageDir, 'schema.json'), // packages/amis/schema.json
        path.join(repoDir, 'schema.json')
    ];

    for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
            console.log(`Found built schema at ${p}`);
            return fs.readJson(p);
        }
    }

    throw new Error('Could not find built schema.json in common locations after build.');
}
