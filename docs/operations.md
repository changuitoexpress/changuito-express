# Replit, GitHub and Vercel operations

## Runtime boundaries

| Environment | Entry point | Port / routing |
| --- | --- | --- |
| Replit development | `npm run dev` | Vite 5173, external 80; development API middleware |
| Build preview | `npm run build && npm run preview` | Vite 5174, external 3001; frontend only |
| Vercel production | Built `dist` frontend and root `api/` handlers | Managed HTTPS; no manually assigned Vite port |
| GitHub | Source repository and deployment statuses | HTTPS API/Git, not an application listener |

The `.replit` mapping for 5175 is an additional reserved mapping, not proof
that a process listens on that port. Do not start duplicate development
workflows. `strictPort` prevents a busy port from silently moving the app.

Use relative `/api/...` URLs in application code. Vite preview does not mount
the development API middleware; it is not an end-to-end production server.

## Reusable instructions

Existing Replit-provided skills are managed by the platform. Reference them
rather than copying their entire contents into the repository:

| Skill | When to use |
| --- | --- |
| `workflows` | Configure/start the existing development workflow and inspect ports |
| `deployment` | Deployment metadata and publishing configuration |
| `integrations` | Resolve actual connector readiness and authorization |
| `query-integration-data` | Authenticated GitHub/Vercel API operations |
| `environment-secrets` | Secret existence checks and secure input; never print values |
| `skill-authoring` | Package reusable procedures and propose saving to the skill library |

Their current instructions live under `.local/skills/<name>/SKILL.md`.
The project-owned procedure is
[`hosting-integration-audit`](../.agents/skills/hosting-integration-audit/SKILL.md).
Saving that procedure to a cross-project library requires approval of the
skill-saving card; a repository file alone does not install it elsewhere.

## Verification boundaries

- GitHub access does not establish access to the correct Vercel project.
- A successful GitHub deployment status applies to its exact commit; it
  does not prove the workspace or pending changes have been published.
- Confirm the Vercel project's linked repository and production branch
  before checking or changing its environment variables.
- Inspect variable names and target environments only; never decrypt or
  display their values. Replit secrets do not establish Vercel configuration.
- A missing connector permission is not a port problem.
- Keep payment and messaging tokens, service-role credentials and webhook
  signing secrets on the server, without `VITE_` prefixes.
- Check builds using `npm run check`. This does not prove a live payment,
  incoming WhatsApp webhook, outbound delivery or authenticated UI works.

## WhatsApp CRM

The CRM is independent from `mensajes_chat` and app orders. It has its own
phone-based contacts, cases and courier assignments, with administrator
supervision, reassignment history, private media and archived cases.
The official WhatsApp Business webhook is required; `wa.me` links cannot
receive messages. Confirm the existing number's setup before migrating or
enabling it. Do not change the current number's registration as part of a
configuration audit.

Implementation and test-channel setup:
[docs/whatsapp-crm.md](whatsapp-crm.md).

The reusable [direct WhatsApp CRM procedure](../.agents/skills/whatsapp-cloud-api-crm/SKILL.md)
captures the tested raw-signature, independent-assignment, private-media and
verification boundaries. Its library installation requires the skill-saving
approval. CRM frontend work also used the platform `design` and `delegation`
instructions; UI test guidance is in `testing`. The specialized tester callback
was unavailable in this environment, so reproducible Playwright tests were run
directly instead. Supabase connector instructions live under
`.local/integration_skills/supabase_17453363_mcp/SKILL.md`.
