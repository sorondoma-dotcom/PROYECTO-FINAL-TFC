<?php
require __DIR__ . '/../src/bootstrap.php';
require __DIR__ . '/../src/controllers/AuthController.php';
require __DIR__ . '/../src/controllers/RankingController.php';
require __DIR__ . '/../src/services/AuthService.php';
require __DIR__ . '/../src/services/MailService.php';
require __DIR__ . '/../src/services/RankingService.php';
require __DIR__ . '/../src/repositories/UserRepository.php';
require __DIR__ . '/../src/repositories/SwimmingRankingRepository.php';
require __DIR__ . '/../src/models/User.php';
require __DIR__ . '/../src/models/SwimmingRanking.php';
require __DIR__ . '/../src/lib/PHPMailer/Exception.php';
require __DIR__ . '/../src/lib/PHPMailer/PHPMailer.php';
require __DIR__ . '/../src/lib/PHPMailer/SMTP.php';

use App\Controllers\AuthController;
use App\Controllers\RankingController;
use App\Repositories\UserRepository;
use App\Repositories\SwimmingRankingRepository;
use App\Services\AuthService;
use App\Services\MailService;
use App\Services\RankingService;

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

$allowedOrigins = [
    'http://localhost:4200',
    'https://0bfkk9hz-4200.uks1.devtunnels.ms',
];
$requestOrigin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($requestOrigin, $allowedOrigins, true)) {
    header("Access-Control-Allow-Origin: {$requestOrigin}");
    header('Access-Control-Allow-Credentials: true');
    header('Vary: Origin'); // responde segun origen permitido
}
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Access-Control-Max-Age: 86400');

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

// Rutas publicas que NO requieren autenticacion
$publicRoutes = [
    'GET' => ['/api/health', '/', '/index.php', '/api/rankings'],
    'POST' => ['/api/login', '/api/register', '/api/password-reset', '/api/email/send-code', '/api/email/verify'],
    'PUT' => ['/api/password-reset']
];

// Verificar si la ruta requiere autenticacion
$requiresAuth = true;
if (isset($publicRoutes[$method]) && in_array($uri, $publicRoutes[$method], true)) {
    $requiresAuth = false;
}

// Solo verificar autenticacion si la ruta la requiere
if ($requiresAuth && empty($_SESSION['user_id'])) {
    header('Content-Type: application/json');
    http_response_code(401);
    die(json_encode([
        'error' => 'Sesion cerrada. Debes volver a autenticarte para acceder.',
        'uri' => $uri,
        'method' => $method
    ]));
}

$userRepository = new UserRepository();
$mailService = new MailService();
$authService = new AuthService($userRepository, $mailService);
$authController = new AuthController($authService);

$rankingRepository = new SwimmingRankingRepository();
$rankingService = new RankingService($rankingRepository);
$rankingController = new RankingController($rankingService);

if ($method === 'POST' && $uri === '/api/register') {
    $authController->register();
} elseif ($method === 'POST' && $uri === '/api/login') {
    $authController->login();
} elseif ($method === 'POST' && $uri === '/api/logout') {
    $authController->logout();
} elseif ($method === 'POST' && $uri === '/api/password-reset') {
    $authController->requestPasswordReset();
} elseif ($method === 'PUT' && $uri === '/api/password-reset') {
    $authController->resetPassword();
} elseif ($method === 'POST' && $uri === '/api/email/send-code') {
    $authController->sendVerificationCode();
} elseif ($method === 'POST' && $uri === '/api/email/verify') {
    $authController->verifyEmail();
} elseif ($method === 'GET' && $uri === '/api/rankings') {
    $rankingController->index();
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
