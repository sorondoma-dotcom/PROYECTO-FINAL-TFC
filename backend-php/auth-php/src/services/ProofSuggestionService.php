<?php

namespace App\Services;

use App\Repositories\AthleteResultRepository;
use App\Repositories\SwimmingRankingRepository;
use PDO;

/**
 * Servicio de sugerencias de inscripción para atletas
 * Analiza resultados históricos y rankings para recomendar pruebas óptimas
 * 
 * @author Senior PHP 8 Developer
 * @version 2.0
 */
class ProofSuggestionService
{
    private PDO $pdo;
    private AthleteResultRepository $resultRepository;
    private SwimmingRankingRepository $rankingRepository;

    // Configuración de pesos del algoritmo de scoring
    private const WEIGHTS = [
        'EXACT_MATCH' => 40,           // Coincidencia exacta distancia + estilo
        'RANKING_EXISTS' => 30,        // Tiene ranking mundial
        'RECENT_RESULT' => 15,         // Resultado reciente (<2 años)
        'MEDAL_GOLD' => 50,
        'MEDAL_SILVER' => 35,
        'MEDAL_BRONZE' => 25,
        'MEDAL_OTHER' => 10,
        'RANKING_TOP10' => 60,
        'RANKING_TOP50' => 40,
        'RANKING_TOP100' => 25,
        'RANKING_TOP500' => 15,
        'RECORD_BONUS' => 45,
        'SIMILAR_DISTANCE' => 8,       // Distancia similar (±1 nivel)
        'POOL_TYPE_MATCH' => 12,       // Mismo tipo de piscina
    ];

    // Mapeo bidireccional normalizado de estilos
    private const STYLE_MAPPINGS = [
        // Español -> Inglés (normalizado)
        'libre' => 'freestyle',
        'mariposa' => 'butterfly',
        'espalda' => 'backstroke',
        'pecho' => 'breaststroke',
        'braza' => 'breaststroke',
        'estilos' => 'medley',
        'combinado' => 'medley',
        'individual medley' => 'medley',
        // Inglés ya normalizado
        'freestyle' => 'freestyle',
        'butterfly' => 'butterfly',
        'backstroke' => 'backstroke',
        'breaststroke' => 'breaststroke',
        'medley' => 'medley',
    ];

    // Configuración de tipos de piscina
    private const POOL_TYPES = [
        '25m' => ['SCM', '25m', '25'],
        '50m' => ['LCM', '50m', '50'],
    ];

    public function __construct()
    {
        $this->pdo = getPDO();
        $this->resultRepository = new AthleteResultRepository();
        $this->rankingRepository = new SwimmingRankingRepository();
    }

    /**
     * Obtiene sugerencias de inscripción para un atleta en una competición
     * 
     * @param int $athleteId ID del atleta
     * @param int $competicionId ID de la competición
     * @return array Array con sugerencias por prueba
     */
    public function getSuggestionsForAthlete(int $athleteId, int $competicionId): array
    {
        // Obtener información del atleta
        $athlete = $this->getAthleteInfo($athleteId);
        if (!$athlete) {
            return ['error' => 'Atleta no encontrado', 'suggestions' => []];
        }

        // Obtener pruebas disponibles de la competición
        $proofs = $this->getCompetitionProofs($competicionId);
        if (empty($proofs)) {
            return ['suggestions' => [], 'message' => 'No hay pruebas disponibles'];
        }

        // Obtener tipo de piscina de la competición
        $poolType = $this->getCompetitionPoolType($competicionId);

        // Obtener resultados históricos del atleta
        $results = $this->resultRepository->getResultsByAthleteId($athleteId);
        
        // Obtener rankings del atleta
        $rankings = $this->rankingRepository->getRankingsByAthleteId($athleteId);

        // Generar sugerencias para cada prueba
        $suggestions = [];
        foreach ($proofs as $proof) {
            $suggestion = $this->generateProofSuggestion($proof, $athlete, $results, $rankings, $poolType);
            if ($suggestion['score'] > 0) {
                $suggestions[] = $suggestion;
            }
        }

        // Ordenar por score descendente
        usort($suggestions, function($a, $b) {
            return $b['score'] <=> $a['score'];
        });

        return [
            'suggestions' => $suggestions,
            'athlete' => $athlete,
            'totalProofs' => count($proofs)
        ];
    }

    /**
     * Genera sugerencia inteligente para una prueba específica
     */
    private function generateProofSuggestion(
        array $proof,
        array $athlete,
        array $results,
        array $rankings,
        string $poolType
    ): array {
        $distancia = (int)$proof['distancia'];
        $estilo = $proof['estilo'];
        $genero = $proof['genero'];

        // Verificar compatibilidad de género (Mixto acepta ambos)
        if (!$this->isGenderCompatible($genero, $athlete['gender'])) {
            return [
                'prueba_id' => $proof['id'],
                'nombre_prueba' => $proof['nombre_prueba'],
                'score' => 0,
                'recommendation' => 'No apto',
                'reasons' => ['Género no compatible']
            ];
        }

        $score = 0;
        $reasons = [];
        $bestTime = null;
        $recentResults = 0;
        $medals = 0;
        $hasRanking = false;
        $topRankingPosition = null;

        // Normalizar estilo para comparaciones
        $normalizedStroke = $this->normalizeStroke($estilo);

        // ANÁLISIS 1: Buscar en resultados históricos
        foreach ($results as $result) {
            $event = $result->event ?? '';
            $timeText = $result->timeText ?? '';
            $raceDate = $result->raceDate ?? '';
            $resultPoolType = $result->poolLength ?? '';
            
            // Extraer distancia y estilo del evento con parsing robusto
            $eventData = $this->parseEvent($event);
            
            if ($eventData && $this->matchesProof($eventData, $distancia, $normalizedStroke)) {
                // Coincidencia exacta: distancia + estilo
                $score += self::WEIGHTS['EXACT_MATCH'];
                
                // Bonus si el tipo de piscina coincide
                if ($resultPoolType && $this->isPoolTypeMatch($resultPoolType, $poolType)) {
                    $score += self::WEIGHTS['POOL_TYPE_MATCH'];
                }
                
                // Actualizar mejor tiempo
                if ($timeText && ($bestTime === null || $this->compareSwimTimes($timeText, $bestTime) < 0)) {
                    $bestTime = $timeText;
                }

                // Puntos por resultados recientes (últimos 2 años)
                if ($raceDate && strtotime($raceDate) > strtotime('-2 years')) {
                    $recentResults++;
                    $score += self::WEIGHTS['RECENT_RESULT'];
                }

                // Análisis de medallas con sistema de pesos mejorado
                if (!empty($result->medal)) {
                    $medals++;
                    $medalScore = match(strtolower(trim($result->medal))) {
                        'gold' => self::WEIGHTS['MEDAL_GOLD'],
                        'silver' => self::WEIGHTS['MEDAL_SILVER'],
                        'bronze' => self::WEIGHTS['MEDAL_BRONZE'],
                        default => self::WEIGHTS['MEDAL_OTHER']
                    };
                    $score += $medalScore;
                    $reasons[] = "Medalla {$result->medal} en esta prueba";
                }

                // Bonus por récords
                if (!empty($result->recordTags)) {
                    $score += self::WEIGHTS['RECORD_BONUS'];
                    $reasons[] = "Récord: {$result->recordTags}";
                }
            } elseif ($eventData && $this->isSimilarDistance($eventData['distance'], $distancia)) {
                // Distancia similar con mismo estilo
                if ($this->normalizeStroke($eventData['stroke']) === $normalizedStroke) {
                    $score += self::WEIGHTS['SIMILAR_DISTANCE'];
                }
            }
        }

        // ANÁLISIS 2: Buscar en rankings mundiales
        foreach ($rankings as $ranking) {
            $rankingStroke = $this->normalizeStroke($ranking->stroke ?? '');
            
            if ($ranking->distance == $distancia && $rankingStroke === $normalizedStroke) {
                $hasRanking = true;
                $score += self::WEIGHTS['RANKING_EXISTS'];

                // Sistema de scoring progresivo por posición en ranking
                $position = (int)($ranking->overallRank ?? 0);
                if ($topRankingPosition === null || $position < $topRankingPosition) {
                    $topRankingPosition = $position;
                }

                if ($position <= 10) {
                    $score += self::WEIGHTS['RANKING_TOP10'];
                    $reasons[] = "🏆 Top 10 mundial (#{$position})";
                } elseif ($position <= 50) {
                    $score += self::WEIGHTS['RANKING_TOP50'];
                    $reasons[] = "⭐ Top 50 mundial (#{$position})";
                } elseif ($position <= 100) {
                    $score += self::WEIGHTS['RANKING_TOP100'];
                    $reasons[] = "📊 Top 100 mundial (#{$position})";
                } elseif ($position <= 500) {
                    $score += self::WEIGHTS['RANKING_TOP500'];
                    $reasons[] = "Top 500 mundial (#{$position})";
                }

                // Bonus si el tipo de piscina del ranking coincide con la competición
                $rankingPool = $ranking->poolConfiguration ?? '';
                if ($rankingPool && $this->isPoolTypeMatch($rankingPool, $poolType)) {
                    $score += self::WEIGHTS['POOL_TYPE_MATCH'];
                }

                // Actualizar mejor tiempo del ranking
                $rankingTime = $ranking->timeText ?? '';
                if ($rankingTime && ($bestTime === null || $this->compareSwimTimes($rankingTime, $bestTime) < 0)) {
                    $bestTime = $rankingTime;
                }
                
                // Solo contar la mejor posición de ranking
                break;
            }
        }

        // ANÁLISIS 3: Construir metadata de razones
        if ($score > 0) {
            if ($bestTime) {
                $reasons[] = "⏱️ Mejor tiempo: $bestTime";
            }
            if ($recentResults > 0) {
                $reasons[] = "📅 {$recentResults} resultado(s) reciente(s)";
            }
            if ($hasRanking && $topRankingPosition) {
                $reasons[] = "🌍 Ranking mundial activo";
            }
        }

        return [
            'prueba_id' => $proof['id'],
            'nombre_prueba' => $proof['nombre_prueba'],
            'distancia' => $distancia,
            'estilo' => $estilo,
            'genero' => $genero,
            'score' => $score,
            'bestTime' => $bestTime,
            'recentResults' => $recentResults,
            'medals' => $medals,
            'hasRanking' => $hasRanking,
            'topRankingPosition' => $topRankingPosition,
            'reasons' => array_values(array_unique($reasons)),
            'recommendation' => $this->getRecommendationLevel($score)
        ];
    }



    /**
     * Compara dos tiempos de natación (formato mm:ss.ms)
     * Retorna -1 si time1 < time2, 0 si iguales, 1 si time1 > time2
     */
    private function compareSwimTimes(?string $time1, ?string $time2): int
    {
        if ($time1 === null || $time2 === null) return 0;

        $seconds1 = $this->timeToSeconds($time1);
        $seconds2 = $this->timeToSeconds($time2);

        return $seconds1 <=> $seconds2;
    }

    /**
     * Convierte tiempo de natación a segundos
     */
    private function timeToSeconds(string $time): float
    {
        // Formato: mm:ss.ms o hh:mm:ss.ms
        $parts = explode(':', $time);
        
        if (count($parts) === 2) {
            // mm:ss.ms
            return (float)$parts[0] * 60 + (float)$parts[1];
        } elseif (count($parts) === 3) {
            // hh:mm:ss.ms
            return (float)$parts[0] * 3600 + (float)$parts[1] * 60 + (float)$parts[2];
        }

        return (float)$time;
    }

    /**
     * Determina el nivel de recomendación basado en el score
     */
    private function getRecommendationLevel(int $score): string
    {
        if ($score >= 100) {
            return 'Altamente recomendado';
        } elseif ($score >= 50) {
            return 'Recomendado';
        } elseif ($score >= 20) {
            return 'Considerar';
        } else {
            return 'Opcional';
        }
    }

    /**
     * Obtiene información del atleta
     */
    private function getAthleteInfo(int $athleteId): ?array
    {
        $stmt = $this->pdo->prepare("
            SELECT athlete_id, athlete_name, gender, country_code 
            FROM atletas 
            WHERE athlete_id = :athlete_id
        ");
        $stmt->execute(['athlete_id' => $athleteId]);
        return $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
    }

    /**
     * Obtiene las pruebas de una competición
     */
    private function getCompetitionProofs(int $competicionId): array
    {
        $stmt = $this->pdo->prepare("
            SELECT id, nombre_prueba, distancia, estilo, genero 
            FROM competiciones_pruebas 
            WHERE competicion_id = :competicion_id
            ORDER BY distancia, estilo
        ");
        $stmt->execute(['competicion_id' => $competicionId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Obtiene el tipo de piscina de la competición
     */
    private function getCompetitionPoolType(int $competicionId): string
    {
        $stmt = $this->pdo->prepare("
            SELECT tipo_piscina 
            FROM competiciones_agendadas 
            WHERE id = :id
        ");
        $stmt->execute(['id' => $competicionId]);
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        return $result['tipo_piscina'] ?? '50m';
    }

    /**
     * Normaliza un estilo de natación a formato canónico (lowercase)
     * Maneja variaciones en español e inglés
     */
    private function normalizeStroke(string $stroke): string
    {
        $normalized = strtolower(trim($stroke));
        return self::STYLE_MAPPINGS[$normalized] ?? $normalized;
    }

    /**
     * Verifica compatibilidad de género entre prueba y atleta
     * "Mixto" acepta cualquier género
     */
    private function isGenderCompatible(string $proofGender, string $athleteGender): bool
    {
        if (strtolower(trim($proofGender)) === 'mixto') {
            return true;
        }
        return $proofGender === $athleteGender;
    }

    /**
     * Verifica si el tipo de piscina coincide
     * Normaliza 25m/SCM y 50m/LCM
     */
    private function isPoolTypeMatch(?string $pool1, ?string $pool2): bool
    {
        if (!$pool1 || !$pool2) {
            return false;
        }
        
        $normalized1 = $this->normalizePoolType($pool1);
        $normalized2 = $this->normalizePoolType($pool2);
        return $normalized1 === $normalized2;
    }

    /**
     * Normaliza tipos de piscina a formato estándar
     */
    private function normalizePoolType(string $poolType): string
    {
        $normalized = strtoupper(trim($poolType));
        
        // 25m variations
        if (in_array($normalized, ['SCM', '25M', '25'])) {
            return '25m';
        }
        
        // 50m variations
        if (in_array($normalized, ['LCM', '50M', '50'])) {
            return '50m';
        }
        
        return $poolType;
    }

    /**
     * Parsea un evento de resultados para extraer distancia y estilo
     * Ejemplos: "Women 400 Freestyle", "Men 200 Butterfly"
     * 
     * @return array|null ['distance' => int, 'stroke' => string, 'gender' => string]
     */
    private function parseEvent(string $event): ?array
    {
        $event = trim($event);
        
        // Extraer distancia (buscar número seguido de m/metres/meters opcional)
        if (!preg_match('/\b(\d+)\s*(?:m|metres?|meters?)?\b/i', $event, $distanceMatch)) {
            return null;
        }
        $distance = (int)$distanceMatch[1];
        
        // Extraer estilo (buscar palabras clave de estilos)
        $strokeKeywords = ['freestyle', 'butterfly', 'backstroke', 'breaststroke', 'medley'];
        $foundStroke = null;
        
        foreach ($strokeKeywords as $keyword) {
            if (stripos($event, $keyword) !== false) {
                $foundStroke = $keyword;
                break;
            }
        }
        
        if (!$foundStroke) {
            return null;
        }
        
        // Extraer género
        $gender = null;
        if (stripos($event, 'women') !== false || stripos($event, 'girls') !== false) {
            $gender = 'F';
        } elseif (stripos($event, 'men') !== false || stripos($event, 'boys') !== false) {
            $gender = 'M';
        }
        
        return [
            'distance' => $distance,
            'stroke' => $foundStroke,
            'gender' => $gender
        ];
    }

    /**
     * Verifica si un evento parseado coincide con una prueba
     */
    private function matchesProof(array $eventData, int $targetDistance, string $targetStroke): bool
    {
        return $eventData['distance'] === $targetDistance && 
               $this->normalizeStroke($eventData['stroke']) === $targetStroke;
    }

    /**
     * Determina si dos distancias son similares
     * Usa escalas de proximidad: 50-100, 100-200, 200-400, 400-800, 800-1500
     */
    private function isSimilarDistance(int $distance1, int $distance2): bool
    {
        if ($distance1 === $distance2) {
            return false; // No es "similar", es exacta
        }
        
        $similarGroups = [
            [50, 100],
            [100, 200],
            [200, 400],
            [400, 800],
            [800, 1500]
        ];
        
        foreach ($similarGroups as $group) {
            if (in_array($distance1, $group) && in_array($distance2, $group)) {
                return true;
            }
        }
        
        return false;
    }
}
