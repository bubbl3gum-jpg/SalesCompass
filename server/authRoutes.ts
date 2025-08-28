import { Router } from "express";
import { authenticateUser, refreshAccessToken, hashPassword } from "./authService";
import { authenticate, optionalAuth } from "./authMiddleware";
import { storage } from "./storage";
import type { InsertStaff } from "@shared/schema";

export const authRouter = Router();

// Helper function to pick first present key from aliases
function pickAlias(body: any, aliases: string[]): any {
  for (const alias of aliases) {
    if (body[alias] !== undefined && body[alias] !== null && body[alias] !== '') {
      return body[alias];
    }
  }
  return undefined;
}

// Login endpoint with store authentication and multilingual field aliases
authRouter.post("/api/auth/login", async (req, res) => {
  const correlationId = `auth_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    console.log(`[${correlationId}] Login attempt initiated`);
    
    // Field alias mapping (English and Bahasa Indonesia)
    const emailAliases = ['email', 'username', 'user', 'staff_email', 'email_pegawai'];
    const passwordAliases = ['password', 'kata_sandi', 'sandi'];
    const storeCodeAliases = ['store_code', 'store_id', 'kode_gudang', 'kode_toko', 'kode_store', 'gudang_id', 'id_toko'];
    const storePasswordAliases = ['store_password', 'password_gudang', 'sandi_gudang', 'pin_gudang'];
    
    // Extract fields using aliases
    const email = pickAlias(req.body, emailAliases);
    const password = pickAlias(req.body, passwordAliases);
    const storeCodeOrId = pickAlias(req.body, storeCodeAliases);
    const storePassword = pickAlias(req.body, storePasswordAliases);
    
    console.log(`[${correlationId}] Fields extracted - email: ${email}, storeCodeOrId: ${storeCodeOrId}`);
    
    // Validate required fields
    if (!email || !password || !storeCodeOrId || !storePassword) {
      console.log(`[${correlationId}] Missing required fields`);
      return res.status(400).json({ 
        message: "Username, password, store ID, and store password are required",
        error_code: "MISSING_FIELDS"
      });
    }
    
    // Normalize fields (trim whitespace, lowercase email/store but NOT passwords)
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedStoreCodeOrId = storeCodeOrId.trim().toUpperCase(); // Keep uppercase for store codes
    const normalizedPassword = password.trim(); // Don't alter password case
    const normalizedStorePassword = storePassword.trim(); // Don't alter password case
    
    console.log(`[${correlationId}] Fields normalized - email: ${normalizedEmail}, store: ${normalizedStoreCodeOrId}`);

    // Authenticate user with store
    const result = await authenticateUser(
      normalizedEmail, 
      normalizedPassword, 
      normalizedStoreCodeOrId, 
      normalizedStorePassword,
      correlationId
    );
    
    console.log(`[${correlationId}] Authentication successful, token issued`);

    // Set refresh token as httpOnly cookie
    res.cookie("refreshToken", result.tokens.refresh, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    // Return access token and user info
    res.json({
      access_token: result.tokens.access,
      user: result.user
    });

  } catch (error: any) {
    console.error(`[${correlationId}] Login error:`, error.message);
    
    // Return appropriate error message based on error code
    const errorMap: Record<string, { status: number, message: string }> = {
      'STORE_NOT_FOUND': { status: 404, message: 'Store code not found. Please check your Store Information.' },
      'STORE_PASSWORD_INVALID': { status: 401, message: 'Invalid store password. Please check your Store Information.' },
      'USER_NOT_FOUND_OR_PASSWORD_INVALID': { status: 401, message: 'Invalid user credentials. Please check your username and password in User Credentials.' },
      'USER_INACTIVE': { status: 403, message: 'User account is inactive' },
      'USER_NOT_AUTHORIZED_FOR_STORE': { status: 403, message: 'User not authorized for this store' }
    };
    
    const errorResponse = errorMap[error.code] || { status: 500, message: 'Login failed' };
    return res.status(errorResponse.status).json({ 
      message: errorResponse.message,
      error_code: error.code || 'LOGIN_FAILED',
      correlation_id: correlationId
    });
  }
});

// Get current user info
authRouter.get("/api/auth/me", authenticate, (req, res) => {
  res.json(req.auth);
});

// Legacy endpoint for compatibility (redirects to /api/auth/me)
authRouter.get("/api/auth/user", authenticate, (req, res) => {
  res.json(req.auth);
});

// Refresh access token
authRouter.post("/api/auth/refresh", async (req, res) => {
  try {
    const refreshToken = req.cookies?.refreshToken || req.body.refresh_token;
    
    if (!refreshToken) {
      return res.status(401).json({ message: "Refresh token required" });
    }

    const result = await refreshAccessToken(refreshToken);

    res.json({
      access_token: result.access,
      user: result.user
    });

  } catch (error: any) {
    console.error("Refresh token error:", error);
    res.status(401).json({ message: "Invalid or expired refresh token" });
  }
});

// Logout endpoint
authRouter.post("/api/auth/logout", authenticate, (req, res) => {
  // Clear refresh token cookie
  res.clearCookie("refreshToken");
  
  // Could also blacklist the token here if needed
  res.json({ message: "Logged out successfully" });
});

// Store switch endpoint (requires re-authentication)
authRouter.post("/api/auth/switch-store", authenticate, async (req, res) => {
  try {
    const { password, store_id, store_password } = req.body;
    
    if (!password || !store_id || !store_password) {
      return res.status(400).json({ 
        message: "Password, store ID, and store password are required" 
      });
    }

    // Check if user can switch stores
    if (!req.auth!.can_access_all_stores && req.auth!.store_id !== store_id) {
      return res.status(403).json({ 
        message: "You don't have permission to switch to this store" 
      });
    }

    // Re-authenticate with new store
    const result = await authenticateUser(req.auth!.email, password, store_id, store_password);

    // Update refresh token
    res.cookie("refreshToken", result.tokens.refresh, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.json({
      access_token: result.tokens.access,
      user: result.user
    });

  } catch (error: any) {
    console.error("Store switch error:", error);
    
    if (error.message === "Invalid store" || error.message === "Invalid store credentials") {
      return res.status(401).json({ message: "Invalid store credentials" });
    }
    
    if (error.message === "Invalid credentials") {
      return res.status(401).json({ message: "Invalid password" });
    }
    
    res.status(500).json({ message: "Store switch failed" });
  }
});

// Check permissions endpoint
authRouter.get("/api/auth/permissions", authenticate, (req, res) => {
  res.json({
    role: req.auth!.role,
    permissions: req.auth!.perms,
    store_id: req.auth!.store_id,
    can_access_all_stores: req.auth!.can_access_all_stores
  });
});

// Register new staff member (admin only)
authRouter.post("/api/auth/register-staff", authenticate, async (req, res) => {
  try {
    // Check if user is admin
    if (req.auth!.role !== "Admin") {
      return res.status(403).json({ message: "Only administrators can register new staff" });
    }

    const { 
      nik, 
      email, 
      password, 
      namaLengkap, 
      kota, 
      alamat, 
      noHp, 
      tempatLahir, 
      tanggalLahir, 
      tanggalMasuk, 
      jabatan 
    } = req.body;

    // Validate required fields
    if (!nik || !email || !password || !namaLengkap || !jabatan) {
      return res.status(400).json({ 
        message: "NIK, email, password, full name, and position are required" 
      });
    }

    // Check if staff already exists
    const existingByNik = await storage.getStaffByNik(nik);
    if (existingByNik) {
      return res.status(400).json({ message: "Staff with this NIK already exists" });
    }

    const existingByEmail = await storage.getStaffByEmail(email);
    if (existingByEmail) {
      return res.status(400).json({ message: "Staff with this email already exists" });
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create staff
    const staffData: InsertStaff = {
      nik,
      email,
      password: hashedPassword,
      namaLengkap,
      kota: kota || "",
      alamat: alamat || "",
      noHp: noHp || "",
      tempatLahir: tempatLahir || "",
      tanggalLahir: tanggalLahir || new Date().toISOString().split('T')[0],
      tanggalMasuk: tanggalMasuk || new Date().toISOString().split('T')[0],
      jabatan
    };

    const newStaff = await storage.createStaff(staffData);

    // Return staff without password
    const { password: _, ...staffWithoutPassword } = newStaff;
    res.status(201).json(staffWithoutPassword);

  } catch (error) {
    console.error("Staff registration error:", error);
    res.status(500).json({ message: "Failed to register staff" });
  }
});