
import _ from 'lodash';

// Example metadata to inject
const EXTRA_DEFAULTS: Record<string, any> = {
    // 'Tpl': { className: 'my-tpl-class' }
};

const EXPRESSION_FIELDS = ['visibleOn', 'disabledOn', 'hiddenOn', 'className'];

export function augmentSchema(schema: any): any {
    console.log('Augmenting schema with metadata and types...');

    if (!schema.definitions) {
        console.warn('No definitions found in schema, skipping augmentation of definitions.');
        return schema;
    }

    // 1. Iterate over definitions to inject defaults and hints
    for (const [defName, def] of Object.entries<any>(schema.definitions)) {
        if (typeof def !== 'object' || def === null) continue;

        // Inject Defaults
        if (EXTRA_DEFAULTS[defName] && def.properties) {
            for (const [prop, value] of Object.entries(EXTRA_DEFAULTS[defName])) {
                const propSchema = def.properties[prop];
                if (propSchema && typeof propSchema === 'object') {
                    propSchema.default = value;
                }
            }
        }

        // 2. Expression Fields (hints)
        if (def.properties) {
            for (const field of EXPRESSION_FIELDS) {
                const fieldSchema = def.properties[field];
                if (fieldSchema && typeof fieldSchema === 'object') {
                    fieldSchema.description = (fieldSchema.description || '') + ' (Supports Expressions)';
                    // We could also allow it to be a specific string pattern if we wanted
                }
            }
        }

        // 3. Editor hints (simple example: auto-generate title if missing)
        if (!def.title) {
            def.title = defName;
        }
    }

    // 4. Add Event Payloads (Placeholder implementation)
    // To do this properly we'd need a map of component -> events.
    // Here we define a generic Event structure if not present.
    if (!schema.definitions['Event']) {
        schema.definitions['Event'] = {
            type: 'object',
            properties: {
                actionType: { type: 'string', description: 'Action Type' },
                args: { type: 'object', description: 'Action Arguments' }
            }
        };
    }

    // Augment 'Action' or 'Renderer' if possible to include typed events
    // This is complex and schema-dependent. 
    // We will ensure `onEvent` is defined in base renderer (often 'SchemaMessage' or similar).

    console.log('Augmentation complete.');
    return schema;
}
