<?php
namespace App\Services;

use App\Repositories\CompetitionRepository;
use App\Repositories\InscriptionRepository;
use DateTime;

class CompetitionService
{
    public function __construct(
        private CompetitionRepository $competitions,
        private InscriptionRepository $inscriptions,
        private ?NotificationService $notifications = null
    ) {}

    public function createCompetition(
        string $nombre,
        ?string $descripcion,
        ?string $pais,
        ?string $ciudad,
        string $tipo_piscina,
        string $fecha_inicio,
        ?string $fecha_fin,
        ?string $lugar_evento,
        string $logo_path,
        ?int $creada_por
    ): array {
        // Validar nombre único
        if ($this->competitions->findByNombre($nombre)) {
            throw new \RuntimeException('Una competición con ese nombre ya existe');
        }

        // Validar fechas
        $start = new DateTime($fecha_inicio);
        if ($fecha_fin) {
            $end = new DateTime($fecha_fin);
            if ($end < $start) {
                throw new \InvalidArgumentException('La fecha de fin no puede ser anterior a la de inicio');
            }
        }
        $competition = $this->competitions->create(
            $nombre, $descripcion, $pais, $ciudad, $tipo_piscina,
            $fecha_inicio, $fecha_fin, $lugar_evento, $logo_path, $creada_por
        );

        return [
            'success' => true,
            'competition' => $competition->toArray(),
            'message' => 'Competición agendada exitosamente'
        ];
    }

    public function updateCompetition(int $id, array $data): array
    {
        $competition = $this->competitions->findById($id);
        if (!$competition) {
            throw new \RuntimeException('Competici?n no encontrada');
        }

        // Si cambia el nombre, validar unicidad
        if (isset($data['nombre']) && $data['nombre'] !== $competition->nombre) {
            if ($this->competitions->findByNombre($data['nombre'])) {
                throw new \RuntimeException('Una competici?n con ese nombre ya existe');
            }
        }

        // Validar fechas si se actualizan
        if (isset($data['fecha_inicio']) && isset($data['fecha_fin'])) {
            $start = new DateTime($data['fecha_inicio']);
            $end = new DateTime($data['fecha_fin']);
            if ($end < $start) {
                throw new \InvalidArgumentException('La fecha de fin no puede ser anterior a la de inicio');
            }
        }

        $payload = $data;
        $replacedLogo = null;

        if (array_key_exists('remove_logo', $payload)) {
            $removeLogo = $this->toBoolean($payload['remove_logo']);
            unset($payload['remove_logo']);

            if ($removeLogo) {
                $payload['logo_path'] = null;
                if (!empty($competition->logo_path)) {
                    $replacedLogo = $competition->logo_path;
                }
            }
        }

        if (array_key_exists('logo_path', $payload)) {
            if ($payload['logo_path'] === '' || $payload['logo_path'] === null) {
                $payload['logo_path'] = null;
            }

            if ($competition->logo_path !== ($payload['logo_path'] ?? null) && !empty($competition->logo_path)) {
                $replacedLogo = $competition->logo_path;
            }
        }

        $updated = $this->competitions->update($id, $payload);

        return [
            'success' => true,
            'competition' => $updated->toArray(),
            'message' => 'Competici?n actualizada exitosamente',
            'replaced_logo' => $replacedLogo
        ];
    }

    private function toBoolean(mixed $value): bool
    {
        if (is_bool($value)) {
            return $value;
        }

        if (is_numeric($value)) {
            return (int) $value === 1;
        }

        if (is_string($value)) {
            $normalized = strtolower(trim($value));
            return in_array($normalized, ['1', 'true', 'yes', 'si', 'on'], true);
        }

        return false;
    }

    public function deleteCompetition(int $id): array
    {
        $competition = $this->competitions->findById($id);
        if (!$competition) {
            throw new \RuntimeException('Competición no encontrada');
        }

        $logoPath = $competition->logo_path ?? null;

        // Eliminar todas las inscripciones primero (en cascada)
        $this->inscriptions->deleteByCompetition($id);

        // Luego eliminar la competición
        $this->competitions->delete($id);

        return [
            'success' => true,
            'message' => 'Competición eliminada exitosamente',
            'removed_logo' => $logoPath
        ];
    }

    public function getCompetition(int $id): array
    {
        $competition = $this->competitions->findById($id);
        if (!$competition) {
            throw new \RuntimeException('Competición no encontrada');
        }

        $inscriptions = $this->inscriptions->findByCompetition($id);

        return [
            'success' => true,
            'competition' => $competition->toArray(),
            'inscriptions' => $inscriptions,
            'total_inscripciones' => count($inscriptions)
        ];
    }

    public function getAllCompetitions(string $estado = null): array
    {
        if ($estado) {
            $competitions = $this->competitions->findByStatus($estado);
        } else {
            $competitions = $this->competitions->findAll();
        }

        $result = [];
        foreach ($competitions as $comp) {
            $inscCount = $this->inscriptions->countByCompetition($comp->id, true);
            $data = $comp->toArray();
            $data['total_inscritos'] = $inscCount;
            $result[] = $data;
        }

        return [
            'success' => true,
            'competitions' => $result,
            'total' => count($result)
        ];
    }

    public function registerAthlete(int $competicion_id, int $athlete_id, ?int $numero_dorsal = null, ?string $notas = null): array
    {
        // Validar que la competición existe
        $competition = $this->competitions->findById($competicion_id);
        if (!$competition) {
            throw new \RuntimeException('Competición no encontrada');
        }

        // Validar que el atleta no esté ya inscrito
        $existing = $this->inscriptions->findByAthleteAndCompetition($athlete_id, $competicion_id);
        if ($existing) {
            if ($existing->estado_inscripcion === 'retirado') {
                $reactivateData = [
                    'estado_inscripcion' => 'inscrito',
                    'confirmado_en' => null
                ];

                if ($numero_dorsal !== null) {
                    $reactivateData['numero_dorsal'] = $numero_dorsal;
                }

                if ($notas !== null) {
                    $reactivateData['notas'] = $notas;
                }

                $reactivated = $this->inscriptions->update($existing->id, $reactivateData) ?? $existing;

                if ($this->notifications) {
                    $this->notifications->createInscriptionConfirmation($competition, $reactivated);
                }

                return [
                    'success' => true,
                    'inscription' => $reactivated->toArray(),
                    'message' => 'El atleta había rechazado la invitación. Se renovó la solicitud de confirmación.'
                ];
            }

            throw new \RuntimeException('El atleta ya está inscrito en esta competición');
        }

        $inscription = $this->inscriptions->create($competicion_id, $athlete_id, $numero_dorsal, $notas);

        if ($this->notifications) {
            $this->notifications->createInscriptionConfirmation($competition, $inscription);
        }

        return [
            'success' => true,
            'inscription' => $inscription->toArray(),
            'message' => 'Atleta inscrito exitosamente. Se envió una solicitud de confirmación.'
        ];
    }

    public function unregisterAthlete(int $inscripcion_id): array
    {
        $inscription = $this->inscriptions->findById($inscripcion_id);
        if (!$inscription) {
            throw new \RuntimeException('Inscripción no encontrada');
        }

        $this->inscriptions->delete($inscripcion_id);

        if ($this->notifications) {
            $this->notifications->deleteByInscription($inscripcion_id);
        }

        return [
            'success' => true,
            'message' => 'Atleta desinscrito exitosamente'
        ];
    }

    public function updateInscription(int $inscripcion_id, array $data): array
    {
        $inscription = $this->inscriptions->findById($inscripcion_id);
        if (!$inscription) {
            throw new \RuntimeException('Inscripción no encontrada');
        }

        $updated = $this->inscriptions->update($inscripcion_id, $data);

        if ($updated && $this->notifications) {
            $this->notifications->syncWithInscription($updated);
        }

        return [
            'success' => true,
            'inscription' => $updated->toArray(),
            'message' => 'Inscripción actualizada exitosamente'
        ];
    }

    /**
     * Actualiza automáticamente el estado de todas las competiciones según sus fechas
     */
    public function autoUpdateCompetitionStatuses(): array
    {
        $needingUpdate = $this->competitions->findCompetitionsNeedingStatusUpdate();
        $updated = $this->competitions->updateCompetitionStatuses();

        return [
            'success' => true,
            'updated' => $updated,
            'competitions' => $needingUpdate,
            'message' => sprintf('Se actualizaron %d competiciones', $updated)
        ];
    }
}


