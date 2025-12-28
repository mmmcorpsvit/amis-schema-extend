
import _ from 'lodash';

export function mergeSchemas(releaseSchema: any, localSchema: any): any {
    console.log('Merging release schema and local schema...');

    // We start with releaseSchema and overlay localSchema
    // Be careful with arrays. merging arrays by index is often wrong for schemas (e.g. required fields list).
    // validation keywords: oneOf, anyOf, allOf are arrays.

    function customizer(objValue: any, srcValue: any, key: string) {
        if (_.isArray(objValue)) {
            // For 'required', 'enum', 'oneOf', 'anyOf' we probably want to UNION or Replace, not merge by index.
            // For now, let's Replace if different, or Union for 'required'.
            if (key === 'required') {
                return _.uniq([...objValue, ...srcValue]);
            }
            // For complex arrays like oneOf, replacing is safer than merging indices
            return srcValue;
        }
    }

    const merged = _.mergeWith({}, releaseSchema, localSchema, customizer);
    return merged;
}
