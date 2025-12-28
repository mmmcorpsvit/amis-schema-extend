
import path from 'path';
import fs from 'fs-extra';
import { downloadSchema } from './download';
import { prepareAmisRepo } from './repo';
import { buildLocalSchema } from './build';
import { mergeSchemas } from './merge';
import { augmentSchema } from './augment';
import { validateFinalSchema } from './validate';

// Configuration
const VERSION = '6.13.0'; // Match with repo checkout
const RELEASE_SCHEMA_URL = `https://github.com/baidu/amis/releases/download/${VERSION}/schema.json`;
// Note: Some github releases use 'v' prefix, some don't. Adjust if 404.
// For baidu/amis, tags are usually vX.Y.Z, but example url said 6.13.0.
// We will try without 'v' first.

const WORK_DIR = process.cwd();
const AMIS_SRC_DIR = path.join(WORK_DIR, 'amis-src');
const DOWNLOAD_PATH = path.join(WORK_DIR, 'release-schema.json');
const OUTPUT_PATH = path.join(WORK_DIR, 'extended-schema.json');

async function main() {
    console.log('Starting AMIS Extended Schema Generator...');

    try {
        // 1. Download official schema
        let releaseSchema;
        try {
            releaseSchema = await downloadSchema(RELEASE_SCHEMA_URL, DOWNLOAD_PATH);
        } catch (e) {
            console.warn('Failed to download release schema, trying with "v" prefix...');
            const fallbackUrl = `https://github.com/baidu/amis/releases/download/v${VERSION}/schema.json`;
            releaseSchema = await downloadSchema(fallbackUrl, DOWNLOAD_PATH);
        }

        // 2. Prepare Repo and Build Local Schema
        // This requires git and npm. We attempt to build, but if it fails (common in complex environments),
        // we fall back to just using the release schema.
        let localSchema = {};
        try {
            await prepareAmisRepo(AMIS_SRC_DIR);
            localSchema = await buildLocalSchema(AMIS_SRC_DIR);
        } catch (e) {
            console.warn('WARNING: Failed to build local AMIS schema. Proceeding with Release Schema only.');
            console.warn('Constructing schema based only on official release.');
        }

        // 3. Merge
        // If localSchema is empty, mergeSchemas should handle it (overlaying nothing)
        const mergedSchema = Object.keys(localSchema).length ? mergeSchemas(releaseSchema, localSchema) : releaseSchema;

        // 4. Augment
        const finalSchema = augmentSchema(mergedSchema);

        // 5. Validate
        validateFinalSchema(finalSchema);

        // 6. Write Output
        await fs.outputJson(OUTPUT_PATH, finalSchema, { spaces: 2 });
        console.log(`\nSUCCESS! Extended schema saved to: ${OUTPUT_PATH}`);

        // Bonus: Summary
        const defCount = finalSchema.definitions ? Object.keys(finalSchema.definitions).length : 0;
        console.log('Summary:');
        console.log(`- Processed Components/Definitions: ${defCount}`);

    } catch (error) {
        console.error('\nFATAL ERROR:', error);
        process.exit(1);
    }
}

main();
