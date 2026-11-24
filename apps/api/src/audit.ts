import { memoryStore } from './store';

export function recordAuditLog(params: {
  businessId: string;
  userId?: string | null;
  action: string;
  entity?: string | null;
  entityId?: string | null;
  details?: any;
  ip?: string | null;
}) {
  memoryStore.auditLogs.unshift({
    id: memoryStore.auditLogs.length + 1,
    businessId: params.businessId,
    userId: params.userId,
    action: params.action,
    entity: params.entity,
    entityId: params.entityId,
    details: params.details,
    ip: params.ip,
    createdAt: new Date().toISOString(),
  });
}
