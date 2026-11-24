import { z } from 'zod';
import { ROLES, MENU_KEYS } from '../constants';

export const menuPermissionSchema = z.object({
  menuKey: z.enum(MENU_KEYS),
  canView: z.boolean().default(false),
  canCreate: z.boolean().default(false),
  canEdit: z.boolean().default(false),
  canDelete: z.boolean().default(false),
  canExport: z.boolean().default(false),
});
export type MenuPermission = z.infer<typeof menuPermissionSchema>;

export const createUserSchema = z.object({
  name: z.string().min(1, 'Full name is required'),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username must be alphanumeric with underscores or dashes'),
  email: z.string().email('Invalid email address'),
  role: z.enum(ROLES),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters'),
  isActive: z.boolean().default(true),
  mustChangePassword: z.boolean().default(false),
  permissions: z.array(menuPermissionSchema).optional(),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  role: z.enum(ROLES).optional(),
  isActive: z.boolean().optional(),
  mustChangePassword: z.boolean().optional(),
});
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const resetPasswordSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
  mustChangePassword: z.boolean().default(true),
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const updatePermissionsSchema = z.object({
  permissions: z.array(menuPermissionSchema),
});
export type UpdatePermissionsInput = z.infer<typeof updatePermissionsSchema>;
