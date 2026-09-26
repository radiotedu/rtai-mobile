import { Router, type NextFunction, type RequestHandler, type Response } from 'express';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { db } from '../db';
import { authenticateAccessToken, extractBearerToken, type AuthRequest } from '../middleware/auth';
import { requireWebCsrf, webAuthMiddleware } from '../services/webSession';
import { sendError, sendSuccess } from '../utils/response';

const router = Router();

type LibraryAuthRequest = AuthRequest & { webCookieAuth?: boolean };

function verifyJukeboxAccessToken(token: string) {
    const encodedSecret = String(process.env.JUKEBOX_JWT_SECRET_B64 ?? '').trim();
    if (!encodedSecret) throw new Error('Jukebox token validation is not configured');
    const secret = Buffer.from(encodedSecret, 'base64').toString('utf8');
    const decoded = jwt.verify(token, secret, {
        algorithms: ['HS256'],
        issuer: process.env.JUKEBOX_JWT_ISSUER?.trim() || 'radiotedu-api',
        audience: process.env.JUKEBOX_JWT_AUDIENCE?.trim() || 'radiotedu-client',
    });
    if (
        typeof decoded === 'string' ||
        typeof decoded.id !== 'string' || !decoded.id.trim() ||
        typeof decoded.email !== 'string' || !decoded.email.trim() ||
        typeof decoded.role !== 'string' || !decoded.role.trim()
    ) {
        throw new Error('Invalid Jukebox access token');
    }
    return decoded as NonNullable<AuthRequest['user']>;
}

function libraryAuthMiddleware(req: LibraryAuthRequest, res: Response, next: NextFunction) {
    const authorization = String(req.headers.authorization ?? '');
    const hasBearer = /^Bearer\s+/i.test(authorization);
    const token = extractBearerToken(authorization);
    if (!hasBearer) return webAuthMiddleware(req, res, next);
    if (!token) return sendError(res, 'No token provided', 401);

    void authenticateAccessToken(token)
        .then((claims) => {
            req.user = claims;
            return next();
        })
        .catch((error: unknown) => {
            if (!(error instanceof jwt.JsonWebTokenError)) return next(error);
            try {
                req.user = verifyJukeboxAccessToken(token);
                return next();
            } catch {
                return sendError(res, 'Invalid or expired token', 401);
            }
        });
}
const contentKind = z.enum(['station', 'podcast_show', 'podcast_episode']);
const identifier = z.string().trim().min(1).max(255);
const optionalText = z.string().trim().max(500).optional().nullable();

const favoriteBody = z.object({
    title: optionalText,
    subtitle: optionalText,
    artwork_url: optionalText,
});

const progressBody = z.object({
    position_seconds: z.coerce.number().min(0).max(60 * 60 * 24 * 30),
    duration_seconds: z.coerce.number().min(0).max(60 * 60 * 24 * 30),
    completed: z.boolean().optional().default(false),
    title: optionalText,
    subtitle: optionalText,
    artwork_url: optionalText,
});

const historyBody = z.object({
    kind: contentKind,
    content_id: identifier,
    title: optionalText,
    subtitle: optionalText,
    artwork_url: optionalText,
    event_type: z.enum(['play', 'resume', 'complete']).default('play'),
    position_seconds: z.coerce.number().min(0).nullable().optional(),
    duration_seconds: z.coerce.number().min(0).nullable().optional(),
});

function validationError(res: Response, error: unknown) {
    const message = error instanceof z.ZodError
        ? error.issues[0]?.message ?? 'Invalid request'
        : 'Invalid request';
    return sendError(res, message, 400);
}

router.get('/library', libraryAuthMiddleware, async (req: AuthRequest, res: Response) => {
    const [favorites, progress] = await Promise.all([
        db.query(
            `SELECT kind, content_id, title, subtitle, artwork_url, created_at
             FROM user_favorites
             WHERE user_id = $1
             ORDER BY created_at DESC`,
            [req.user!.id],
        ),
        db.query(
            `SELECT episode_id AS content_id, title, subtitle, artwork_url,
                    position_seconds, duration_seconds, completed, updated_at
             FROM listening_progress
             WHERE user_id = $1
             ORDER BY updated_at DESC`,
            [req.user!.id],
        ),
    ]);
    return sendSuccess(res, { favorites: favorites.rows, progress: progress.rows });
});

router.put('/favorites/:kind/:contentId', libraryAuthMiddleware, requireWebCsrf, async (req: AuthRequest, res: Response) => {
    try {
        const kind = contentKind.parse(req.params.kind);
        const contentId = identifier.parse(req.params.contentId);
        const body = favoriteBody.parse(req.body ?? {});
        const result = await db.query(
            `INSERT INTO user_favorites
                (user_id, kind, content_id, title, subtitle, artwork_url)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (user_id, kind, content_id) DO UPDATE
             SET title = EXCLUDED.title,
                 subtitle = EXCLUDED.subtitle,
                 artwork_url = EXCLUDED.artwork_url
             RETURNING kind, content_id, title, subtitle, artwork_url, created_at`,
            [req.user!.id, kind, contentId, body.title ?? null, body.subtitle ?? null, body.artwork_url ?? null],
        );
        return sendSuccess(res, result.rows[0], 'Favorite saved');
    } catch (error) {
        return validationError(res, error);
    }
});

router.delete('/favorites/:kind/:contentId', libraryAuthMiddleware, requireWebCsrf, async (req: AuthRequest, res: Response) => {
    try {
        const kind = contentKind.parse(req.params.kind);
        const contentId = identifier.parse(req.params.contentId);
        const result = await db.query(
            'DELETE FROM user_favorites WHERE user_id = $1 AND kind = $2 AND content_id = $3',
            [req.user!.id, kind, contentId],
        );
        return sendSuccess(res, { removed: (result.rowCount ?? 0) > 0 }, 'Favorite removed');
    } catch (error) {
        return validationError(res, error);
    }
});

router.put('/progress/:episodeId', libraryAuthMiddleware, requireWebCsrf, async (req: AuthRequest, res: Response) => {
    try {
        const episodeId = identifier.parse(req.params.episodeId);
        const body = progressBody.parse(req.body);
        const result = await db.query(
            `INSERT INTO listening_progress
                (user_id, episode_id, position_seconds, duration_seconds, completed, title, subtitle, artwork_url, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
             ON CONFLICT (user_id, episode_id) DO UPDATE
             SET position_seconds = EXCLUDED.position_seconds,
                 duration_seconds = EXCLUDED.duration_seconds,
                 completed = EXCLUDED.completed,
                 title = EXCLUDED.title,
                 subtitle = EXCLUDED.subtitle,
                 artwork_url = EXCLUDED.artwork_url,
                 updated_at = NOW()
             RETURNING episode_id AS content_id, position_seconds, duration_seconds, completed, updated_at`,
            [
                req.user!.id,
                episodeId,
                Math.floor(body.position_seconds),
                Math.floor(body.duration_seconds),
                body.completed,
                body.title ?? null,
                body.subtitle ?? null,
                body.artwork_url ?? null,
            ],
        );
        return sendSuccess(res, result.rows[0], 'Listening progress saved');
    } catch (error) {
        return validationError(res, error);
    }
});

router.get('/history', libraryAuthMiddleware, async (req: AuthRequest, res: Response) => {
    const parsedLimit = Number.parseInt(String(req.query.limit ?? '50'), 10);
    const limit = Math.max(1, Math.min(Number.isFinite(parsedLimit) ? parsedLimit : 50, 200));
    const result = await db.query(
        `SELECT id, kind, content_id, title, subtitle, artwork_url, event_type,
                position_seconds, duration_seconds, listened_at
         FROM listening_history
         WHERE user_id = $1
         ORDER BY listened_at DESC
         LIMIT $2`,
        [req.user!.id, limit],
    );
    return sendSuccess(res, { items: result.rows });
});

router.post('/history', libraryAuthMiddleware, requireWebCsrf, async (req: AuthRequest, res: Response) => {
    try {
        const body = historyBody.parse(req.body);
        const result = await db.query(
            `INSERT INTO listening_history
                (user_id, kind, content_id, title, subtitle, artwork_url, event_type,
                 position_seconds, duration_seconds)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING id, listened_at`,
            [
                req.user!.id,
                body.kind,
                body.content_id,
                body.title ?? null,
                body.subtitle ?? null,
                body.artwork_url ?? null,
                body.event_type,
                body.position_seconds == null ? null : Math.floor(body.position_seconds),
                body.duration_seconds == null ? null : Math.floor(body.duration_seconds),
            ],
        );
        return sendSuccess(res, result.rows[0], 'Listening event recorded', null, 201);
    } catch (error) {
        return validationError(res, error);
    }
});

router.delete('/history', libraryAuthMiddleware, requireWebCsrf, async (req: AuthRequest, res: Response) => {
    const result = await db.query('DELETE FROM listening_history WHERE user_id = $1', [req.user!.id]);
    return sendSuccess(res, { removed: result.rowCount ?? 0 }, 'Listening history cleared');
});

export default router;

