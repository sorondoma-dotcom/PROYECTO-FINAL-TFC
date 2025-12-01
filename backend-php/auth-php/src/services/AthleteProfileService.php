<?php

namespace App\Services;

use App\Repositories\InscriptionRepository;
use PDO;

class AthleteProfileService
{
    public function __construct(private PDO $pdo, private InscriptionRepository $inscriptions)
    {
    }

    public function getAthleteProfile(int $athleteId): ?array
    {
        $stmt = $this->pdo->prepare(
            'SELECT athlete_id,
                    athlete_name,
                    gender,
                    country_code,
                    age,
                    image_url,
                    athlete_profile_url
             FROM atletas
             WHERE athlete_id = ?
             LIMIT 1'
        );
        $stmt->execute([$athleteId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$row) {
            return null;
        }

        $upcoming = $this->inscriptions->findUpcomingByAthlete($athleteId);
        $upcomingMapped = array_map(static function (array $item): array {
            return [
                'inscriptionId' => (int) ($item['id'] ?? 0),
                'competitionId' => (int) ($item['competicion_id'] ?? 0),
                'status' => $item['estado_inscripcion'] ?? 'inscrito',
                'registeredAt' => $item['inscrito_en'] ?? null,
                'confirmedAt' => $item['confirmado_en'] ?? null,
                'competition' => [
                    'id' => (int) ($item['competicion_id'] ?? 0),
                    'nombre' => $item['nombre'] ?? '',
                    'descripcion' => $item['descripcion'] ?? null,
                    'pais' => $item['pais'] ?? null,
                    'ciudad' => $item['ciudad'] ?? null,
                    'tipo_piscina' => $item['tipo_piscina'] ?? null,
                    'fecha_inicio' => $item['fecha_inicio'] ?? null,
                    'fecha_fin' => $item['fecha_fin'] ?? null,
                    'lugar_evento' => $item['lugar_evento'] ?? null,
                    'logo_path' => $item['logo_path'] ?? null,
                    'estado' => $item['estado'] ?? null,
                ],
            ];
        }, $upcoming);

        return [
            'athlete' => [
                'athleteId' => (int) $row['athlete_id'],
                'name' => $row['athlete_name'] ?? '',
                'gender' => $row['gender'] ?? null,
                'countryCode' => $row['country_code'] ?? null,
                'age' => isset($row['age']) ? (int) $row['age'] : null,
                'imageUrl' => $row['image_url'] ?? null,
                'profileUrl' => $row['athlete_profile_url'] ?? null,
            ],
            'upcomingCompetitions' => $upcomingMapped,
        ];
    }
}
