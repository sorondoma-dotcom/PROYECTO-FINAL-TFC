<?php
namespace App\Services;

use PDO;

class ProofService
{
    public function __construct(private PDO $pdo) {}

    /**
     * Crear una nueva prueba en una competición
     */
    public function createProof(
        int $competicion_id,
        string $nombre_prueba,
        int $distancia,
        string $estilo,
        string $genero
    ): array {
        // Validar que la competición existe
        $stmt = $this->pdo->prepare('SELECT id FROM competiciones_agendadas WHERE id = ?');
        $stmt->execute([$competicion_id]);
        if (!$stmt->fetch()) {
            throw new \RuntimeException('Competición no encontrada');
        }

        // Validar valores
        $this->validateProofData($distancia, $estilo, $genero);

        // Verificar que no existe prueba duplicada
        $stmt = $this->pdo->prepare(
            'SELECT id FROM competiciones_pruebas 
            WHERE competicion_id = ? AND nombre_prueba = ? AND distancia = ? AND estilo = ?'
        );
        $stmt->execute([$competicion_id, $nombre_prueba, $distancia, $estilo]);
        if ($stmt->fetch()) {
            throw new \RuntimeException('Esta prueba ya existe en la competición');
        }

        // Crear prueba
        $stmt = $this->pdo->prepare(
            'INSERT INTO competiciones_pruebas (competicion_id, nombre_prueba, distancia, estilo, genero)
            VALUES (?, ?, ?, ?, ?)'
        );
        $stmt->execute([$competicion_id, $nombre_prueba, $distancia, $estilo, $genero]);

        $proofId = (int) $this->pdo->lastInsertId();
        return $this->getProof($proofId);
    }

    /**
     * Obtener una prueba específica
     */
    public function getProof(int $proofId): array
    {
        $stmt = $this->pdo->prepare('SELECT * FROM competiciones_pruebas WHERE id = ?');
        $stmt->execute([$proofId]);
        $proof = $stmt->fetch(\PDO::FETCH_ASSOC);

        if (!$proof) {
            throw new \RuntimeException('Prueba no encontrada');
        }

        // Obtener inscripciones y series
        $proof['inscripciones'] = $this->getInscriptionsForProof($proofId);
        $proof['series'] = $this->calculateSeries($proof['inscripciones']);
        $proof['total_inscripciones'] = count($proof['inscripciones']);

        return $proof;
    }

    /**
     * Obtener todas las pruebas de una competición
     */
    public function getProofsByCompetition(int $competicion_id): array
    {
        $stmt = $this->pdo->prepare(
            'SELECT * FROM competiciones_pruebas WHERE competicion_id = ? ORDER BY distancia, estilo'
        );
        $stmt->execute([$competicion_id]);
        $proofs = $stmt->fetchAll(\PDO::FETCH_ASSOC);

        foreach ($proofs as &$proof) {
            $proof['inscripciones'] = $this->getInscriptionsForProof($proof['id']);
            $proof['series'] = $this->calculateSeries($proof['inscripciones']);
            $proof['total_inscripciones'] = count($proof['inscripciones']);
        }

        return $proofs;
    }

    /**
     * Actualizar una prueba
     */
    public function updateProof(int $proofId, array $data): array
    {
        $stmt = $this->pdo->prepare('SELECT * FROM competiciones_pruebas WHERE id = ?');
        $stmt->execute([$proofId]);
        $proof = $stmt->fetch(\PDO::FETCH_ASSOC);

        if (!$proof) {
            throw new \RuntimeException('Prueba no encontrada');
        }

        // Validar datos si se proporcionan
        if (isset($data['distancia'])) {
            $this->validateDistance((int) $data['distancia']);
        }
        if (isset($data['estilo'])) {
            $this->validateStroke($data['estilo']);
        }
        if (isset($data['genero'])) {
            $this->validateGender($data['genero']);
        }

        // Verificar si se está cambiando el género
        $generoChanged = isset($data['genero']) && $data['genero'] !== $proof['genero'];
        $newGenero = $data['genero'] ?? $proof['genero'];

        // Actualizar
        $fields = [];
        $values = [];
        foreach ($data as $key => $value) {
            if (in_array($key, ['nombre_prueba', 'distancia', 'estilo', 'genero'])) {
                $fields[] = "$key = ?";
                $values[] = $value;
            }
        }

        if (!empty($fields)) {
            $values[] = $proofId;
            $stmt = $this->pdo->prepare('UPDATE competiciones_pruebas SET ' . implode(', ', $fields) . ' WHERE id = ?');
            $stmt->execute($values);
        }

        // Si el género cambió a M o F (no Mixto), eliminar inscripciones que no coincidan
        if ($generoChanged && $newGenero !== 'Mixto') {
            $this->removeIncompatibleInscriptions($proofId, $newGenero);
        }

        return $this->getProof($proofId);
    }

    /**
     * Eliminar inscripciones de atletas cuyo género no coincide con el género de la prueba
     */
    private function removeIncompatibleInscriptions(int $proofId, string $proofGender): void
    {
        // Obtener todas las inscripciones de la prueba con el género del atleta
        $stmt = $this->pdo->prepare(
            'SELECT ip.id, a.gender
            FROM inscripciones_pruebas ip
            JOIN inscripciones_atleticas ia ON ip.inscripcion_atletica_id = ia.id
            JOIN atletas a ON ia.athlete_id = a.athlete_id
            WHERE ip.prueba_id = ?'
        );
        $stmt->execute([$proofId]);
        $inscriptions = $stmt->fetchAll(\PDO::FETCH_ASSOC);

        // Eliminar inscripciones que no coincidan con el género de la prueba
        $deleteStmt = $this->pdo->prepare('DELETE FROM inscripciones_pruebas WHERE id = ?');
        
        foreach ($inscriptions as $inscription) {
            // Si el género del atleta no coincide con el género de la prueba, eliminar
            if ($inscription['gender'] !== $proofGender) {
                $deleteStmt->execute([$inscription['id']]);
            }
        }
    }

    /**
     * Eliminar una prueba
     */
    public function deleteProof(int $proofId): array
    {
        $stmt = $this->pdo->prepare('SELECT id FROM competiciones_pruebas WHERE id = ?');
        $stmt->execute([$proofId]);
        if (!$stmt->fetch()) {
            throw new \RuntimeException('Prueba no encontrada');
        }

        // Eliminar inscripciones a esta prueba (ON DELETE CASCADE)
        $stmt = $this->pdo->prepare('DELETE FROM inscripciones_pruebas WHERE prueba_id = ?');
        $stmt->execute([$proofId]);

        // Eliminar prueba
        $stmt = $this->pdo->prepare('DELETE FROM competiciones_pruebas WHERE id = ?');
        $stmt->execute([$proofId]);

        return [
            'success' => true,
            'message' => 'Prueba eliminada correctamente'
        ];
    }

    /**
     * Inscribir un atleta a una prueba
     */
    public function registerAthleteToProof(int $proofId, int $inscripcionAtleticaId): array
    {
        // Verificar que la prueba existe
        $stmt = $this->pdo->prepare('SELECT * FROM competiciones_pruebas WHERE id = ?');
        $stmt->execute([$proofId]);
        $proof = $stmt->fetch(\PDO::FETCH_ASSOC);

        if (!$proof) {
            throw new \RuntimeException('Prueba no encontrada');
        }

        // Verificar que la inscripción atlética existe
        $stmt = $this->pdo->prepare(
            'SELECT id FROM inscripciones_atleticas WHERE id = ? LIMIT 1'
        );
        $stmt->execute([$inscripcionAtleticaId]);
        if (!$stmt->fetch()) {
            throw new \RuntimeException('Inscripción atlética no encontrada');
        }

        // Verificar si ya está inscrito
        $stmt = $this->pdo->prepare(
            'SELECT id FROM inscripciones_pruebas WHERE inscripcion_atletica_id = ? AND prueba_id = ?'
        );
        $stmt->execute([$inscripcionAtleticaId, $proofId]);
        if ($stmt->fetch()) {
            throw new \RuntimeException('El atleta ya está inscrito en esta prueba');
        }

        // Insertar inscripción
        $stmt = $this->pdo->prepare(
            'INSERT INTO inscripciones_pruebas (inscripcion_atletica_id, prueba_id)
            VALUES (?, ?)'
        );
        $stmt->execute([$inscripcionAtleticaId, $proofId]);

        $inscriptionId = (int) $this->pdo->lastInsertId();

        return [
            'success' => true,
            'message' => 'Atleta inscrito a la prueba correctamente',
            'inscription_id' => $inscriptionId,
            'proof_id' => $proofId
        ];
    }

    /**
     * Desinscribir un atleta de una prueba (por ID de inscripción_prueba)
     */
    public function unregisterAthleteFromProof(int $inscriptionProofId): array
    {
        $stmt = $this->pdo->prepare(
            'SELECT prueba_id, inscripcion_atletica_id FROM inscripciones_pruebas WHERE id = ? LIMIT 1'
        );
        $stmt->execute([$inscriptionProofId]);
        $inscription = $stmt->fetch(\PDO::FETCH_ASSOC);

        if (!$inscription) {
            throw new \RuntimeException('Inscripción a prueba no encontrada');
        }

        $deleteStmt = $this->pdo->prepare('DELETE FROM inscripciones_pruebas WHERE id = ? LIMIT 1');
        $deleteStmt->execute([$inscriptionProofId]);

        return [
            'success' => true,
            'message' => 'Atleta desinscrito de la prueba',
            'removed_proof_id' => $inscription['prueba_id']
        ];
    }

    /**
     * Desinscribir un atleta de una prueba (por IDs de prueba e inscripción atlética)
     */
    public function unregisterAthleteFromProofByIds(int $proofId, int $inscriptionAtleticaId): array
    {
        $stmt = $this->pdo->prepare(
            'DELETE FROM inscripciones_pruebas WHERE prueba_id = ? AND inscripcion_atletica_id = ? LIMIT 1'
        );
        $stmt->execute([$proofId, $inscriptionAtleticaId]);

        if ($stmt->rowCount() === 0) {
            throw new \RuntimeException('No se encontró la inscripción del atleta en esta prueba');
        }

        return [
            'success' => true,
            'message' => 'Atleta desinscrito de la prueba',
            'removed_proof_id' => $proofId,
            'removed_inscripcion_atletica_id' => $inscriptionAtleticaId
        ];
    }

    /**
     * Obtener inscripciones para una prueba específica
     */
    private function getInscriptionsForProof(int $proofId): array
    {
        $stmt = $this->pdo->prepare(
            'SELECT ip.id, ip.inscripcion_atletica_id, ia.athlete_id, ia.numero_dorsal,
                    a.athlete_name, a.gender, a.country_code, a.image_url,
                    ia.estado_inscripcion, ip.tiempo_inscripcion, ip.clasificacion
            FROM inscripciones_pruebas ip
            JOIN inscripciones_atleticas ia ON ip.inscripcion_atletica_id = ia.id
            JOIN atletas a ON ia.athlete_id = a.athlete_id
            WHERE ip.prueba_id = ?
            ORDER BY ip.created_at ASC'
        );
        $stmt->execute([$proofId]);
        return $stmt->fetchAll(\PDO::FETCH_ASSOC);
    }

    /**
     * Calcular series automáticamente (8 personas por serie)
     */
    private function calculateSeries(array $inscriptions): array
    {
        $series = [];
        $currentSerie = [];
        $serieNumber = 1;

        foreach ($inscriptions as $athlete) {
            $currentSerie[] = $athlete;

            if (count($currentSerie) === 8) {
                $series[$serieNumber] = $currentSerie;
                $currentSerie = [];
                $serieNumber++;
            }
        }

        if (!empty($currentSerie)) {
            $series[$serieNumber] = $currentSerie;
        }

        return $series;
    }
    
    /**
     * Calcular próxima serie disponible
     */
    private function calculateNextSeries(int $proofId): int
    {
        $stmt = $this->pdo->prepare(
            'SELECT COUNT(*) as count FROM inscripciones_pruebas WHERE prueba_id = ?'
        );
        $stmt->execute([$proofId]);
        $result = $stmt->fetch(\PDO::FETCH_ASSOC);
        $count = (int) $result['count'];

        // Serie = (count / 8) + 1
        return intdiv($count, 8) + 1;
    }

    /**
     * Validar datos de prueba
     */
    private function validateProofData(int $distancia, string $estilo, string $genero): void
    {
        $this->validateDistance($distancia);
        $this->validateStroke($estilo);
        $this->validateGender($genero);
    }

    private function validateDistance(int $distancia): void
    {
        $validDistances = [50, 100, 200, 400, 800, 1500];
        if (!in_array($distancia, $validDistances)) {
            throw new \InvalidArgumentException('Distancia inválida. Válidas: 50, 100, 200, 400, 800, 1500');
        }
    }

    private function validateStroke(string $estilo): void
    {
        $validStrokes = ['Libre', 'Espalda', 'Pecho', 'Mariposa', 'Combinado'];
        if (!in_array($estilo, $validStrokes)) {
            throw new \InvalidArgumentException('Estilo inválido. Válidos: Libre, Espalda, Pecho, Mariposa, Combinado');
        }
    }

    private function validateGender(string $genero): void
    {
        $validGenders = ['M', 'F', 'Mixto'];
        if (!in_array($genero, $validGenders)) {
            throw new \InvalidArgumentException('Género inválido. Válidos: M, F, Mixto');
        }
    }
}
