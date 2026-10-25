// backend/src/shared/services/lessons-library.service.ts

/**
 * Client for the KAIROS ML service's Lessons Learned search (GET /lessons-search).
 *
 * Same rules as risk-prediction.service.ts:
 *  - The ML service is OPTIONAL. If it is down, slow or answers badly, this service never throws.
 *    It returns `{ available: false }` so the page can show a friendly message.
 *  - The browser never calls the ML service. Only the backend does.
 *  - The ML response is validated, because it comes from a separate process.
 *
 * Privacy: the ML service also returns the id and title of the incident each lesson came from.
 * They are deliberately dropped here. A lesson is meant to be shared with everyone, but the incident
 * behind it belongs to one department.
 *
 * Configuration (read at call time, so dotenv has already loaded):
 *  - AI_SERVICE_URL         Base URL of the ML service. Default: http://localhost:8001
 *  - AI_SERVICE_TIMEOUT_MS  Request timeout in milliseconds. Default: 8000
 */

export interface LessonResult {
  lesson: string;
  category: string;
  department: string;
  /** 0-100. How closely the lesson matches the search text. */
  matchPercent: number;
}

export type LessonsUnavailableReason = 'SERVICE_UNREACHABLE' | 'SERVICE_ERROR' | 'INVALID_RESPONSE';

export type LessonsSearchResult =
  | { available: true; query: string; results: LessonResult[] }
  | { available: false; reason: LessonsUnavailableReason; message: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

/**
 * Validates the raw JSON from GET /lessons-search and maps it to LessonResult[].
 * Returns null if the overall shape is wrong. Individual malformed items are skipped, and the same
 * lesson text is only listed once (the first, which is the best match, is kept).
 */
export const parseMlLessonsResponse = (raw: unknown): LessonResult[] | null => {
  if (!isRecord(raw) || !Array.isArray(raw.results)) return null;

  const results: LessonResult[] = [];
  const seen = new Set<string>();

  for (const item of raw.results as unknown[]) {
    if (!isRecord(item)) continue;

    const lesson = item.lesson;
    const score = item.relevance_score;
    if (typeof lesson !== 'string' || lesson.trim() === '' || !isFiniteNumber(score)) continue;

    const text = lesson.trim();
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    results.push({
      lesson: text,
      category: typeof item.category === 'string' ? item.category : '',
      department: typeof item.department === 'string' ? item.department : '',
      matchPercent: Math.min(100, Math.max(0, Math.round(score * 100))),
    });
  }

  return results;
};

const unavailable = (reason: LessonsUnavailableReason, message: string): LessonsSearchResult => ({
  available: false,
  reason,
  message,
});

export class LessonsLibraryService {
  private getBaseUrl(): string {
    return (process.env.AI_SERVICE_URL || 'http://localhost:8001').replace(/\/+$/, '');
  }

  private getTimeoutMs(): number {
    const parsed = Number(process.env.AI_SERVICE_TIMEOUT_MS);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 8000;
  }

  /**
   * Searches the lessons library. Never throws: any ML-service problem is returned as
   * `{ available: false, reason, message }`.
   */
  async search(query: string): Promise<LessonsSearchResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.getTimeoutMs());

    try {
      const response = await fetch(
        `${this.getBaseUrl()}/lessons-search?q=${encodeURIComponent(query)}`,
        { method: 'GET', signal: controller.signal }
      );

      if (!response.ok) {
        console.warn(`[lessons-library] ML service responded with HTTP ${response.status}`);
        return unavailable(
          'SERVICE_ERROR',
          `The lessons service returned an error (HTTP ${response.status}).`
        );
      }

      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        return unavailable('INVALID_RESPONSE', 'The lessons service returned an unreadable response.');
      }

      const results = parseMlLessonsResponse(payload);
      if (!results) {
        console.warn('[lessons-library] ML service response did not match the expected shape');
        return unavailable('INVALID_RESPONSE', 'The lessons service returned an unexpected response.');
      }

      return { available: true, query, results };
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      console.warn(`[lessons-library] ML service unreachable: ${detail}`);
      return unavailable('SERVICE_UNREACHABLE', 'The lessons service could not be reached.');
    } finally {
      clearTimeout(timer);
    }
  }
}

export const lessonsLibraryService = new LessonsLibraryService();
