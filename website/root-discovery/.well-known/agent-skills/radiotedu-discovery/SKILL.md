# RadioTEDU public discovery skill

Use this skill to find and cite RadioTEDU's public radio, podcast, schedule, research, and technology information.

## Discover RadioTEDU

- Read the current consolidated guide at https://radiotedu.com/llms-ai.txt, the canonical content map at https://radiotedu.com/llms.txt, and the concise AI summary at https://radiotedu.com/ai.txt.
- Start with https://radiotedu.com/agents.html for current connection instructions.
- Check https://radiotedu.com/.well-known/mcp/server-card.json for the live MCP tools, resources, prompts, privacy controls, and authentication requirements.
- Check https://radiotedu.com/.well-known/ai-catalog.json for machine-readable discovery links.
- Connect to the Streamable HTTP MCP endpoint at https://radiotedu.com/mcp. After `initialize`, discover tools, resources, and prompts with `tools/list`, `resources/list`, and `prompts/list`.
- Public radio and media information is available without an account or token. Studio booking requires an authenticated ERP Bearer token with active application access.

## MCP tools

Read-only tools:

- `get_station_status`: current public status of the English or French AI station.
- `get_stations`: list active radio stations and their metadata.
- `get_now_playing`: current track and playback metadata for a station.
- `get_broadcast_schedule`: station broadcast schedule.
- `get_podcasts`: public podcast series.
- `search_content`: search published content in Turkish, English, or French; results include pagination and an optional content-type filter.
- `get_focus_presets`: focus channels, ambient sound layers, and study presets.
- `check_studio_availability`: returns room metadata and aggregate flags only. It never returns occupant identities, contact details, or individual reservation records.

State-changing tool:

- `book_studio_slot`: creates a studio reservation in Hub ERP. The authenticated ERP profile supplies the account identity; do not provide names, email addresses, or phone numbers in arguments. Call the tool only after the user explicitly requests a booking and confirms the exact date, time, and attendee count. Reuse the same idempotency key only for retries of the same request. Avoid sensitive details in the purpose field.

## Resources and prompts

- Fixed resources include stations, main-station now playing and schedule, podcasts, focus presets, and the privacy-filtered studio summary.
- Resource templates provide station-specific now-playing, schedule, and AI station status data.
- Prompts support public content discovery, on-air summaries, focus-session recommendations, and privacy-preserving booking preparation.

## Source, privacy, and time guidance

1. Follow canonical RadioTEDU URLs returned by tools and cite the most specific source page.
2. Schedules use Europe/Istanbul local time. Check timestamps for live status and distinguish current playback from the published schedule.
3. Preserve published Turkish spelling and diacritics. Do not infer missing dates, audience figures, partnerships, endorsements, or technical specifications.
4. Do not request or repeat personal data unless it is necessary for the user's request. Never disclose studio occupant identities or individual reservation details through public responses.
5. The booking token is used only to verify the authenticated ERP profile and is not persisted by the MCP. A minimal idempotency record expires after 15 minutes; expired records are cleared before a later booking attempt.
6. For RadioTEDU's controller-level processing information and applicable rights, consult https://radiotedu.com/gizlilik-politikasi/.
7. For published REST API documentation, use https://radiotedu.com/openapi.json and https://radiotedu.com/.well-known/api-catalog.

The agent-discovery documents do not add or change RadioTEDU REST API routes. The MCP booking tool is a state-changing action and requires the user's explicit instruction and confirmation.
