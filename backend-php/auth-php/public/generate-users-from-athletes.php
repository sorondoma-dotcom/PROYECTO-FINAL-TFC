<?php
require __DIR__ . '/../src/bootstrap.php';

$pdo = getPDO();
$password = 'Asd1234.';
$hash = password_hash($password, PASSWORD_DEFAULT);

// Obtén todos los atletas
$atletas = $pdo->query('SELECT athlete_id, athlete_name FROM atletas')->fetchAll();

$inserted = 0;
$skipped = 0;
foreach ($atletas as $atleta) {
    $email = 'athlete_' . $atleta['athlete_id'] . '@swimlive.local';
    $name = $atleta['athlete_name'];
    // Verifica si ya existe el usuario
    $exists = $pdo->prepare('SELECT id FROM users WHERE email = ?');
    $exists->execute([$email]);
    if ($exists->fetch()) {
        $skipped++;
        $update = $pdo->prepare('UPDATE users SET athlete_id = ? WHERE email = ? AND athlete_id IS NULL');
        $update->execute([$atleta['athlete_id'], $email]);
        continue;
    }

    $stmt = $pdo->prepare('INSERT INTO users (name, email, password, email_verified_at, role, athlete_id) VALUES (?, ?, ?, NOW(), ?, ?)');
    $stmt->execute([$name, $email, $hash, 'nadador', $atleta['athlete_id']]);
    $inserted++;
}

// Crear usuario admin si no existe
$adminEmail = 'swimilive669@gmail.com';
$adminName = 'Admin';
$adminRole = 'admin';
$adminExists = $pdo->prepare('SELECT id FROM users WHERE email = ?');
$adminExists->execute([$adminEmail]);
if (!$adminExists->fetch()) {
    $stmt = $pdo->prepare('INSERT INTO users (name, email, password, email_verified_at, role, is_admin) VALUES (?, ?, ?, NOW(), ?, TRUE)');
    $stmt->execute([$adminName, $adminEmail, $hash, $adminRole]);
    echo "Usuario admin creado: $adminEmail\n";
} else {
    echo "Usuario admin ya existe: $adminEmail\n";
}

echo "Usuarios generados: $inserted\n";
echo "Usuarios omitidos (ya existían): $skipped\n";
echo "Contraseña para todos: $password\n";
