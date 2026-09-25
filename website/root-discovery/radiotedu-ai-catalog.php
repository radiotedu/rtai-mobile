<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Cache-Control: public, max-age=600');
header('X-Content-Type-Options: nosniff');

echo json_encode([
    'specVersion' => '1.0',
    'host' => [
        'displayName' => 'RadioTEDU',
        'identifier' => 'did:web:radiotedu.com',
    ],
    'entries' => [
        [
            'identifier' => 'urn:air:radiotedu.com:api:radio-status',
            'displayName' => 'RadioTEDU radio status API',
            'type' => 'application/json',
            'url' => 'https://radiotedu.com/openapi.json',
            'representativeQueries' => [
                'Where is the RadioTEDU radio status API documented?',
                'How can I check the English and French AI radio station status?',
            ],
        ],
        [
            'identifier' => 'urn:air:radiotedu.com:content:llms',
            'displayName' => 'RadioTEDU current AI content guide',
            'type' => 'text/plain',
            'url' => 'https://radiotedu.com/llms-ai.txt',
            'representativeQueries' => [
                'What does RadioTEDU publish and broadcast?',
                'Where can I find RadioTEDU podcasts, radios and technology information?',
            ],
        ],
        [
            'identifier' => 'urn:air:radiotedu.com:content:llms-canonical',
            'displayName' => 'RadioTEDU canonical llms.txt route',
            'type' => 'text/plain',
            'url' => 'https://radiotedu.com/llms.txt',
            'representativeQueries' => [
                'Where is the canonical RadioTEDU llms.txt content map?',
                'How does the RadioTEDU llms.txt route expose current station information?',
            ],
        ],
        [
            'identifier' => 'urn:air:radiotedu.com:api:catalog',
            'displayName' => 'RadioTEDU public API catalog',
            'type' => 'application/linkset+json',
            'url' => 'https://radiotedu.com/.well-known/api-catalog',
            'representativeQueries' => [
                'Which RadioTEDU public APIs are documented?',
                'Where are the RadioTEDU API descriptions and status endpoints?',
            ],
        ],
        [
            'identifier' => 'urn:air:radiotedu.com:mcp:public-radio',
            'displayName' => 'RadioTEDU public radio MCP server',
            'type' => 'application/json',
            'url' => 'https://radiotedu.com/.well-known/mcp/server-card.json',
            'representativeQueries' => [
                'Which tools does the RadioTEDU MCP server provide for radio, podcasts, search, and studio booking?',
                'Where are the RadioTEDU public MCP endpoint and server card?',
            ],
        ],
        [
            'identifier' => 'urn:air:radiotedu.com:content:agent-guide',
            'displayName' => 'RadioTEDU guide for AI agents',
            'type' => 'text/html',
            'url' => 'https://radiotedu.com/agents.html',
            'representativeQueries' => [
                'How can an AI agent discover and use RadioTEDU public information?',
                'What RadioTEDU MCP tools are available, and which one creates a studio booking?',
            ],
        ],
        [
            'identifier' => 'urn:air:radiotedu.com:content:agent-skill',
            'displayName' => 'RadioTEDU agent discovery skill',
            'type' => 'text/markdown',
            'url' => 'https://radiotedu.com/.well-known/agent-skills/radiotedu-discovery/SKILL.md',
            'representativeQueries' => [
                'How should an agent discover and cite RadioTEDU sources?',
                'Which RadioTEDU MCP tools are read-only and which one creates a booking?',
            ],
        ],
    ],
], JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
