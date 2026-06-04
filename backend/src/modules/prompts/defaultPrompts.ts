import { AGENT_LABELS, AGENT_PROMPTS } from '../../agents/prompts';
import type { AgentType } from '../../types';

/**
 * Default review prompts seeded for a user (idempotently, by label).
 *
 * These used to be hardcoded directly into the agent prompts. They now live here
 * as seed data so the content is data-driven: users can view, edit, toggle, or
 * delete them from Settings → Prompts. Enabled prompts are injected into every
 * review's instructions.
 */
export interface DefaultPromptSeed {
  label: string;
  content: string;
  enabled: boolean;
}

const FEATURE_DEVELOPMENT_CONVENTIONS = `
FEATURE DEVELOPMENT CONVENTIONS (MANDATORY — enforce on every new feature or
feature change; for each violation raise a comment that names the exact file
path / constant / hook / type to use, and list any missing scaffold piece as a
top-priority fix):

A. FOLDER STRUCTURE — every feature MUST follow this exact scaffold:
   src/features/<module>/pages/<feature>/
     - index.tsx                       // main page export
     - layout.tsx                       // layout with tabs / navigation
     - components/
         - index.ts                   // barrel exports
         - <feature>.tsx              // main page component (PascalCase export)
         - single-<feature>-form.tsx  // single form
         - bulk-<feature>-form.tsx     // bulk form (only if bulk supported)
         - response-display.tsx       // response display component
         - types.ts                   // TypeScript types / interfaces
     - constants/
         - index.ts                   // barrel exports
         - constants.ts               // FEATURE_INFO, TABS, SECTIONS, *_FORM, messages, RESPONSE_STATES
         - styles.ts                  // all Tailwind class strings
   Plus, outside the feature folder:
     - src/lib/redux/api/<module>/<feature>-api.ts        (RTK Query slice)
     - src/lib/redux/api/config/endpoints.ts              (add endpoint constants)
     - src/routes/_authenticated/<module>/<feature>.tsx   (route w/ protection)
     - src/components/route-protection.tsx                (add the RBAC component)
   Flag any deviation (missing file/folder, misplaced file, types declared inline
   instead of in components/types.ts, components outside components/, constants or
   styles not split out) and tell the author exactly where each file must move.

B. RBAC & ROUTE PROTECTION (MANDATORY):
   - Every new route under /_authenticated/** MUST be wrapped in a route
     protection component named {Module}{Feature}RouteProtection.
   - It MUST declare the Required Module (mg_* permission) and Required Feature
     (m_* permission) and gate access via the usePermissions hook.
   - Flag any authenticated route added WITHOUT a protection wrapper, or with
     missing/placeholder module/feature permission keys.

C. ROUTING:
   - Route path MUST be /_authenticated/<module>/<feature> with the file at
     routes/_authenticated/<module>/<feature>.tsx (kebab-case).
   - If the page uses tabs, each tab MUST define id, value, label, path, and icon.

D. REDUX RTK QUERY API (MANDATORY):
   - One slice per feature at lib/redux/api/<module>/<feature>-api.ts.
   - Slice/reducerPath named <feature>Api; tagTypes ['<Feature>'].
   - Endpoint URLs MUST be read from the ENDPOINTS object in endpoints.ts —
     flag any hardcoded URL string in the slice or component.
   - Mutations exported as use<Mutation>Mutation hooks; bulk operations are a
     SEPARATE mutation/hook.
   - Flag any direct fetch()/axios call in a component — data access MUST go
     through the generated RTK Query hooks.

E. FORMS & VALIDATION (MANDATORY):
   - Forms use react-hook-form with zodResolver.
   - Every field has a Zod rule with min/max and/or regex AND an explicit error
     message; required fields are marked with a red asterisk.
   - ALL regex MUST be imported from the shared regex-patterns.ts — flag any
     inline regex literal or new RegExp() and name the export it should become.
   - Submit button is disabled while invalid and shows a processing state;
     reset clears values AND validation errors.
   - Bulk form: FormData with a CSV file (accept .csv, text/csv; max 10MB) and a
     "Download Sample" button pointing at /<feature>-sample.csv.

F. CONSTANTS / STYLES / TYPES HYGIENE (MANDATORY):
   - All copy, labels, messages, magic numbers, URLs MUST live in
     constants/constants.ts. Flag hardcoded strings/numbers.
   - All Tailwind class strings MUST live in constants/styles.ts — flag inline
     className utilities and give the constant name + path to move them to.
   - All interfaces/types MUST live in components/types.ts and be imported —
     never redeclared inline, and no any / implicit any.

G. NAMING CONVENTIONS:
   - Files: kebab-case; API files: <feature>-api.ts; route files: kebab-case.
   - Components: PascalCase; forms Single{Feature}Form / Bulk{Feature}Form;
     display {Feature}ResponseDisplay; protection {Module}{Feature}RouteProtection.
   - Constants: UPPER_SNAKE_CASE objects with camelCase keys. Variables/functions
     camelCase; booleans use is/has/should prefixes. Slice <feature>Api; hooks
     use<Feature>Mutation.

H. RESPONSE / UX STATES:
   - The response-display component MUST handle all four states: IDLE, LOADING,
     SUCCESS, ERROR, and provide a "Try Again" reset.
   - Use toast notifications (success: brief; error: API message); auto-scroll to
     the response after submission.
`.trim();

/**
 * The built-in agent system prompts, exposed as managed prompts too.
 *
 * They are seeded DISABLED: every agent already runs its own system prompt, so
 * enabling these would only duplicate that text inside the custom instructions.
 * They are here so users can read, copy, tweak, or re-enable them from the UI.
 */
const AGENT_PROMPT_SEEDS: DefaultPromptSeed[] = (
  Object.entries(AGENT_PROMPTS) as [AgentType, string][]
).map(([type, content]) => ({
  label: `${AGENT_LABELS[type]} Agent`,
  content,
  enabled: false,
}));

export const DEFAULT_PROMPT_SEEDS: DefaultPromptSeed[] = [
  {
    label: 'Feature Development Conventions',
    content: FEATURE_DEVELOPMENT_CONVENTIONS,
    enabled: true,
  },
  ...AGENT_PROMPT_SEEDS,
];
