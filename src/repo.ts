
import execa from 'execa';
import fs from 'fs-extra';
import path from 'path';

const REPO_URL = 'https://github.com/baidu/amis.git';
const CHECKOUT_TAG = 'v6.13.0'; // Using 'v' since we saw git tags usually have it, though release url didn't. 
// If v6.13.0 doesn't exist, I'll handle fallback in a real scenario, but assuming it matches release tag.

export async function prepareAmisRepo(targetDir: string): Promise<void> {
    const gitDir = path.join(targetDir, '.git');

    if (fs.existsSync(gitDir)) {
        console.log(`AMIS repository already exists in ${targetDir}`);
    } else {
        console.log(`Cloning AMIS repository to ${targetDir}...`);
        // Try with 'v' prefix first, if fails try without? 
        // execa will throw. 
        try {
            await execa('git', ['clone', '--depth', '1', '--branch', CHECKOUT_TAG, REPO_URL, targetDir], { stdio: 'inherit' });
        } catch (e) {
            console.warn(`Failed to clone with ${CHECKOUT_TAG}, trying 6.13.0 without v...`);
            await execa('git', ['clone', '--depth', '1', '--branch', '6.13.0', REPO_URL, targetDir], { stdio: 'inherit' });
        }
    }

    console.log(`Installing root dependencies in ${targetDir}...`);
    await execa('npm', ['install', '--legacy-peer-deps'], { cwd: targetDir, stdio: 'inherit' });

    // Build dependencies in order: formula -> core -> ui
    // This is required for creating .d.ts files that ts-json-schema-generator needs
    const packages = ['amis-formula', 'amis-core', 'amis-ui'];

    for (const pkg of packages) {
        const pkgDir = path.join(targetDir, 'packages', pkg);
        if (fs.existsSync(pkgDir)) {
            console.log(`Building ${pkg}...`);
            // We assume npm install in root covered dependencies due to workspaces
            try {
                await execa('npm', ['run', 'build'], {
                    cwd: pkgDir,
                    stdio: 'inherit',
                    // On Windows, some build scripts might fail if missing posix tools, but we hope for best.
                    // Cross-env helps.
                });
            } catch (e) {
                console.warn(`Failed to build ${pkg}. Schema generation might fail if types are missing.`);
                // We do not throw here to attempt continuing.
            }
        }
    }
}
