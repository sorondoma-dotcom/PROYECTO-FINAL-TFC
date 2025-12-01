<?php
namespace App\Services;

use App\Models\Competition;
use App\Models\Inscription;
use App\Models\Notification;
use App\Repositories\InscriptionRepository;
use App\Repositories\NotificationRepository;

class NotificationService
{
    public function __construct(
        private NotificationRepository $notifications,
        private InscriptionRepository $inscriptions
    ) {}

    public function createInscriptionConfirmation(Competition $competition, Inscription $inscription): Notification
    {
        $title = 'Confirmar participación';
        $message = sprintf(
            'Has sido inscrito en la competición "%s". Confirma si deseas participar.',
            $competition->nombre
        );

        return $this->notifications->createOrResetPending(
            $inscription->athlete_id,
            $competition->id,
            $inscription->id,
            $title,
            $message
        );
    }

    /**
     * @return array{notifications: array<int, array<string, mixed>>, pending: int}
     */
    public function listForAthlete(int $athleteId): array
    {
        $notifications = $this->notifications->findByAthlete($athleteId);
        $pending = 0;
        $payload = [];

        foreach ($notifications as $notification) {
            if ($notification->status === 'pendiente') {
                $pending++;
            }
            $payload[] = $notification->toArray();
        }

        return [
            'notifications' => $payload,
            'pending' => $pending
        ];
    }

    public function markAsRead(int $notificationId, int $athleteId): ?array
    {
        $notification = $this->notifications->markAsRead($notificationId, $athleteId);
        return $notification?->toArray();
    }

    public function respondToConfirmation(int $notificationId, int $athleteId, string $action): array
    {
        $notification = $this->notifications->findByIdAndAthlete($notificationId, $athleteId);
        if (!$notification) {
            throw new \RuntimeException('Notificación no encontrada');
        }

        $inscription = $this->inscriptions->findById($notification->inscripcionId);
        if (!$inscription) {
            throw new \RuntimeException('Inscripción no encontrada');
        }

        $newStatus = match ($action) {
            'accept' => 'aceptada',
            'reject' => 'rechazada',
            default => throw new \InvalidArgumentException('Acción no válida')
        };

        $notification = $this->notifications->updateStatus($notificationId, $athleteId, $newStatus);

        if ($action === 'accept') {
            $this->inscriptions->update($inscription->id, [
                'estado_inscripcion' => 'confirmado',
                'confirmado_en' => date('Y-m-d H:i:s')
            ]);
        } else {
            $this->inscriptions->update($inscription->id, [
                'estado_inscripcion' => 'retirado',
                'confirmado_en' => null
            ]);
        }

        $updated = $notification?->toArray();
        if (!$updated) {
            throw new \RuntimeException('No se pudo actualizar la notificación');
        }

        return $updated;
    }

    public function syncWithInscription(Inscription $inscription): void
    {
        $notification = $this->notifications->findByInscriptionId($inscription->id);
        if (!$notification) {
            return;
        }

        $status = match ($inscription->estado_inscripcion) {
            'confirmado' => 'aceptada',
            'retirado', 'descalificado' => 'rechazada',
            default => 'pendiente'
        };

        $this->notifications->updateStatus($notification->id, $inscription->athlete_id, $status);
    }

    public function deleteByInscription(int $inscripcionId): void
    {
        $this->notifications->deleteByInscriptionId($inscripcionId);
    }
}
