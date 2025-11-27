<?php
namespace App\Models;

class SwimmingRanking
{
    public int $id;
    public string $gender;
    public int $distance;
    public string $stroke;
    public string $poolConfiguration;
    public int $overallRank;
    public string $countryCode;
    public string $athleteName;
    public ?int $age;
    public string $timeText;
    public ?int $points;
    public ?string $tag;
    public ?string $recordTag;
    public ?string $competition;
    public ?string $locationCountryCode;
    public ?string $raceDate;
    public ?int $athleteId;
    public ?string $athleteProfileUrl;
    public ?string $imageUrl;
    public ?string $createdAt;
    public ?string $updatedAt;

    public static function fromArray(array $row): self
    {
        $model = new self();
        $model->id = (int) ($row['id'] ?? 0);
        $model->gender = (string) ($row['gender'] ?? ($row['athlete_gender'] ?? ''));
        $model->distance = (int) ($row['distance'] ?? 0);
        $model->stroke = (string) ($row['stroke'] ?? '');
        $model->poolConfiguration = (string) ($row['pool_configuration'] ?? $row['poolConfiguration'] ?? '');
        $model->overallRank = (int) ($row['overall_rank'] ?? $row['overallRank'] ?? 0);
        $model->countryCode = (string) ($row['athlete_country_code'] ?? $row['country_code'] ?? $row['countryCode'] ?? '');
        $model->athleteName = (string) ($row['athlete_name_join'] ?? $row['athlete_name'] ?? $row['athleteName'] ?? '');
        $model->age = isset($row['athlete_age']) ? (int) $row['athlete_age'] : (isset($row['age']) ? (int) $row['age'] : null);
        $model->timeText = (string) ($row['time_text'] ?? $row['timeText'] ?? '');
        $model->points = isset($row['points']) ? (int) $row['points'] : null;
        $model->tag = $row['tag'] ?? null;
        $model->recordTag = $row['record_tag'] ?? $row['recordTag'] ?? null;
        $model->competition = $row['competition'] ?? null;
        $model->locationCountryCode = $row['location_country_code'] ?? $row['locationCountryCode'] ?? $row['location'] ?? null;
        $model->raceDate = $row['race_date'] ?? $row['raceDate'] ?? $row['date'] ?? null;
        $model->athleteId = isset($row['athlete_id']) ? (int) $row['athlete_id'] : (isset($row['athleteId']) ? (int) $row['athleteId'] : null);
        $model->athleteProfileUrl = $row['athlete_profile_url'] ?? $row['athlete_profile_url_join'] ?? $row['athleteProfileUrl'] ?? $row['profileUrl'] ?? null;
        $model->imageUrl = $row['athlete_image_url'] ?? $row['image_url'] ?? $row['imageUrl'] ?? null;
        $model->createdAt = $row['created_at'] ?? null;
        $model->updatedAt = $row['updated_at'] ?? null;

        return $model;
    }

    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'gender' => $this->gender,
            'distance' => $this->distance,
            'stroke' => $this->stroke,
            'poolConfiguration' => $this->poolConfiguration,
            'overallRank' => $this->overallRank,
            'country' => $this->countryCode,
            'countryCode' => $this->countryCode,
            'name' => $this->athleteName,
            'age' => $this->age,
            'time' => $this->timeText,
            'timeText' => $this->timeText,
            'points' => $this->points,
            'tag' => $this->tag,
            'recordTag' => $this->recordTag,
            'competition' => $this->competition,
            'location' => $this->locationCountryCode,
            'locationCountryCode' => $this->locationCountryCode,
            'date' => $this->raceDate,
            'raceDate' => $this->raceDate,
            'athleteId' => $this->athleteId,
            'profileUrl' => $this->athleteProfileUrl,
            'athleteProfileUrl' => $this->athleteProfileUrl,
            'imageUrl' => $this->imageUrl,
            'createdAt' => $this->createdAt,
            'updatedAt' => $this->updatedAt,
        ];
    }
}
