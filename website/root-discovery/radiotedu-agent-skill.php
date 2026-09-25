<?php
declare(strict_types=1);

header('Content-Type: text/markdown; charset=utf-8');
header('Cache-Control: public, max-age=600');
header('X-Content-Type-Options: nosniff');
readfile(__DIR__ . '/.well-known/agent-skills/radiotedu-discovery/SKILL.md');
