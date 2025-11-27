<?php

namespace App\Models;

/**
 * Modelo para representar los resultados de un atleta
 */
class AthleteResult
{
    public ?int $id = null;
    public ?int $athleteId = null;
    public ?string $event = null;
    public ?string $timeText = null;
    public ?string $recordTags = null;
    public ?string $medal = null;
    public ?string $poolLength = null;
    public ?int $ageAtResult = null;
    public ?string $competition = null;
    public ?string $compCountryCode = null;
    public ?string $raceDate = null;
    public ?string $createdAt = null;
    public ?string $updatedAt = null;

    /**
     * Crea un objeto AthleteResult desde un array asociativo
     * 
     * @param array $row Array con los datos del resultado
     * @return AthleteResult
     */
    public static function fromArray(array $row): self
    {
        $model = new self();
        
        $model->id = isset($row['id']) ? (int) $row['id'] : null;
        $model->athleteId = isset($row['athlete_id']) ? (int) $row['athlete_id'] : null;
        $model->event = $row['event'] ?? null;
        $model->timeText = $row['time_text'] ?? null;
        $model->recordTags = $row['record_tags'] ?? null;
        $model->medal = $row['medal'] ?? null;
        $model->poolLength = $row['pool_length'] ?? null;
        $model->ageAtResult = isset($row['age_at_result']) ? (int) $row['age_at_result'] : null;
        $model->competition = $row['competition'] ?? null;
        $model->compCountryCode = $row['comp_country_code'] ?? null;
        $model->raceDate = $row['race_date'] ?? null;
        $model->createdAt = $row['created_at'] ?? null;
        $model->updatedAt = $row['updated_at'] ?? null;

        return $model;
    }

    /**
     * Convierte el modelo a un array asociativo para JSON
     * 
     * @return array
     */
    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'athleteId' => $this->athleteId,
            'event' => $this->event,
            'timeText' => $this->timeText,
            'recordTags' => $this->recordTags,
            'medal' => $this->medal,
            'poolLength' => $this->poolLength,
            'ageAtResult' => $this->ageAtResult,
            'competition' => $this->competition,
            'compCountryCode' => $this->compCountryCode,
            'raceDate' => $this->raceDate,
            'createdAt' => $this->createdAt,
            'updatedAt' => $this->updatedAt
        ];
    }
}
