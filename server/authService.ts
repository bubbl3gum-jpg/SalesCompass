import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import jwt from "jsonwebtoken";
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
  email: string;
  role: string;
  store_id: string;
  store_name: string;
  perms: string[];
  can_access_all_stores: boolean;
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
export async function authenticateUser(
  username: string,
  password: string,
  storeId: string,
  storePassword: string
): Promise<{ tokens: { access: string; refresh: string }, user: TokenPayload }> {
  console.log("🏪 Login attempt for store:", storeId, "by user:", username);
  
  // Step 1: Verify store exists and password matches
  const store = await storage.getStoreByKode(storeId);
  if (!store) {
    console.log("❌ Store not found:", storeId);
    throw new Error("Invalid store");
  }

  // Check store password (exact match for now, could be hashed in production)
  console.log("🔑 Verifying store password");
  if (store.storePassword !== storePassword) {
    console.log("❌ Store password mismatch");
    throw new Error("Invalid store credentials");
  }

  // Step 2: Find staff by email or NIK (username could be either)
  let staff: Staff | undefined;
  
  console.log("👤 Looking for user:", username);
  
  // Try as email first
  if (username.includes('@')) {
    console.log("📧 Searching by email:", username);
    staff = await storage.getStaffByEmail(username);
  }
  
  // Try as NIK if not found
  if (!staff) {
    console.log("🆔 Searching by NIK:", username);
    staff = await storage.getStaffByNik(username);
  }
  
  if (!staff) {
    console.log("❌ User not found:", username);
    throw new Error("Invalid credentials");
  }
  
  console.log("✅ User found:", staff.namaLengkap, "Position:", staff.jabatan);

  // Step 3: Verify password
  console.log("🔐 Verifying password for user:", staff.email);
  const passwordValid = await comparePasswords(password, staff.password);
  console.log("🔐 Password verification result:", passwordValid);
  if (!passwordValid) {
    throw new Error("Invalid credentials");
  }

  // Step 4: Get role permissions
  const roleConfig = ROLE_PERMISSIONS[staff.jabatan as keyof typeof ROLE_PERMISSIONS] || ROLE_PERMISSIONS["SPG"];
  
  // Step 5: Build token payload
  const tokenPayload: TokenPayload = {
    sub: staff.nik,
    username: staff.namaLengkap,
    email: staff.email,
    role: roleConfig.role,
    store_id: storeId,
    store_name: store.namaGudang || "",
    perms: roleConfig.permissions,
    can_access_all_stores: roleConfig.canAccessAllStores
  };

  // Step 6: Generate tokens
  const accessToken = generateAccessToken(tokenPayload);
  const refreshToken = generateRefreshToken(staff.nik, storeId);

  return {
    tokens: {
      access: accessToken,
      refresh: refreshToken
    },
    user: tokenPayload
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
  
  // Build new token payload
  const tokenPayload: TokenPayload = {
    sub: staff.nik,
    username: staff.namaLengkap,
    email: staff.email,
    role: roleConfig.role,
    store_id: decoded.store_id,
    store_name: store.namaGudang || "",
    perms: roleConfig.permissions,
    can_access_all_stores: roleConfig.canAccessAllStores
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