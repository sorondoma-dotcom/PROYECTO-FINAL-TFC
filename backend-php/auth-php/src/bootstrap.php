<?php
declare(strict_types=1);

function env(string $key, string $default = ''): string
{
    loadEnv();
    return $_ENV[$key] ?? getenv($key) ?: $default;
}

function loadEnv(): void
{
    static $loaded = false;
    if ($loaded) {
        return;
    }
    $loaded = true;

    $envPath = __DIR__ . '/../.env';
    if (!file_exists($envPath)) {
        return;
    }

    $lines = file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        if (str_starts_with(trim($line), '#') || !str_contains($line, '=')) {
            continue;
        }
        [$k, $v] = array_map('trim', explode('=', $line, 2));
        $v = trim($v, "\"'");
        putenv("$k=$v");
        $_ENV[$k] = $v;
    }
}

function dbPath(): string
{
    $path = __DIR__ . '/../data';
    if (!is_dir($path)) {
        mkdir($path, 0777, true);
    }
    return $path . '/auth.db';
}

function getPDO(): PDO
{
    loadEnv();
    static $pdo = null;
    if ($pdo) {
        return $pdo;
    }

    $dsn = env('DB_DSN', '');
    $user = env('DB_USER', '');
    $pass = env('DB_PASS', '');

    if (!$dsn) {
        $dsn = 'sqlite:' . dbPath();
    }

    $pdo = new PDO($dsn, $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    return $pdo;
}

function jsonResponse(array $payload, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json');
    echo json_encode($payload);
    exit;
}
