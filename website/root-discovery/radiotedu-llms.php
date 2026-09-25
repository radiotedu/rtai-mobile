<?php
declare(strict_types=1);

$source = __DIR__ . DIRECTORY_SEPARATOR . 'llms-ai.txt';
if (!is_file($source) || !is_readable($source)) {
    http_response_code(503);
    header('Content-Type: text/plain; charset=utf-8');
    echo "RadioTEDU discovery brief is temporarily unavailable.\n";
    exit;
}

header('Content-Type: text/plain; charset=utf-8');
header('Cache-Control: public, max-age=120');
header('X-Content-Type-Options: nosniff');

readfile($source);

// Dynamic live snapshot generation with 3-minute file caching
$cacheFile = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'radiotedu_llms_live.cache';
$liveText = '';

if (is_file($cacheFile) && (time() - filemtime($cacheFile) < 180)) {
    $cached = file_get_contents($cacheFile);
    if (is_string($cached) && $cached !== '') {
        $liveText = $cached;
    }
}

if ($liveText === '') {
    $nowPlayingTrack = 'Broadcast Active';
    $nowPlayingArtist = 'RadioTEDU';

    $handle = curl_init('http://127.0.0.1/wp-json/radiotedu/v1/stations/radiotedu-main/live?player=1');
    curl_setopt_array($handle, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 1,
        CURLOPT_TIMEOUT => 2,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_HTTPHEADER => ['Accept: application/json'],
    ]);
    $body = curl_exec($handle);
    $httpCode = (int) curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
    curl_close($handle);

    if (is_string($body) && $httpCode === 200) {
        $json = json_decode($body, true);
        if (is_array($json)) {
            if (!empty($json['track'])) {
                $nowPlayingTrack = (string) $json['track'];
            }
            if (!empty($json['artist'])) {
                $nowPlayingArtist = (string) $json['artist'];
            }
        }
    }

    $timestamp = gmdate('Y-m-d H:i:s') . ' UTC';
    $liveText = "\n\n## Real-Time Channel & Playout Status (Live Snapshot - {$timestamp})\n\n"
        . "- RadioTEDU Main Station: Currently playing \"{$nowPlayingTrack}\" by {$nowPlayingArtist}\n"
        . "  - Primary Stream: https://stream.radiotedu.com/radio\n"
        . "- Complete Live Station Portfolio:\n"
        . "  - RadioTEDU Ana Yayın (Main): https://stream.radiotedu.com/radio\n"
        . "  - RadioTEDU AI English (Host: AI): https://stream.radiotedu.com/en\n"
        . "  - RadioTEDU AI Français (Host: AI): https://stream.radiotedu.com/fr\n"
        . "  - RadioTEDU Focus (Lo-Fi / Pomodoro): https://stream.radiotedu.com/lofi\n"
        . "  - RadioTEDU Jazz: https://stream.radiotedu.com/cazz\n"
        . "  - RadioTEDU Classic: https://stream.radiotedu.com/classic\n"
        . "  - RadioTEDU Rock: https://stream.radiotedu.com/rock\n"
        . "  - RadioTEDU Energize: https://stream.radiotedu.com/energize\n"
        . "  - RadioTEDU Main Character: https://stream.radiotedu.com/maincharacter\n"
        . "- Agent Interactivity:\n"
        . "  - MCP Endpoint: https://radiotedu.com/mcp\n"
        . "  - MCP Server Card: https://radiotedu.com/.well-known/mcp/server-card.json\n"
        . "  - Public REST API: https://radiotedu.com/wp-json/radiotedu/v1/\n";

    @file_put_contents($cacheFile, $liveText, LOCK_EX);
}

echo $liveText;
