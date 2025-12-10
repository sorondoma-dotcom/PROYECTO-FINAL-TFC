<?php
namespace App\Middlewares;

use App\Repositories\CompetitionRepository;
use PDO;

/**
 * Middleware para actualizar automáticamente el estado de las competiciones
 * Se ejecuta en cada request para mantener los estados sincronizados
 */
class CompetitionStatusMiddleware
{
    private static bool $executed = false;
    private static int $lastExecutionTime = 0;
    private const CACHE_DURATION = 60; // Segundos

    public function __construct(private PDO $pdo)
    {
    }

    /**
     * Ejecuta la actualización de estados si es necesario
     * Usa un sistema de caché para no ejecutar en cada request
     */
    public function handle(): void
    {
        // Evitar múltiples ejecuciones en el mismo request
        if (self::$executed) {
            return;
        }

        $currentTime = time();
        
        // Solo ejecutar si han pasado más de CACHE_DURATION segundos
        if (($currentTime - self::$lastExecutionTime) < self::CACHE_DURATION) {
            return;
        }

        try {
            $repository = new CompetitionRepository($this->pdo);
            $repository->updateCompetitionStatuses();
            
            self::$executed = true;
            self::$lastExecutionTime = $currentTime;
        } catch (\Exception $e) {
            // Silenciar errores para no interrumpir el flujo de la aplicación
            error_log('Error al actualizar estados de competiciones: ' . $e->getMessage());
        }
    }
}
