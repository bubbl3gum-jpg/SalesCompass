import { Request, Response, NextFunction } from "express";
import { verifyAccessToken, hasPermission, canAccessStore, type TokenPayload } from "./authService";

// Extend Express Request type to include auth
declare global {
  namespace Express {
    interface Request {
      auth?: TokenPayload;
      storeId?: string; // The store the user is authorized to access
    }
  }
}

// Main authentication middleware
export function authenticate(req: Request, res: Response, next: NextFunction) {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No token provided" });
    }

    const token = authHeader.substring(7); // Remove "Bearer " prefix
    
    // Verify token
    const payload = verifyAccessToken(token);
    
    // Attach to request
    req.auth = payload;
    req.storeId = payload.store_id;
    
    next();
  } catch (error) {
    console.error("Authentication error:", error);
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

// Permission-based authorization middleware
export function authorize(...requiredPermissions: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    // Check if user has any of the required permissions
    const userPermissions = req.auth.perms || req.auth.permissions || [];
    const hasRequiredPermission = requiredPermissions.some(perm => 
      hasPermission(userPermissions, perm)
    );

    if (!hasRequiredPermission) {
      return res.status(403).json({ 
        message: "Insufficient permissions",
        required: requiredPermissions,
        userRole: req.auth.role
      });
    }

    next();
  };
}

// Store-scoped authorization middleware
export function authorizeStore(allowAdminOverride = true) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    // Get the store from the request (body, params, or query)
    const requestedStoreId = req.body.kodeGudang || 
                            req.params.storeId || 
                            req.query.storeId as string;

    // If no store specified, use the user's store
    const storeToCheck = requestedStoreId || req.auth.store_id;

    // Check store access
    const userStoreId = req.auth.store_id || req.auth.storeId || '';
    const hasAccess = canAccessStore(
      userStoreId,
      storeToCheck || '',
      allowAdminOverride && Boolean(req.auth.can_access_all_stores || req.auth.canAccessAllStores || false)
    );

    if (!hasAccess) {
      return res.status(403).json({ 
        message: "Access denied to this store",
        userStore: req.auth.store_id,
        requestedStore: storeToCheck
      });
    }

    // Override the storeId for downstream use (enforce store scoping)
    if (!req.auth.can_access_all_stores) {
      req.storeId = req.auth.store_id;
    } else {
      req.storeId = storeToCheck;
    }

    next();
  };
}

// Combined auth and permission check
export function requireAuth(...permissions: string[]) {
  return [authenticate, authorize(...permissions)];
}

// Combined auth and store check
export function requireStoreAuth(...permissions: string[]) {
  if (permissions.length > 0) {
    return [authenticate, authorize(...permissions), authorizeStore()];
  }
  return [authenticate, authorizeStore()];
}

// Admin-only middleware
export function adminOnly(req: Request, res: Response, next: NextFunction) {
  if (!req.auth) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  if (req.auth.role !== "Admin") {
    return res.status(403).json({ 
      message: "Admin access required",
      userRole: req.auth.role
    });
  }

  next();
}

// Middleware to enforce store scoping in queries
export function scopeToStore(req: Request, res: Response, next: NextFunction) {
  if (!req.auth) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  // For non-admin users, enforce store scoping
  if (!req.auth.can_access_all_stores) {
    // Override any store parameters with the user's store
    if (req.body) req.body.kodeGudang = req.auth.store_id;
    if (req.query) req.query.storeId = req.auth.store_id;
    
    // Set storeId for use in handlers
    req.storeId = req.auth.store_id;
  }

  next();
}

// Optional auth middleware (for public endpoints that can use auth if available)
export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      const payload = verifyAccessToken(token);
      req.auth = payload;
      req.storeId = payload.store_id;
    }
  } catch (error) {
    // Ignore errors for optional auth
    console.debug("Optional auth failed:", error);
  }
  
  next();
}