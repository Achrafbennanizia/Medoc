import { db } from "./db";

export async function logAudit(params: {
    userId: string;
    action: string;
    entity: string;
    entityId?: string;
    details?: string;
}) {
    await db.auditLog.create({
        data: {
            userId: params.userId,
            action: params.action,
            entity: params.entity,
            entityId: params.entityId,
            details: params.details,
        },
    });
}
