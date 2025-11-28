<?php
namespace App\Controllers;

use App\Services\ProofService;

class ProofController
{
    public function __construct(private ProofService $proofService) {}

    public function createProof(): void
    {
        $input = json_decode(file_get_contents('php://input'), true) ?? [];

        try {
            $competicion_id = (int) ($input['competicion_id'] ?? 0);
            $nombre_prueba = trim($input['nombre_prueba'] ?? '');
            $distancia = (int) ($input['distancia'] ?? 0);
            $estilo = trim($input['estilo'] ?? '');
            $genero = trim($input['genero'] ?? 'Mixto');

            if (!$competicion_id || !$nombre_prueba || !$distancia || !$estilo) {
                jsonResponse(['error' => 'Faltan parámetros requeridos'], 400);
                return;
            }

            $proof = $this->proofService->createProof($competicion_id, $nombre_prueba, $distancia, $estilo, $genero);
            jsonResponse(['success' => true, 'proof' => $proof], 201);
        } catch (\InvalidArgumentException $e) {
            jsonResponse(['error' => $e->getMessage()], 400);
        } catch (\RuntimeException $e) {
            jsonResponse(['error' => $e->getMessage()], 409);
        } catch (\Throwable $e) {
            jsonResponse(['error' => 'Error al crear prueba', 'message' => $e->getMessage()], 500);
        }
    }

    public function getProof(int $proofId): void
    {
        try {
            $proof = $this->proofService->getProof($proofId);
            jsonResponse(['success' => true, 'proof' => $proof]);
        } catch (\RuntimeException $e) {
            jsonResponse(['error' => $e->getMessage()], 404);
        } catch (\Throwable $e) {
            jsonResponse(['error' => 'Error al obtener prueba'], 500);
        }
    }

    public function getProofsByCompetition(int $competicionId): void
    {
        try {
            $proofs = $this->proofService->getProofsByCompetition($competicionId);
            jsonResponse(['success' => true, 'proofs' => $proofs, 'total' => count($proofs)]);
        } catch (\Throwable $e) {
            jsonResponse(['error' => 'Error al obtener pruebas'], 500);
        }
    }

    public function updateProof(int $proofId): void
    {
        $input = json_decode(file_get_contents('php://input'), true) ?? [];

        try {
            $proof = $this->proofService->updateProof($proofId, $input);
            jsonResponse(['success' => true, 'proof' => $proof]);
        } catch (\InvalidArgumentException $e) {
            jsonResponse(['error' => $e->getMessage()], 400);
        } catch (\RuntimeException $e) {
            jsonResponse(['error' => $e->getMessage()], 404);
        } catch (\Throwable $e) {
            jsonResponse(['error' => 'Error al actualizar prueba'], 500);
        }
    }

    public function deleteProof(int $proofId): void
    {
        try {
            $result = $this->proofService->deleteProof($proofId);
            jsonResponse($result);
        } catch (\RuntimeException $e) {
            jsonResponse(['error' => $e->getMessage()], 404);
        } catch (\Throwable $e) {
            jsonResponse(['error' => 'Error al eliminar prueba'], 500);
        }
    }

    public function registerAthleteToProof(int $proofId): void
    {
        $input = json_decode(file_get_contents('php://input'), true) ?? [];

        try {
            $inscriptionAtleticaId = (int) ($input['inscripcion_atletica_id'] ?? 0);

            if (!$inscriptionAtleticaId) {
                jsonResponse(['error' => 'inscripcion_atletica_id es requerido'], 400);
                return;
            }

            $result = $this->proofService->registerAthleteToProof($proofId, $inscriptionAtleticaId);
            jsonResponse($result, 201);
        } catch (\RuntimeException $e) {
            jsonResponse(['error' => $e->getMessage()], 409);
        } catch (\Throwable $e) {
            jsonResponse(['error' => 'Error al inscribir atleta'], 500);
        }
    }

    public function unregisterAthleteFromProof(int $proofProofId): void
    {
        try {
            $result = $this->proofService->unregisterAthleteFromProof($proofProofId);
            jsonResponse($result);
        } catch (\RuntimeException $e) {
            jsonResponse(['error' => $e->getMessage()], 404);
        } catch (\Throwable $e) {
            jsonResponse(['error' => 'Error al desinscribir atleta'], 500);
        }
    }
}
