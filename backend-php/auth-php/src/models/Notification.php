<?php
namespace App\Models;

class Notification
{
    public int $id;
    public int $athleteId;
    public int $competicionId;
    public int $inscripcionId;
    public string $type;
    public string $status;
    public string $title;
    public ?string $message;
    public ?string $readAt;
    public ?string $respondedAt;
    public string $createdAt;
    public string $updatedAt;
    public ?string $competitionName = null;
    public ?string $competitionStart = null;
    public ?string $competitionEnd = null;

    public static function fromArray(array $row): self
    {
        $notification = new self();
        $notification->id = (int) $row['id'];
        $notification->athleteId = (int) $row['athlete_id'];
        $notification->competicionId = (int) $row['competicion_id'];
        $notification->inscripcionId = (int) $row['inscripcion_id'];
        $notification->type = $row['notification_type'];
        $notification->status = $row['status'];
        $notification->title = $row['titulo'];
        $notification->message = $row['mensaje'] ?? null;
        $notification->readAt = $row['read_at'] ?? null;
        $notification->respondedAt = $row['responded_at'] ?? null;
        $notification->createdAt = $row['created_at'];
        $notification->updatedAt = $row['updated_at'];
        $notification->competitionName = $row['competition_name'] ?? null;
        $notification->competitionStart = $row['competition_start'] ?? null;
        $notification->competitionEnd = $row['competition_end'] ?? null;
        return $notification;
    }

    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'athleteId' => $this->athleteId,
            'competitionId' => $this->competicionId,
            'inscripcionId' => $this->inscripcionId,
            'type' => $this->type,
            'status' => $this->status,
            'title' => $this->title,
            'message' => $this->message,
            'readAt' => $this->readAt,
            'respondedAt' => $this->respondedAt,
            'createdAt' => $this->createdAt,
            'updatedAt' => $this->updatedAt,
            'competitionName' => $this->competitionName,
            'competitionStart' => $this->competitionStart,
            'competitionEnd' => $this->competitionEnd,
            'canRespond' => $this->status === 'pendiente'
        ];
    }
}
