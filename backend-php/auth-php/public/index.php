<?php
require __DIR__ . '/../src/bootstrap.php';
require __DIR__ . '/../src/controllers/AuthController.php';
require __DIR__ . '/../src/services/AuthService.php';
require __DIR__ . '/../src/repositories/UserRepository.php';
require __DIR__ . '/../src/models/User.php';

use App\Controllers\AuthController;
use App\Repositories\UserRepository;
use App\Services\AuthService;

// CORS para desarrollo local con Angular
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

// Normalizar la ruta - remover el path base de XAMPP
$basePath = '/Proyecto-Final-TFC/backend-php/auth-php/public';
if (strpos($uri, $basePath) === 0) {
    $uri = substr($uri, strlen($basePath));
}

// Asegurar que la ruta comience con /
if (empty($uri) || $uri === '') {
    $uri = '/';
}

$userRepository = new UserRepository();
$authService = new AuthService($userRepository);
$controller = new AuthController($authService);

// Debug: descomentar para ver qué ruta se está recibiendo
// jsonResponse(['debug' => true, 'uri' => $uri, 'method' => $method, 'original_uri' => $_SERVER['REQUEST_URI']]);

// Routing
if ($method === 'POST' && $uri === '/api/register') {
    $controller->register();
} elseif ($method === 'POST' && $uri === '/api/login') {
    $controller->login();
} elseif ($method === 'GET' && ($uri === '/api/health' || $uri === '/' || $uri === '/index.php')) {
    jsonResponse(['status' => 'ok', 'service' => 'auth-php', 'database' => 'MySQL on localhost:3306']);
} else {
    http_response_code(404);
    jsonResponse([
        'error' => 'Ruta no encontrada', 
        'uri_recibida' => $uri, 
        'method' => $method,
        'uri_original' => $_SERVER['REQUEST_URI']
    ]);
}
