
import fs from 'fs-extra';
import path from 'path';
import Ajv from 'ajv';
import _ from 'lodash';

const SCHEMA_PATH = path.join(process.cwd(), 'extended-schema.json');
const REPORT_PATH = path.join(process.cwd(), 'validation-report.json');

interface ComponentStats {
    name: string;
    propCount: number;
    nestedCount: number;
    enumCount: number;
    defaultCount: number;
    eventCount: number;
    expressionFields: number;
    descCount: number;
    issues: string[];
}

export async function validateCompleteness() {
    console.log(`Loading schema from ${SCHEMA_PATH}...`);
    try {
        const schema = await fs.readJson(SCHEMA_PATH);

        // 1. Basic Draft-07 Validation
        console.log('Validating JSON Schema Draft-07 compliance...');
        const ajv = new Ajv({ strict: false, allErrors: true });
        if (!ajv.validateSchema(schema)) {
            console.error('Schema is NOT valid Draft-07!');
            // We continue anyway to analyze contents
        } else {
            console.log('Schema is valid Draft-07.');
        }

        const definitions = schema.definitions || {};
        const stats: ComponentStats[] = [];

        console.log(`Analyzing ${Object.keys(definitions).length} definitions...`);

        for (const [defName, def] of Object.entries<any>(definitions)) {
            if (typeof def !== 'object' || def === null) continue;

            const stat: ComponentStats = {
                name: defName,
                propCount: 0,
                nestedCount: 0,
                enumCount: 0,
                defaultCount: 0,
                eventCount: 0,
                expressionFields: 0,
                descCount: 0,
                issues: []
            };

            // Check Properties
            const props = def.properties || {};
            stat.propCount = Object.keys(props).length;

            if (stat.propCount === 0 && !def.allOf && !def.anyOf && !def.oneOf && !def.$ref && def.type === 'object') {
                stat.issues.push('No properties defined for object type');
            }

            for (const [propName, propSchema] of Object.entries<any>(props)) {
                if (typeof propSchema !== 'object') continue;

                // Nested
                if (propSchema.$ref || (propSchema.type === 'object' && propSchema.properties)) {
                    stat.nestedCount++;
                }

                // Enums
                if (propSchema.enum) {
                    stat.enumCount++;
                }

                // Defaults
                if (propSchema.default !== undefined) {
                    stat.defaultCount++;
                }

                // Events (heuristic: starts with on[A-Z])
                if (propName.startsWith('on') && propName.length > 2 && /[A-Z]/.test(propName[2])) {
                    stat.eventCount++;
                }

                // Description
                if (propSchema.description) {
                    stat.descCount++;
                    if (propSchema.description.includes('(Supports Expressions)')) {
                        stat.expressionFields++;
                    }
                }
            }

            stats.push(stat);
        }

        // Summary
        const totalComponents = stats.length;
        const totalProps = _.sumBy(stats, 'propCount');
        const totalEnums = _.sumBy(stats, 'enumCount');
        const totalDefaults = _.sumBy(stats, 'defaultCount');
        const totalExpressions = _.sumBy(stats, 'expressionFields');
        const componentsWithIssues = stats.filter(s => s.issues.length > 0).length;

        console.log('\n=== Completeness Summary ===');
        console.log(`Total Components: ${totalComponents}`);
        console.log(`Total Properties: ${totalProps}`);
        console.log(`Total Enums: ${totalEnums}`);
        console.log(`Total Defaults: ${totalDefaults}`);
        console.log(`Expression Hints Detected: ${totalExpressions}`);
        console.log(`Components with potential issues: ${componentsWithIssues}`);
        console.log('============================\n');

        // Suggest key components to check
        const topEmpty = stats
            .filter(s => s.propCount === 0 && !s.issues.length) // ignore known issues
            .slice(0, 5)
            .map(s => s.name);

        if (topEmpty.length > 0) {
            console.log('Sample of components with 0 visible properties (might use allOf/anyOf):');
            console.log(topEmpty.join(', '));
        }

        // Save Report
        await fs.outputJson(REPORT_PATH, stats, { spaces: 2 });
        console.log(`\nDetailed report saved to ${REPORT_PATH}`);

    } catch (e) {
        console.error('Validation failed:', e);
    }
}

// Allow direct execution
if (require.main === module) {
    validateCompleteness();
}
