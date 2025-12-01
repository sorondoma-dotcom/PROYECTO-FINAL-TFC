<?php
namespace App\Controllers;

use App\Services\NotificationService;

class NotificationController
{
    public function __construct(private NotificationService $notifications) {}

    public function listForCurrentUser(): void
    {
        $athleteId = $_SESSION['athlete_id'] ?? null;
        if (!$athleteId) {
            jsonResponse([
                'notifications' => [],
                'pending' => 0
            ]);
        }

        $result = $this->notifications->listForAthlete((int) $athleteId);
        jsonResponse($result);
    }

    public function markAsRead(int $notificationId): void
    {
        $athleteId = $_SESSION['athlete_id'] ?? null;
        if (!$athleteId) {
            http_response_code(403);
            jsonResponse(['error' => 'No tienes permisos para esta acción.']);
        }

        $notification = $this->notifications->markAsRead($notificationId, (int) $athleteId);
        if (!$notification) {
            http_response_code(404);
            jsonResponse(['error' => 'Notificación no encontrada']);
        }

        jsonResponse(['notification' => $notification]);
    }

    public function respond(int $notificationId): void
    {
        $athleteId = $_SESSION['athlete_id'] ?? null;
        if (!$athleteId) {
            http_response_code(403);
            jsonResponse(['error' => 'No tienes permisos para esta acción.']);
        }

        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        $action = $body['action'] ?? '';

        try {
            $notification = $this->notifications->respondToConfirmation($notificationId, (int) $athleteId, $action);
            jsonResponse(['notification' => $notification]);
        } catch (\InvalidArgumentException $e) {
            http_response_code(400);
            jsonResponse(['error' => $e->getMessage()]);
        } catch (\RuntimeException $e) {
            http_response_code(404);
            jsonResponse(['error' => $e->getMessage()]);
        }
    }
}
