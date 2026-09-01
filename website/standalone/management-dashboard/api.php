<?php
declare(strict_types=1);
require 'C:/inetpub/wwwroot/App_Data/RadioTEDU/ecosystem_gateway.php';
rt_require_screen_auth('rt_management_dashboard', '/management/dashboard', 'Stüdyo Yönetim Ekranı');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, private');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    header('Allow: GET');
    http_response_code(405);
    echo '{"error":"method_not_allowed"}';
    exit;
}

try {
    $dashboard = rt_erp_request('GET', '/api/ecosystem/v1/dashboard');
    $roomDisplay = rt_erp_request('GET', '/api/ecosystem/v1/room-display');
    $dashboard['data']['room_qr'] = $roomDisplay['data'] ?? null;
    echo json_encode($dashboard, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
} catch (RtAdapterException $exception) {
    http_response_code(502);
    echo $exception->responseBody;
} catch (Throwable $exception) {
    http_response_code(502);
    echo json_encode(['error' => 'ERP stüdyo servisine ulaşılamadı.'], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
}
