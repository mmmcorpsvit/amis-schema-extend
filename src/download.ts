
import axios from 'axios';
import fs from 'fs-extra';
import path from 'path';

export async function downloadSchema(url: string, destPath: string): Promise<any> {
    console.log(`Downloading schema from ${url}...`);
    try {
        const response = await axios.get(url, { responseType: 'json' });
        const schema = response.data;
        await fs.outputJson(destPath, schema, { spaces: 2 });
        console.log(`Schema downloaded to ${destPath}`);
        return schema;
    } catch (error) {
        console.error(`Failed to download schema: ${error}`);
        throw error;
    }
}
