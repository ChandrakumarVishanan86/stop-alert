<?php
require __DIR__ . '/config.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function out($data, int $code = 200): void {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

try {
    $pdo = db();
} catch (Throwable $e) {
    out(['error' => 'Database connect aagala: ' . $e->getMessage()], 500);
}

$action = $_GET['action'] ?? '';
$body = json_decode(file_get_contents('php://input') ?: '[]', true);
if (!is_array($body)) $body = [];

try {
    switch ($action) {

        // All routes, each with its ordered stops (one call is enough for the whole map)
        case 'routes':
            $routes = $pdo->query(
                'SELECT id, route_number, name, vehicle_type FROM routes
                 ORDER BY CAST(route_number AS UNSIGNED), name'
            )->fetchAll();
            $rows = $pdo->query(
                'SELECT rs.route_id, rs.stop_order, s.id, s.name, s.latitude, s.longitude
                 FROM route_stops rs JOIN stops s ON s.id = rs.stop_id
                 ORDER BY rs.route_id, rs.stop_order'
            )->fetchAll();
            $byRoute = [];
            foreach ($rows as $r) {
                $byRoute[(int)$r['route_id']][] = [
                    'id' => (int)$r['id'],
                    'name' => $r['name'],
                    'latitude' => (float)$r['latitude'],
                    'longitude' => (float)$r['longitude'],
                    'stop_order' => (int)$r['stop_order'],
                ];
            }
            foreach ($routes as &$rt) {
                $rt['id'] = (int)$rt['id'];
                $rt['stops'] = $byRoute[$rt['id']] ?? [];
                $rt['stop_count'] = count($rt['stops']);
            }
            unset($rt);
            out($routes);

        case 'start_trip':
            $device = substr(trim((string)($body['device_id'] ?? '')), 0, 64);
            $routeId = (int)($body['route_id'] ?? 0);
            $stopId = (int)($body['stop_id'] ?? 0);
            $dist = max(100, min(20000, (int)($body['alert_distance_m'] ?? 1000)));
            $mode = ($body['mode'] ?? 'live') === 'demo' ? 'demo' : 'live';
            if ($device === '' || $stopId <= 0) out(['error' => 'device_id and stop_id required'], 400);
            $st = $pdo->prepare(
                'INSERT INTO trips (device_id, route_id, stop_id, alert_distance_m, mode)
                 VALUES (?, ?, ?, ?, ?)'
            );
            $st->execute([$device, $routeId > 0 ? $routeId : null, $stopId, $dist, $mode]);
            out(['id' => (int)$pdo->lastInsertId()]);

        case 'update_trip':
            $id = (int)($body['id'] ?? 0);
            $status = (string)($body['status'] ?? '');
            if ($id <= 0 || !in_array($status, ['alerted', 'completed', 'cancelled'], true)) {
                out(['error' => 'bad request'], 400);
            }
            if ($status === 'alerted') {
                $st = $pdo->prepare('UPDATE trips SET status = ? WHERE id = ?');
            } else {
                $st = $pdo->prepare('UPDATE trips SET status = ?, ended_at = NOW() WHERE id = ?');
            }
            $st->execute([$status, $id]);
            out(['ok' => true]);

        case 'history':
            $device = substr(trim((string)($_GET['device_id'] ?? '')), 0, 64);
            if ($device === '') out([]);
            $st = $pdo->prepare(
                'SELECT t.id, t.status, t.mode, t.alert_distance_m, t.started_at,
                        s.name AS stop_name, r.name AS route_name
                 FROM trips t
                 JOIN stops s ON s.id = t.stop_id
                 LEFT JOIN routes r ON r.id = t.route_id
                 WHERE t.device_id = ?
                 ORDER BY t.id DESC LIMIT 10'
            );
            $st->execute([$device]);
            out($st->fetchAll());

        default:
            out(['error' => 'unknown action'], 404);
    }
} catch (Throwable $e) {
    out(['error' => 'Server error: ' . $e->getMessage()], 500);
}
