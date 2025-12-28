
import fs from 'fs-extra';
import path from 'path';
import _ from 'lodash';

const SCHEMA_PATH = path.join(process.cwd(), 'extended-schema.json');
const REPORT_PATH = path.join(process.cwd(), 'missing_fields_report.json');

interface ComponentScore {
    name: string;
    completeness: number; // 0-100
    missing: string[];
    propCount: number;
    nestedRefs: number;
    enumCount: number;
    defaultCount: number;
    eventCount: number;
}

export async function deepValidate() {
    console.log(`Loading schema from ${SCHEMA_PATH}...`);
    const schema = await fs.readJson(SCHEMA_PATH);
    const definitions = schema.definitions || {};

    const brokenRefs: string[] = [];
    const eventDefinitions = new Set<string>();
    const usedEvents = new Set<string>();

    // Helper to check Ref validity
    function checkRef(ref: any, ctx: string) {
        if (typeof ref !== 'string') return;
        if (!ref.startsWith('#/definitions/')) {
            // We only check internal refs for now
            return;
        }
        const defName = ref.replace('#/definitions/', '');
        if (!definitions[defName]) {
            brokenRefs.push(`${ctx} -> ${ref}`);
        }
    }

    // Helper to traverse iteratively
    function traverse(rootNode: any) {
        const stack = [{ node: rootNode, pathStr: 'root' }];

        while (stack.length > 0) {
            const { node, pathStr } = stack.pop()!;

            if (!node || typeof node !== 'object') continue;

            if (Array.isArray(node)) {
                for (let i = node.length - 1; i >= 0; i--) {
                    stack.push({ node: node[i], pathStr: `${pathStr}[${i}]` });
                }
                continue;
            }

            if (node.$ref) {
                checkRef(node.$ref, pathStr);
                // Event Usage Heuristic
                if (typeof node.$ref === 'string' && node.$ref.includes('Event')) {
                    usedEvents.add(node.$ref.replace('#/definitions/', ''));
                }
            }

            // Push children
            const keys = Object.keys(node);
            for (let i = keys.length - 1; i >= 0; i--) {
                const key = keys[i];
                if (key !== '$ref') {
                    stack.push({ node: node[key], pathStr: `${pathStr}.${key}` });
                }
            }
        }
    }

    // Identify Event Definitions
    Object.keys(definitions).forEach(key => {
        if (key.endsWith('Event') || key.includes('Action')) {
            eventDefinitions.add(key);
        }
    });

    console.log('Performing Integrity Check (Recursive Ref Validation)...');
    traverse(schema);

    console.log(`Found ${brokenRefs.length} broken references.`);
    if (brokenRefs.length > 0) {
        console.warn('Broken Refs Sample:', brokenRefs.slice(0, 5));
    }

    // Scoring
    const componentScores: ComponentScore[] = [];

    console.log('Calculating Completeness Scores...');
    for (const [name, def] of Object.entries<any>(definitions)) {
        if (typeof def !== 'object' || def === null) continue;

        let score = 0;
        const missing: string[] = [];
        let propCount = 0;
        let nestedRefs = 0;
        let enumCount = 0;
        let defaultCount = 0;
        let eventCount = 0;

        // Criteria 1: Type Info (+25)
        if (def.type || def.allOf || def.anyOf || def.oneOf || def.enum) {
            score += 25;
        } else {
            missing.push('Missing structural definition (type/allOf/anyOf/enum)');
        }

        // Criteria 2: Human Meta (+25)
        if (def.description || def.title) {
            score += 25;
        } else {
            // Check properties for descriptions??
            missing.push('Missing description/title');
        }

        // Criteria 3: Properties / Content (+25)
        if (def.properties || def.enum || (def.allOf && def.allOf.some((x: any) => x.properties))) {
            score += 25;

            const props = def.properties || {};
            propCount = Object.keys(props).length;

            Object.values(props).forEach((p: any) => {
                if (typeof p !== 'object') return;
                if (p.$ref) nestedRefs++;
                if (p.enum) enumCount++;
                if (p.default !== undefined) defaultCount++;
                if (p.description && p.description.includes('Expressions')) {
                    // expression field
                }
            });

        } else if (def.type === 'object') {
            missing.push('Object with no properties');
        }

        // Criteria 4: Augmentation (+25)
        // Check for defaults or expression hints or events
        let hasAugment = false;
        if (defaultCount > 0) hasAugment = true;
        // Check keys for 'onEvent'
        if (def.properties && def.properties.onEvent) {
            hasAugment = true;
            eventCount++;
        }

        if (hasAugment) {
            score += 25;
        } else {
            missing.push('No augmentation detected (defaults/events/hints)');
        }

        componentScores.push({
            name,
            completeness: score,
            missing,
            propCount,
            nestedRefs,
            enumCount,
            defaultCount,
            eventCount
        });
    }

    const unusedEventsList = Array.from(eventDefinitions).filter(e => !usedEvents.has(e));

    // Console Summary
    console.log('\n=== Deep Validation Summary ===');
    console.log(`Total Components: ${componentScores.length}`);
    console.log(`Broken References: ${brokenRefs.length}`);
    console.log(`Unused Event Definitions: ${unusedEventsList.length} (of ${eventDefinitions.size})`);

    const perfectComponents = componentScores.filter(s => s.completeness === 100);
    console.log(`Perfect Score Components (100%): ${perfectComponents.length}`);

    console.log(`\nAverage Properties per Component: ${(_.meanBy(componentScores, 'propCount') || 0).toFixed(1)}`);

    // Save Report
    const report = {
        brokenReferences: brokenRefs,
        unusedEvents: unusedEventsList,
        incompleteComponents: componentScores.filter(s => s.completeness < 75).map(s => ({
            name: s.name,
            score: s.completeness,
            missing: s.missing
        })),
        allScores: componentScores
    };

    await fs.outputJson(REPORT_PATH, report, { spaces: 2 });
    console.log(`Detailed deep validation report saved to ${REPORT_PATH}`);
}

deepValidate();
