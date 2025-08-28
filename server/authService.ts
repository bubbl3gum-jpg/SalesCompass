import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { storage } from "./storage";
import type { Staff } from "@shared/schema";

const scryptAsync = promisify(scrypt);

// Get JWT secret from environment or use a fallback for development
const JWT_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET || "dev-secret-change-in-production";
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || `${JWT_SECRET}-refresh`;

// Token expiration times
const ACCESS_TOKEN_EXPIRY = "15m"; // 15 minutes
const REFRESH_TOKEN_EXPIRY = "7d"; // 7 days

// Role to permissions mapping
const ROLE_PERMISSIONS = {
  "System Administrator": {
    role: "Admin",
    permissions: [
      "dashboard:read",
      "sales:create", "sales:read", "sales:update", "sales:delete",
      "settlement:create", "settlement:read", "settlement:update", "settlement:delete",
      "stock:read", "stock:update", "stock:opname",
      "transfer:create", "transfer:read", "transfer:update", "transfer:delete",
      "pricelist:read", "pricelist:update",
      "discount:read", "discount:update",
      "store:overview", "store:switch",
      "admin:settings", "admin:all"
    ],
    canAccessAllStores: true
  },
  "SPG": {
    role: "SPG",
    permissions: [
      "dashboard:read",
      "sales:create", "sales:read",
      "settlement:create", "settlement:read",
      "transfer:create", "transfer:read",
      "pricelist:read",
      "stock:opname",
      "discount:read"
    ],
    canAccessAllStores: false
  },
  "Supervisor": {
    role: "Supervisor", 
    permissions: [
      "dashboard:read",
      "sales:create", "sales:read",
      "settlement:create", "settlement:read", 
      "transfer:create", "transfer:read",
      "pricelist:read",
      "stock:opname",
      "discount:read",
      "store:overview"
    ],
    canAccessAllStores: false
  },
  "Stockist": {
    role: "Stockist",
    permissions: [
      "dashboard:read",
      "stock:read", "stock:update", "stock:opname",
      "transfer:create", "transfer:read", "transfer:update"
    ],
    canAccessAllStores: false
  },
  "Sales Administrator": {
    role: "Sales Administrator",
    permissions: [
      "dashboard:read",
      "sales:create", "sales:read", "sales:update",
      "settlement:create", "settlement:read", "settlement:update",
      "pricelist:read", "pricelist:update",
      "discount:read", "discount:update"
    ],
    canAccessAllStores: false
  },
  "Finance": {
    role: "Finance",
    permissions: [
      "dashboard:read",
      "sales:read",
      "settlement:read", "settlement:update",
      "store:overview"
    ],
    canAccessAllStores: false
  }
};

// Password hashing functions
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

export async function comparePasswords(supplied: string, stored: string): Promise<boolean> {
  try {
    // Check if it's a bcrypt hash (starts with $2b$ or $2a$)
    if (stored.startsWith('$2b$') || stored.startsWith('$2a$')) {
      return await bcrypt.compare(supplied, stored);
    }
    
    // Otherwise, use the legacy scrypt method
    const [hashed, salt] = stored.split(".");
    if (!hashed || !salt) return false;
    
    const hashedBuf = Buffer.from(hashed, "hex");
    const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
    return timingSafeEqual(hashedBuf, suppliedBuf);
  } catch (error) {
    console.error("Password comparison error:", error);
    return false;
  }
}

// Token generation
export interface TokenPayload {
  sub: string; // user id (nik)
  username: string;
  displayName?: string;
  email?: string;
  role: string;
  storeId?: string;
  storeName?: string;
  store_id?: string; // Alias for compatibility
  store_name?: string; // Alias for compatibility
  permissions?: string[];
  perms?: string[]; // Alias for compatibility
  canAccessAllStores?: boolean;
  can_access_all_stores?: boolean; // Alias for compatibility
  iat?: number;
  exp?: number;
}

export function generateAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { 
    expiresIn: ACCESS_TOKEN_EXPIRY,
    issuer: "salesstock-erp"
  });
}

export function generateRefreshToken(userId: string, storeId: string): string {
  return jwt.sign(
    { sub: userId, store_id: storeId },
    JWT_REFRESH_SECRET,
    { 
      expiresIn: REFRESH_TOKEN_EXPIRY,
      issuer: "salesstock-erp"
    }
  );
}

export function verifyAccessToken(token: string): TokenPayload {
  try {
    return jwt.verify(token, JWT_SECRET, { issuer: "salesstock-erp" }) as TokenPayload;
  } catch (error) {
    throw new Error("Invalid or expired token");
  }
}

export function verifyRefreshToken(token: string): { sub: string; store_id: string } {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET, { issuer: "salesstock-erp" }) as { sub: string; store_id: string };
  } catch (error) {
    throw new Error("Invalid or expired refresh token");
  }
}

// Authentication service
// Custom error class for auth errors
export class AuthError extends Error {
  code: string;
  
  constructor(message: string, code: string) {
    super(message);
    this.code = code;
    this.name = 'AuthError';
  }
}

export async function authenticateUser(
  username: string,
  password: string,
  storeCodeOrId: string,
  storePassword: string,
  correlationId?: string
): Promise<{ tokens: { access: string; refresh: string }, user: TokenPayload }> {
  const logPrefix = correlationId ? `[${correlationId}]` : '';
  console.log(`${logPrefix} Login attempt for store: ${storeCodeOrId} by user: ${username}`);
  
  // Step 1: Resolve store (always by code since stores table uses kodeGudang as primary key)
  let store: any; // Using 'any' to avoid type issues for now
  
  console.log(`${logPrefix} Looking up store by code: ${storeCodeOrId}`);
  store = await storage.getStoreByKode(storeCodeOrId);
  
  if (!store) {
    console.log(`${logPrefix} Store lookup result: NOT FOUND`);
    throw new AuthError("Store not found", "STORE_NOT_FOUND");
  }
  
  console.log(`${logPrefix} Store lookup result: found (code: ${store.kodeGudang})`);

  // Step 2: Verify store password
  console.log(`${logPrefix} Verifying store password`);
  const storePasswordValid = store.storePassword === storePassword;
  console.log(`${logPrefix} Store password verified: ${storePasswordValid}`);
  
  if (!storePasswordValid) {
    throw new AuthError("Invalid store password", "STORE_PASSWORD_INVALID");
  }

  // Step 3: Find staff by email or NIK (username could be either)
  let staff: Staff | undefined;
  
  console.log(`${logPrefix} Looking for user: ${username}`);
  
  // Try as email first (case-insensitive)
  if (username.includes('@')) {
    console.log(`${logPrefix} Searching by email: ${username}`);
    staff = await storage.getStaffByEmail(username);
  }
  
  // Try as NIK if not found
  if (!staff) {
    console.log(`${logPrefix} Searching by NIK: ${username}`);
    staff = await storage.getStaffByNik(username);
  }
  
  if (!staff) {
    console.log(`${logPrefix} User lookup result: NOT FOUND`);
    throw new AuthError("User not found or invalid password", "USER_NOT_FOUND_OR_PASSWORD_INVALID");
  }
  
  console.log(`${logPrefix} User lookup result: found (nik: ${staff.nik}, active: true)`);

  // Step 4: Verify user password
  console.log(`${logPrefix} Verifying user password`);
  const passwordValid = await comparePasswords(password, staff.password);
  console.log(`${logPrefix} Password verified: ${passwordValid}`);
  
  if (!passwordValid) {
    throw new AuthError("User not found or invalid password", "USER_NOT_FOUND_OR_PASSWORD_INVALID");
  }
  
  // Step 5: Verify user-store authorization
  console.log(`${logPrefix} Checking user-store authorization`);
  
  // For now, we'll allow all users to access all stores if they have valid credentials
  // In production, you might want to check a user-store relationship table
  const userAuthorizedForStore = true; // Simplified for now
  
  console.log(`${logPrefix} User-store authorization: ${userAuthorizedForStore}`);
  
  if (!userAuthorizedForStore) {
    throw new AuthError("User not authorized for this store", "USER_NOT_AUTHORIZED_FOR_STORE");
  }

  // Step 6: Get role permissions
  const roleConfig = ROLE_PERMISSIONS[staff.jabatan as keyof typeof ROLE_PERMISSIONS] || ROLE_PERMISSIONS["SPG"];
  
  // Step 7: Create token payload with proper claims
  const payload: TokenPayload = {
    sub: staff.nik, // Use nik as the subject
    username: staff.namaLengkap || staff.email, // Display name
    displayName: staff.namaLengkap,
    email: staff.email,
    role: staff.jabatan,
    storeId: store.kodeGudang, // Store uses kodeGudang as primary key
    storeName: store.namaGudang,
    store_id: store.kodeGudang, // Include both formats for compatibility
    store_name: store.namaGudang,
    permissions: roleConfig.permissions,
    perms: roleConfig.permissions, // Alias for compatibility  
    canAccessAllStores: roleConfig.canAccessAllStores,
    can_access_all_stores: roleConfig.canAccessAllStores, // Alias for compatibility
  };
  
  console.log(`${logPrefix} Token issued: yes`);

  // Step 8: Generate tokens (let JWT handle the iat and exp timestamps)
  const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: "24h" });
  const refreshToken = jwt.sign(
    { sub: payload.sub, store_id: store.kodeGudang }, // Use kodeGudang for store
    JWT_SECRET,
    { expiresIn: "7d" }
  );

  return {
    tokens: {
      access: accessToken,
      refresh: refreshToken
    },
    user: payload
  };
}

// Refresh token service
export async function refreshAccessToken(refreshToken: string): Promise<{ access: string; user: TokenPayload }> {
  // Verify refresh token
  const decoded = verifyRefreshToken(refreshToken);
  
  // Get staff and store
  const staff = await storage.getStaffByNik(decoded.sub);
  if (!staff) {
    throw new Error("User not found");
  }

  const store = await storage.getStoreByKode(decoded.store_id);
  if (!store) {
    throw new Error("Store not found");
  }

  // Get role permissions
  const roleConfig = ROLE_PERMISSIONS[staff.jabatan as keyof typeof ROLE_PERMISSIONS] || ROLE_PERMISSIONS["SPG"];
  
  // Build new token payload (without iat and exp which JWT will add)
  const tokenPayload: TokenPayload = {
    sub: staff.nik, // Use nik as the subject
    username: staff.namaLengkap || staff.email,
    displayName: staff.namaLengkap,
    email: staff.email,
    role: staff.jabatan,
    storeId: decoded.store_id,
    storeName: store.namaGudang || "",
    store_id: decoded.store_id,
    store_name: store.namaGudang || "",
    permissions: roleConfig.permissions,
    perms: roleConfig.permissions,
    canAccessAllStores: roleConfig.canAccessAllStores,
    can_access_all_stores: roleConfig.canAccessAllStores,
  };

  // Generate new access token
  const accessToken = generateAccessToken(tokenPayload);

  return {
    access: accessToken,
    user: tokenPayload
  };
}

// Permission checking
export function hasPermission(userPerms: string[], requiredPerm: string): boolean {
  // Admin has all permissions
  if (userPerms.includes("admin:all")) {
    return true;
  }
  
  // Check specific permission
  return userPerms.includes(requiredPerm);
}

// Store access checking
export function canAccessStore(userStoreId: string, requestedStoreId: string, canAccessAllStores: boolean): boolean {
  // Admin can access all stores
  if (canAccessAllStores) {
    return true;
  }
  
  // Otherwise, must match the user's store
  return userStoreId === requestedStoreId;
}