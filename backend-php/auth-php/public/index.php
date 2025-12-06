<?php
require __DIR__ . '/../src/bootstrap.php';
require __DIR__ . '/../src/controllers/AuthController.php';
require __DIR__ . '/../src/controllers/RankingController.php';
require __DIR__ . '/../src/controllers/AthleteController.php';
require __DIR__ . '/../src/controllers/CompetitionController.php';
require __DIR__ . '/../src/controllers/ProofController.php';
require __DIR__ . '/../src/controllers/NotificationController.php';
require __DIR__ . '/../src/controllers/StatsController.php';
require __DIR__ . '/../src/services/AuthService.php';
require __DIR__ . '/../src/services/MailService.php';
require __DIR__ . '/../src/services/RankingService.php';
require __DIR__ . '/../src/services/AthleteResultService.php';
require __DIR__ . '/../src/services/AthleteProfileService.php';
require __DIR__ . '/../src/services/CompetitionService.php';
require __DIR__ . '/../src/services/ProofService.php';
require __DIR__ . '/../src/services/NotificationService.php';
require __DIR__ . '/../src/services/StatsService.php';
require __DIR__ . '/../src/repositories/UserRepository.php';
require __DIR__ . '/../src/repositories/SwimmingRankingRepository.php';
require __DIR__ . '/../src/repositories/AthleteResultRepository.php';
require __DIR__ . '/../src/repositories/CompetitionRepository.php';
require __DIR__ . '/../src/repositories/InscriptionRepository.php';
require __DIR__ . '/../src/repositories/NotificationRepository.php';
require __DIR__ . '/../src/models/User.php';
require __DIR__ . '/../src/models/SwimmingRanking.php';
require __DIR__ . '/../src/models/AthleteResult.php';
require __DIR__ . '/../src/models/Competition.php';
require __DIR__ . '/../src/models/Inscription.php';
require __DIR__ . '/../src/models/Notification.php';
require __DIR__ . '/../src/lib/PHPMailer/Exception.php';
require __DIR__ . '/../src/lib/PHPMailer/PHPMailer.php';
require __DIR__ . '/../src/lib/PHPMailer/SMTP.php';

use App\Controllers\AuthController;
use App\Controllers\RankingController;
use App\Controllers\AthleteController;
use App\Controllers\CompetitionController;
use App\Controllers\ProofController;
use App\Controllers\NotificationController;
use App\Controllers\StatsController;
use App\Repositories\UserRepository;
use App\Repositories\SwimmingRankingRepository;
use App\Repositories\AthleteResultRepository;
use App\Repositories\CompetitionRepository;
use App\Repositories\InscriptionRepository;
use App\Repositories\NotificationRepository;
use App\Services\AuthService;
use App\Services\MailService;
use App\Services\RankingService;
use App\Services\AthleteResultService;
use App\Services\AthleteProfileService;
use App\Services\CompetitionService;
use App\Services\ProofService;
use App\Services\NotificationService;
use App\Services\StatsService;

if (session_status() === PHP_SESSION_NONE) {
    $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
    $hostWithoutPort = explode(':', $host, 2)[0] ?? $host;
    $sessionDomain = env('SESSION_COOKIE_DOMAIN', $hostWithoutPort);
    $sessionSecure = filter_var(env('SESSION_COOKIE_SECURE', 'false'), FILTER_VALIDATE_BOOL);
    $sessionSameSite = env('SESSION_COOKIE_SAMESITE', 'Lax');

    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'domain' => $sessionDomain,
        'secure' => $sessionSecure,
        'httponly' => true,
        'samesite' => $sessionSameSite
    ]);
    session_start();
}

$originsFromEnv = env('ALLOWED_ORIGINS', 'http://localhost:4200,http://localhost,http://localhost:8080');
$allowedOrigins = array_values(array_filter(array_map('trim', explode(',', $originsFromEnv))));
$requestOrigin = trim($_SERVER['HTTP_ORIGIN'] ?? '');
if ($requestOrigin !== '' && in_array($requestOrigin, $allowedOrigins, true)) {
    header("Access-Control-Allow-Origin: {$requestOrigin}");
    header('Access-Control-Allow-Credentials: true');
    header('Vary: Origin');
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

$scriptName = $_SERVER['SCRIPT_NAME'] ?? '';
$scriptDir = str_replace('\\', '/', dirname($scriptName));
$basePath = ($scriptDir !== '/' && $scriptDir !== '.') ? rtrim($scriptDir, '/') : '';
if ($basePath !== '' && strpos($uri, $basePath) === 0) {
    $uri = substr($uri, strlen($basePath));
}

if (empty($uri)) {
    $uri = '/';
}

// Rutas publicas que NO requieren autenticacion
$publicRoutes = [
    'GET' => ['/api/health', '/', '/index.php', '/api/rankings', '/api/athletes', '/api/athletes/results', '/api/athletes/results/medals', '/api/athletes/results/stats', '/api/competitions', '/api/stats/olympic-records', '/api/stats/dashboard'],
    'POST' => ['/api/login', '/api/logout', '/api/register', '/api/password-reset', '/api/email/send-code', '/api/email/verify'],
    'PUT' => ['/api/password-reset']
];

// Verificar si la ruta requiere autenticacion
$requiresAuth = true;
if (isset($publicRoutes[$method]) && in_array($uri, $publicRoutes[$method], true)) {
    $requiresAuth = false;
}

if ($requiresAuth && $method === 'GET' && preg_match('/^\/api\/athletes\/(\d+)\/profile$/', $uri)) {
    $requiresAuth = false;
}
if ($requiresAuth && $method === 'GET' && preg_match('/^\/api\/users\/(\d+)\/avatar$/', $uri)) {
    $requiresAuth = false;
}

// Solo verificar autenticacion si la ruta la requiere
if ($requiresAuth && empty($_SESSION['user_id'])) {
    // Logging temporal para depuración: registra session_id, cookies y session
    try {
        $logDir = __DIR__ . '/../data';
        if (!is_dir($logDir)) {
            @mkdir($logDir, 0755, true);
        }
        $logFile = $logDir . '/session_debug.log';
        $entry = [
            'ts' => date('c'),
            'uri' => $uri,
            'method' => $method,
            'remote_addr' => $_SERVER['REMOTE_ADDR'] ?? '',
            'session_id' => function_exists('session_id') ? session_id() : '',
            'cookies' => $_COOKIE ?? [],
            'session' => $_SESSION ?? []
        ];
        @file_put_contents($logFile, json_encode($entry) . PHP_EOL, FILE_APPEND | LOCK_EX);
    } catch (\Throwable $e) {
        // ignorar errores de logging en producción
    }

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

$athleteResultRepository = new AthleteResultRepository();
$athleteResultService = new AthleteResultService($athleteResultRepository);

$pdo = getPDO();
$inscriptionRepository = new InscriptionRepository($pdo);
$athleteProfileService = new AthleteProfileService($pdo, $inscriptionRepository);
$athleteController = new AthleteController($athleteResultService, $athleteProfileService);

// Competition repositories and services
$competitionRepository = new CompetitionRepository($pdo);
$notificationRepository = new NotificationRepository($pdo);
$notificationService = new NotificationService($notificationRepository, $inscriptionRepository);
$competitionService = new CompetitionService($competitionRepository, $inscriptionRepository, $notificationService);
$competitionController = new CompetitionController($competitionService);

// Proof services
$proofService = new ProofService($pdo);
$proofController = new ProofController($proofService);

$notificationController = new NotificationController($notificationService);
$statsService = new StatsService($pdo);
$statsController = new StatsController($statsService);

if ($method === 'POST' && $uri === '/api/register') {
    $authController->register();
} elseif ($method === 'POST' && $uri === '/api/login') {
    $authController->login();
} elseif ($method === 'POST' && $uri === '/api/logout') {
    $authController->logout();
} elseif ($method === 'GET' && $uri === '/api/auth/me') {
    $authController->currentUser();
} elseif (($method === 'POST' || $method === 'PUT') && $uri === '/api/auth/profile') {
    $authController->updateProfile();
} elseif ($method === 'POST' && $uri === '/api/password-reset') {
    $authController->requestPasswordReset();
} elseif ($method === 'PUT' && $uri === '/api/password-reset') {
    $authController->resetPassword();
} elseif ($method === 'POST' && $uri === '/api/email/send-code') {
    $authController->sendVerificationCode();
} elseif ($method === 'POST' && $uri === '/api/email/verify') {
    $authController->verifyEmail();
} elseif ($method === 'GET' && preg_match('/^\/api\/users\/(\d+)\/avatar$/', $uri, $matches)) {
    $authController->streamAvatar((int) $matches[1]);
} elseif ($method === 'GET' && $uri === '/api/rankings') {
    $rankingController->index();
} elseif ($method === 'GET' && $uri === '/api/athletes') {
    $athleteController->getAllAthletes();
} elseif ($method === 'GET' && $uri === '/api/athletes/results') {
    $athleteController->getResults();
} elseif ($method === 'GET' && $uri === '/api/athletes/me') {
    $athleteController->getSelfProfile();
} elseif ($method === 'GET' && preg_match('/^\/api\/athletes\/(\d+)\/profile$/', $uri, $matches)) {
    $athleteController->getProfileById((int) $matches[1]);
} elseif ($method === 'GET' && $uri === '/api/athletes/results/medals') {
    $athleteController->getMedals();
} elseif ($method === 'GET' && $uri === '/api/athletes/results/stats') {
    $athleteController->getStats();
} elseif ($method === 'GET' && $uri === '/api/stats/olympic-records') {
    $statsController->getOlympicRecordLeader();
} elseif ($method === 'GET' && $uri === '/api/stats/dashboard') {
    $statsController->getDashboardStats();
} elseif ($method === 'GET' && $uri === '/api/competitions') {
    $competitionController->getAllCompetitions();
} elseif ($method === 'POST' && $uri === '/api/competitions') {
    $competitionController->createCompetition();
} elseif (preg_match('/^\/api\/competitions\/(\d+)$/', $uri, $matches) && $method === 'GET') {
    $competitionController->getCompetition((int) $matches[1]);
} elseif (preg_match('/^\/api\/competitions\/(\d+)$/', $uri, $matches) && $method === 'PUT') {
    $competitionController->updateCompetition((int) $matches[1]);
} elseif (preg_match('/^\/api\/competitions\/(\d+)$/', $uri, $matches) && $method === 'DELETE') {
    $competitionController->deleteCompetition((int) $matches[1]);
} elseif (preg_match('/^\/api\/competitions\/(\d+)\/athletes$/', $uri, $matches) && $method === 'POST') {
    $competitionController->registerAthlete((int) $matches[1]);
} elseif (preg_match('/^\/api\/inscriptions\/(\d+)$/', $uri, $matches) && $method === 'DELETE') {
    $competitionController->unregisterAthlete((int) $matches[1]);
} elseif (preg_match('/^\/api\/inscriptions\/(\d+)$/', $uri, $matches) && $method === 'PUT') {
    $competitionController->updateInscription((int) $matches[1]);
} elseif ($method === 'POST' && preg_match('/^\/api\/competitions\/(\d+)\/proofs$/', $uri, $matches)) {
    $proofController->createProof();
} elseif ($method === 'GET' && preg_match('/^\/api\/competitions\/(\d+)\/proofs$/', $uri, $matches)) {
    $proofController->getProofsByCompetition((int) $matches[1]);
} elseif ($method === 'GET' && preg_match('/^\/api\/proofs\/(\d+)$/', $uri, $matches)) {
    $proofController->getProof((int) $matches[1]);
} elseif ($method === 'PUT' && preg_match('/^\/api\/proofs\/(\d+)$/', $uri, $matches)) {
    $proofController->updateProof((int) $matches[1]);
} elseif ($method === 'DELETE' && preg_match('/^\/api\/proofs\/(\d+)$/', $uri, $matches)) {
    $proofController->deleteProof((int) $matches[1]);
} elseif ($method === 'POST' && preg_match('/^\/api\/proofs\/(\d+)\/athletes$/', $uri, $matches)) {
    $proofController->registerAthleteToProof((int) $matches[1]);
} elseif ($method === 'POST' && $uri === '/api/proofs/athletes/bulk') {
    $proofController->registerAthleteToMultipleProofs();
} elseif ($method === 'DELETE' && preg_match('/^\/api\/proofs\/(\d+)\/athletes\/(\d+)$/', $uri, $matches)) {
    $proofController->unregisterAthleteFromProofByProofAndInscription((int) $matches[1], (int) $matches[2]);
} elseif ($method === 'DELETE' && preg_match('/^\/api\/proofs\/athletes\/(\d+)$/', $uri, $matches)) {
    $proofController->unregisterAthleteFromProof((int) $matches[1]);
} elseif ($method === 'GET' && $uri === '/api/notifications') {
    $notificationController->listForCurrentUser();
} elseif ($method === 'POST' && preg_match('/^\/api\/notifications\/(\d+)\/mark-read$/', $uri, $matches)) {
    $notificationController->markAsRead((int) $matches[1]);
} elseif ($method === 'POST' && preg_match('/^\/api\/notifications\/(\d+)\/respond$/', $uri, $matches)) {
    $notificationController->respond((int) $matches[1]);
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
