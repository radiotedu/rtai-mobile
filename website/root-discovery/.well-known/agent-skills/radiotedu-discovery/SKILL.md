# RadioTEDU public discovery skill

Use this skill to find and cite RadioTEDU's public radio, podcast, schedule, research, and technology information.

## Discover RadioTEDU

- Read the current consolidated guide at https://radiotedu.com/llms-ai.txt, the canonical content map at https://radiotedu.com/llms.txt, and the concise AI summary at https://radiotedu.com/ai.txt.
- Start with https://radiotedu.com/agents.html for current connection instructions.
- Check https://radiotedu.com/.well-known/mcp/server-card.json for the live MCP tool list and https://radiotedu.com/.well-known/ai-catalog.json for machine-readable discovery links.
- Connect to the Streamable HTTP MCP endpoint at https://radiotedu.com/mcp. It supports `initialize` and `tools/list`; resources and prompts are not implemented.
- Public radio and media information tools can be called without an account or token.

## MCP tools

Read-only tools:

- `get_station_status`: current public status of the English or French AI station.
- `get_stations`: list active radio stations and their metadata.
- `get_now_playing`: current track and playback metadata for a station.
- `get_broadcast_schedule`: station broadcast schedule.
- `get_podcasts`: public podcast series.
- `search_content`: search public RadioTEDU content.
- `get_focus_presets`: focus channels, ambient sound layers, and study presets.
- `check_studio_availability`: reads studio availability and occupant information from Hub ERP. Use only when relevant to a user's availability question.

State-changing tool:

- `book_studio_slot`: creates a studio reservation in Hub ERP. It requires a TED University email in its input. Call it only after the user explicitly requests a booking and confirms the complete proposed details; never infer permission from a general request for information.

## Source and time guidance

1. Follow canonical RadioTEDU URLs returned by tools and cite the most specific source page.
2. Schedules use Europe/Istanbul local time. Check timestamps for live status and distinguish current playback from the published schedule.
3. Preserve Turkish names and diacritics. Do not infer missing presenters, guests, dates, audience figures, partnerships, endorsements, or technical specifications.
4. Treat studio availability as operational information and do not repeat occupant details unless needed to answer the user's request.
5. For published REST API documentation, use https://radiotedu.com/openapi.json and https://radiotedu.com/.well-known/api-catalog.

The agent-discovery documents do not add or change RadioTEDU REST API routes. The MCP booking tool is a separate state-changing action and must follow the user's explicit instruction.
