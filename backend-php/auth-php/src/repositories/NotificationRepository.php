<?php
namespace App\Repositories;

use App\Models\Notification;
use PDO;

class NotificationRepository
{
    private function logDebug(string $message): void
    {
        $logDir = dirname(__DIR__, 2) . '/data';
        if (!is_dir($logDir) && !@mkdir($logDir, 0755, true) && !is_dir($logDir)) {
            return; // logging best-effort only
        }

        $line = sprintf('[%s] %s%s', date('c'), $message, PHP_EOL);
        @file_put_contents($logDir . '/notification_debug.log', $line, FILE_APPEND | LOCK_EX);
    }

    public function __construct(private PDO $pdo) {}

    public function findByIdAndAthlete(int $notificationId, int $athleteId): ?Notification
    {
        $stmt = $this->pdo->prepare('SELECT n.* FROM athlete_notifications n WHERE n.id = ? AND n.athlete_id = ? LIMIT 1');
        $stmt->execute([$notificationId, $athleteId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ? Notification::fromArray($row) : null;
    }

    public function findByInscriptionId(int $inscripcionId): ?Notification
    {
        $stmt = $this->pdo->prepare('SELECT * FROM athlete_notifications WHERE inscripcion_id = ? LIMIT 1');
        $stmt->execute([$inscripcionId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ? Notification::fromArray($row) : null;
    }

    public function createOrResetPending(int $athleteId, int $competicionId, int $inscripcionId, string $title, ?string $message): Notification
    {
        $this->logDebug(sprintf(
            'createOrResetPending called with athlete=%d, competicion=%d, inscripcion=%d',
            $athleteId,
            $competicionId,
            $inscripcionId
        ));

        $existing = $this->findByInscriptionId($inscripcionId);
        if ($existing) {
            $this->logDebug(sprintf('resetting existing notification id=%d', $existing->id));
            $stmt = $this->pdo->prepare(
                'UPDATE athlete_notifications
                 SET status = "pendiente",
                     titulo = :title,
                     mensaje = :message,
                     read_at = NULL,
                     responded_at = NULL,
                     updated_at = NOW()
                 WHERE id = :id'
            );
            $stmt->execute([
                'title' => $title,
                'message' => $message,
                'id' => $existing->id,
            ]);

            $this->logDebug(sprintf('update affected %d row(s)', $stmt->rowCount()));

            return $this->findById((int) $existing->id);
        }

        $stmt = $this->pdo->prepare(
            'INSERT INTO athlete_notifications (athlete_id, competicion_id, inscripcion_id, titulo, mensaje)
             VALUES (:athlete_id, :competicion_id, :inscripcion_id, :title, :message)'
        );
        $stmt->execute([
            'athlete_id' => $athleteId,
            'competicion_id' => $competicionId,
            'inscripcion_id' => $inscripcionId,
            'title' => $title,
            'message' => $message,
        ]);

        $this->logDebug(sprintf('insert affected %d row(s)', $stmt->rowCount()));

        $id = (int) $this->pdo->lastInsertId();
        $this->logDebug(sprintf('new notification id=%d', $id));
        return $this->findById($id);
    }

    public function findByAthlete(int $athleteId): array
    {
        $stmt = $this->pdo->prepare(
            'SELECT n.*, c.nombre AS competition_name, c.fecha_inicio AS competition_start, c.fecha_fin AS competition_end
             FROM athlete_notifications n
             INNER JOIN competiciones_agendadas c ON c.id = n.competicion_id
             WHERE n.athlete_id = ?
             ORDER BY n.created_at DESC'
        );
        $stmt->execute([$athleteId]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return array_map(static fn(array $row) => Notification::fromArray($row), $rows);
    }

    public function markAsRead(int $notificationId, int $athleteId): ?Notification
    {
        $stmt = $this->pdo->prepare('UPDATE athlete_notifications SET read_at = COALESCE(read_at, NOW()) WHERE id = ? AND athlete_id = ?');
        $stmt->execute([$notificationId, $athleteId]);
        return $this->findByIdAndAthlete($notificationId, $athleteId);
    }

    public function updateStatus(int $notificationId, int $athleteId, string $status): ?Notification
    {
        $respondedAt = in_array($status, ['aceptada', 'rechazada'], true)
            ? date('Y-m-d H:i:s')
            : null;

        $this->logDebug(sprintf(
            'updateStatus id=%d athlete=%d status=%s respondedAt=%s',
            $notificationId,
            $athleteId,
            $status,
            $respondedAt ?? 'NULL'
        ));

        $stmt = $this->pdo->prepare(
            'UPDATE athlete_notifications
             SET status = :status,
                 responded_at = :responded_at,
                 read_at = COALESCE(read_at, NOW())
             WHERE id = :id AND athlete_id = :athlete'
        );
        $stmt->execute([
            'status' => $status,
            'responded_at' => $respondedAt,
            'id' => $notificationId,
            'athlete' => $athleteId,
        ]);

        $this->logDebug(sprintf('updateStatus affected %d row(s)', $stmt->rowCount()));

        return $this->findByIdAndAthlete($notificationId, $athleteId);
    }

    public function deleteByInscriptionId(int $inscripcionId): void
    {
        $stmt = $this->pdo->prepare('DELETE FROM athlete_notifications WHERE inscripcion_id = ?');
        $stmt->execute([$inscripcionId]);
    }

    private function findById(int $id): ?Notification
    {
        $stmt = $this->pdo->prepare(
            'SELECT n.*, c.nombre AS competition_name, c.fecha_inicio AS competition_start, c.fecha_fin AS competition_end
             FROM athlete_notifications n
             LEFT JOIN competiciones_agendadas c ON c.id = n.competicion_id
             WHERE n.id = ? LIMIT 1'
        );
        $stmt->execute([$id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ? Notification::fromArray($row) : null;
    }
}
