
import fs from 'fs-extra';
import path from 'path';
import _ from 'lodash';

const SCHEMA_PATH = path.join(process.cwd(), 'extended-schema.json');
const REPORT_PATH = path.join(process.cwd(), 'component-report.json');

// Mapping friendly names to schema definition names if known variations exist
const COMPONENT_MAP: Record<string, string[]> = {
    'Button': ['Action', 'Button', 'ActionSchema'],
    'Form': ['Form', 'FormSchema'],
    'CRUD': ['CRUD', 'CRUDSchema', 'CRUDCommon'],
    'Dialog': ['Dialog', 'DialogSchema', 'DialogAction'],
    'Table': ['Table', 'TableSchema']
};

interface VerificationResult {
    component: string;
    resolvedDefinition: string | null;
    propCount: number;
    nestedRefs: number;
    enumCount: number;
    eventCount: number;
    defaultCount: number;
    expressionFields: number;
    warnings: string[];
    completenessScore: number;
}

export async function verifyComponents(targetComponents: string[]) {
    console.log(`Loading schema from ${SCHEMA_PATH}...`);
    const schema = await fs.readJson(SCHEMA_PATH);
    const definitions = schema.definitions || {};

    const results: VerificationResult[] = [];

    for (const target of targetComponents) {
        let bestMatch: string | null = null;

        // 1. Resolve Definition
        const candidates = COMPONENT_MAP[target] || [target];
        for (const c of candidates) {
            if (definitions[c]) {
                bestMatch = c;
                break;
            }
        }

        // Fuzzy search if not found
        if (!bestMatch) {
            const keys = Object.keys(definitions);
            bestMatch = keys.find(k => k.toLowerCase() === target.toLowerCase() || k.toLowerCase() === target.toLowerCase() + 'schema') || null;
        }

        const result: VerificationResult = {
            component: target,
            resolvedDefinition: bestMatch,
            propCount: 0,
            nestedRefs: 0,
            enumCount: 0,
            eventCount: 0,
            defaultCount: 0,
            expressionFields: 0,
            warnings: [],
            completenessScore: 0
        };

        if (!bestMatch) {
            result.warnings.push('Definition not found in schema');
            results.push(result);
            continue;
        }

        const def = definitions[bestMatch];

        // 2. Props Check
        if (def.properties) {
            result.propCount = Object.keys(def.properties).length;

            for (const [key, prop] of Object.entries<any>(def.properties)) {
                if (typeof prop !== 'object') continue;

                // Nested
                if (prop.$ref || (prop.items && prop.items.$ref)) {
                    result.nestedRefs++;
                    // Check validity
                    const ref = prop.$ref || prop.items.$ref;
                    if (ref && ref.startsWith('#/definitions/')) {
                        const refName = ref.replace('#/definitions/', '');
                        if (!definitions[refName]) {
                            result.warnings.push(`Broken ref in prop '${key}': ${ref}`);
                        }
                    }
                }

                // Enums
                if (prop.enum) {
                    result.enumCount++;
                    if (prop.enum.length === 0) {
                        result.warnings.push(`Empty enum in prop '${key}'`);
                    }
                }

                // Defaults
                if (prop.default !== undefined) {
                    result.defaultCount++;
                }

                // Events
                if (key.startsWith('on') && key.length > 2 && /[A-Z]/.test(key[2])) {
                    result.eventCount++;
                }
                if (key === 'onEvent' && prop.type === 'object') {
                    // Check if it references event definitions?
                    result.eventCount++;
                }

                // Expressions
                if (key === 'visibleOn' || key === 'disabledOn') {
                    result.expressionFields++;
                    if (!prop.description || !prop.description.includes('Expressions')) {
                        result.warnings.push(`Expression field '${key}' missing hint`);
                    }
                }
            }

            // Check specifically for visibleOn/disabledOn
            if (!def.properties.visibleOn) result.warnings.push('Missing visibleOn');
            if (!def.properties.disabledOn) result.warnings.push('Missing disabledOn');

        } else if (def.allOf) {
            // Very simple handling for allOf, assuming first is base ref or properties
            result.warnings.push('Component uses allOf, shallow check only');
            const hasProps = def.allOf.some((x: any) => x.properties);
            if (hasProps) result.propCount = -1; // Indeterminate without flatten
        }

        // Scoring
        // Base 100, deduct for missing essentials
        let score = 100;
        if (result.propCount === 0 && !def.allOf) score -= 50;
        if (result.expressionFields < 2 && result.propCount > 0) score -= 10;
        if (result.warnings.length > 0) score -= (5 * result.warnings.length);

        result.completenessScore = Math.max(0, score);
        results.push(result);
    }

    // Output
    console.log('\n=== Targeted Component Verification ===');
    results.forEach(r => {
        console.log(`\nComponent: ${r.component}`);
        console.log(`  Resolved: ${r.resolvedDefinition || 'NOT FOUND'}`);
        if (r.resolvedDefinition) {
            console.log(`  Props: ${r.propCount}`);
            console.log(`  Events: ${r.eventCount}`);
            console.log(`  Enums: ${r.enumCount}`);
            console.log(`  Completeness: ${r.completenessScore}%`);
            if (r.warnings.length > 0) {
                console.log('  Warnings:');
                r.warnings.forEach(w => console.log(`    - ${w}`));
            }
        }
    });

    await fs.outputJson(REPORT_PATH, results, { spaces: 2 });
    console.log(`\nDetailed component report saved to ${REPORT_PATH}`);
}

// CLI args
const args = process.argv.slice(2);
const targets = args.length > 0 ? args : ['Button', 'Form', 'CRUD', 'Dialog'];

if (require.main === module) {
    verifyComponents(targets);
}
