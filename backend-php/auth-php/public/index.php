<?php
require __DIR__ . '/../src/bootstrap.php';
require __DIR__ . '/../src/controllers/AuthController.php';
require __DIR__ . '/../src/services/AuthService.php';
require __DIR__ . '/../src/repositories/UserRepository.php';
require __DIR__ . '/../src/models/User.php';

use App\Controllers\AuthController;
use App\Repositories\UserRepository;
use App\Services\AuthService;

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

header('Access-Control-Allow-Origin: http://localhost:4200');
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

$basePath = '/PROYECTO-FINAL-TFC/backend-php/auth-php/public';
if (strpos($uri, $basePath) === 0) {
    $uri = substr($uri, strlen($basePath));
}

if (empty($uri)) {
    $uri = '/';
}

// Rutas públicas que NO requieren autenticación
$publicRoutes = [
    'GET' => ['/api/health', '/', '/index.php'],
    'POST' => ['/api/login', '/api/register', '/api/password-reset'],
    'PUT' => ['/api/password-reset']
];

// Verificar si la ruta requiere autenticación
$requiresAuth = true;
if (isset($publicRoutes[$method]) && in_array($uri, $publicRoutes[$method], true)) {
    $requiresAuth = false;
}

// Solo verificar autenticación si la ruta la requiere
if ($requiresAuth && empty($_SESSION['user_id'])) {
    header('Content-Type: application/json');
    http_response_code(401);
    die(json_encode([
        'error' => 'Sesión cerrada. Debes volver a autenticarte para acceder.',
        'uri' => $uri,
        'method' => $method
    ]));
}

$userRepository = new UserRepository();
$authService = new AuthService($userRepository);
$controller = new AuthController($authService);

if ($method === 'POST' && $uri === '/api/register') {
    $controller->register();
} elseif ($method === 'POST' && $uri === '/api/login') {
    $controller->login();
} elseif ($method === 'POST' && $uri === '/api/logout') {
    $controller->logout();
} elseif ($method === 'POST' && $uri === '/api/password-reset') {
    $controller->requestPasswordReset();
} elseif ($method === 'PUT' && $uri === '/api/password-reset') {
    $controller->resetPassword();
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
