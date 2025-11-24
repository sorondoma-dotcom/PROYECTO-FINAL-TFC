<?php
/**
 * Script de utilidades para gestionar usuarios
 * Ejecutar desde línea de comandos o navegador
 */

require __DIR__ . '/../src/bootstrap.php';

function generateHash(string $password): string {
    return password_hash($password, PASSWORD_DEFAULT);
}


function verifyHash(string $password, string $hash): bool {
    return password_verify($password, $hash);
}

if (php_sapi_name() === 'cli') {
    echo "=== Gestor de Usuarios ===\n\n";
    
    // Generar hashes para las contraseñas comunes
    $passwords = ['test123', '123456', 'password', 'admin123'];
    
    echo "Hashes generados:\n";
    echo str_repeat("-", 80) . "\n";
    foreach ($passwords as $pwd) {
        $hash = generateHash($pwd);
        echo "Password: $pwd\n";
        echo "Hash: $hash\n\n";
    }
    
    // Verificar usuarios en la base de datos
    echo "\nUsuarios en la base de datos:\n";
    echo str_repeat("-", 80) . "\n";
    
    try {
        $pdo = getPDO();
        $stmt = $pdo->query("SELECT id, name, email, password, created_at FROM users");
        $users = $stmt->fetchAll();
        
        if (empty($users)) {
            echo "No hay usuarios registrados.\n";
        } else {
            foreach ($users as $user) {
                echo "ID: {$user['id']}\n";
                echo "Nombre: {$user['name']}\n";
                echo "Email: {$user['email']}\n";
                echo "Hash: {$user['password']}\n";
                echo "Creado: {$user['created_at']}\n";
                
                // Verificar contraseñas comunes
                echo "Verificación:\n";
                foreach ($passwords as $pwd) {
                    $match = password_verify($pwd, $user['password']) ? '✓' : '✗';
                    echo "  $match '$pwd'\n";
                }
                echo "\n";
            }
        }
    } catch (Exception $e) {
        echo "Error al conectar a la base de datos: " . $e->getMessage() . "\n";
    }
    
} else {
    header('Content-Type: text/html; charset=utf-8');
    ?>
    <!DOCTYPE html>
    <html>
    <head>
        <title>Gestor de Usuarios - SwimLive</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
            .container { max-width: 800px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
            h1 { color: #333; }
            .section { margin: 20px 0; padding: 15px; background: #f9f9f9; border-left: 4px solid #4CAF50; }
            .user { background: white; padding: 10px; margin: 10px 0; border-radius: 4px; border: 1px solid #ddd; }
            .hash { font-family: monospace; font-size: 12px; color: #666; word-break: break-all; }
            .success { color: #4CAF50; }
            .error { color: #f44336; }
            table { width: 100%; border-collapse: collapse; margin: 10px 0; }
            th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
            th { background: #4CAF50; color: white; }
            input[type="text"], input[type="password"] { width: 100%; padding: 8px; margin: 5px 0; box-sizing: border-box; }
            button { background: #4CAF50; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; }
            button:hover { background: #45a049; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🏊 Gestor de Usuarios - SwimLive</h1>
            
            <div class="section">
                <h2>Generar Hash de Contraseña</h2>
                <form method="GET">
                    <input type="password" name="pwd" placeholder="Ingresa una contraseña" value="<?= htmlspecialchars($_GET['pwd'] ?? '') ?>">
                    <button type="submit">Generar Hash</button>
                </form>
                <?php if (isset($_GET['pwd']) && $_GET['pwd']): ?>
                    <p><strong>Contraseña:</strong> <?= htmlspecialchars($_GET['pwd']) ?></p>
                    <p><strong>Hash:</strong></p>
                    <p class="hash"><?= generateHash($_GET['pwd']) ?></p>
                <?php endif; ?>
            </div>
            
            <div class="section">
                <h2>Usuarios Registrados</h2>
                <?php
                try {
                    $pdo = getPDO();
                    $stmt = $pdo->query("SELECT id, name, email, password, created_at FROM users ORDER BY id");
                    $users = $stmt->fetchAll();
                    
                    if (empty($users)) {
                        echo '<p class="error">No hay usuarios registrados.</p>';
                    } else {
                        echo '<table>';
                        echo '<tr><th>ID</th><th>Nombre</th><th>Email</th><th>Verificación</th><th>Creado</th></tr>';
                        
                        foreach ($users as $user) {
                            echo '<tr>';
                            echo '<td>' . $user['id'] . '</td>';
                            echo '<td>' . htmlspecialchars($user['name']) . '</td>';
                            echo '<td>' . htmlspecialchars($user['email']) . '</td>';
                            
                            // Verificar contraseñas comunes
                            $testPasswords = ['test123', '123456', 'password'];
                            $verified = [];
                            foreach ($testPasswords as $pwd) {
                                if (password_verify($pwd, $user['password'])) {
                                    $verified[] = $pwd;
                                }
                            }
                            
                            echo '<td>';
                            if (!empty($verified)) {
                                echo '<span class="success">✓ Contraseña: ' . implode(', ', $verified) . '</span>';
                            } else {
                                echo '<span class="error">✗ No coincide con contraseñas comunes</span>';
                            }
                            echo '</td>';
                            
                            echo '<td>' . $user['created_at'] . '</td>';
                            echo '</tr>';
                        }
                        
                        echo '</table>';
                    }
                } catch (Exception $e) {
                    echo '<p class="error">Error: ' . htmlspecialchars($e->getMessage()) . '</p>';
                }
                ?>
            </div>
            
            <div class="section">
                <h2>Hashes de Contraseñas Comunes</h2>
                <table>
                    <tr><th>Contraseña</th><th>Hash (copiar para SQL)</th></tr>
                    <?php
                    $commonPasswords = ['test123', '123456', 'password', 'admin123'];
                    foreach ($commonPasswords as $pwd) {
                        echo '<tr>';
                        echo '<td><strong>' . htmlspecialchars($pwd) . '</strong></td>';
                        echo '<td class="hash">' . generateHash($pwd) . '</td>';
                        echo '</tr>';
                    }
                    ?>
                </table>
            </div>
            
            <div class="section">
                <h2>Script SQL para Insertar Usuario de Prueba</h2>
                <pre style="background: #f5f5f5; padding: 10px; border-radius: 4px; overflow-x: auto;">
-- Usuario: test@test.com
-- Password: test123
DELETE FROM users WHERE email = 'test@test.com';
INSERT INTO users (name, email, password) 
VALUES ('Usuario Test', 'test@test.com', '<?= generateHash('test123') ?>');</pre>
            </div>
        </div>
    </body>
    </html>
    <?php
}
?>
