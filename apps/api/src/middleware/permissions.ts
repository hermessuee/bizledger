import { MiddlewareHandler } from 'hono';
import { MenuKey } from '@bizledger/shared';
import { AppContext } from '../types';

export type PermissionAction = 'view' | 'create' | 'edit' | 'delete' | 'export';

const ACTION_MAP: Record<PermissionAction, 'canView' | 'canCreate' | 'canEdit' | 'canDelete' | 'canExport'> = {
  view: 'canView',
  create: 'canCreate',
  edit: 'canEdit',
  delete: 'canDelete',
  export: 'canExport',
};

export function requirePermission(
  menuKey: MenuKey,
  action: PermissionAction = 'view'
): MiddlewareHandler<AppContext> {
  return async (c, next) => {
    const user = c.get('user');
    if (!user) {
      return c.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        401
      );
    }

    // Owner role has full bypass
    if (user.role === 'owner') {
      return next();
    }

    const permField = ACTION_MAP[action];
    const userMenuPerm = user.permissions?.[menuKey];

    if (!userMenuPerm || !userMenuPerm[permField]) {
      return c.json(
        {
          error: {
            code: 'FORBIDDEN',
            message: `Permission denied: Cannot ${action} ${menuKey}`,
          },
        },
        403
      );
    }

    await next();
  };
}
