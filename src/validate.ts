
import Ajv from 'ajv';

export function validateFinalSchema(schema: any): boolean {
    console.log('Validating generated JSON Schema...');
    // using strict: false to allow unknown keywords which might be present in huge schemas
    // or specifically standard draft-07
    const ajv = new Ajv({ strict: false, allErrors: true });

    // Some schemas use 'draft-07' meta-schema.
    // Ajv v8 supports draft-07 by default or via extra package. 
    // Usually default is 2020-12 in v8? No, v8 corresponds to 2019/2020. 
    // But basic JSON schema structure is compatible.

    try {
        ajv.compile(schema);
        console.log('Schema is VALID.');
        return true;
    } catch (e) {
        console.error('Schema validation FAILED:', e);
        return false;
    }
}
