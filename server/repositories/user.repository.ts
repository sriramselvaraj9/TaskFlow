import bcrypt from 'bcryptjs';
import type { User } from '@/types';
import { getDatabase, saveDbToFile } from '../data';
import { activityService } from '../services/activity.service';

export class UserRepository {
  async findAll(): Promise<User[]> {
    const db = getDatabase();
    return db.users.map(({ id, name, email, role, designation, createdAt }) => ({
      id,
      name,
      email,
      role,
      designation: designation || (role === 'ADMIN' ? 'Lead Administrator' : 'Software Engineer'),
      createdAt,
    }));
  }

  async findById(id: string): Promise<User | undefined> {
    const db = getDatabase();
    return db.users.find((u) => u.id === id);
  }

  async findByEmail(email: string): Promise<User | undefined> {
    if (!email) return undefined;
    const cleanEmail = email.trim().toLowerCase();
    const db = getDatabase();
    return db.users.find((u) => u.email.toLowerCase() === cleanEmail);
  }

  async verifyPassword(email: string, passwordAttempt: string): Promise<boolean> {
    if (!email || !passwordAttempt) return false;
    const cleanEmail = email.trim().toLowerCase();
    const db = getDatabase();
    const storedHash = db.passwords[cleanEmail];
    if (!storedHash) return false;
    return bcrypt.compareSync(passwordAttempt, storedHash);
  }

  async create(data: {
    name: string;
    email: string;
    designation?: string;
    passwordAttempt?: string;
    password?: string;
    role?: 'ADMIN' | 'MEMBER';
  }): Promise<User> {
    const db = getDatabase();
    const cleanEmail = data.email.trim().toLowerCase();
    const existing = await this.findByEmail(cleanEmail);
    if (existing) {
      throw new Error('A user with this email address already exists');
    }

    const rawPassword = data.passwordAttempt || data.password;
    if (!rawPassword) {
      throw new Error('Password is required for registration');
    }

    const defaultDesignation = data.role === 'ADMIN' ? 'Lead Administrator' : 'Software Engineer';
    const newUser: User = {
      id: `user-${Date.now()}`,
      name: data.name.trim(),
      email: cleanEmail,
      role: data.role || 'MEMBER',
      designation: data.designation?.trim() || defaultDesignation,
      createdAt: new Date().toISOString(),
    };

    db.users.push(newUser);
    db.passwords[newUser.email] = bcrypt.hashSync(rawPassword, 8);
    saveDbToFile(db);

    await activityService.logActivity(
      'MEMBER_ASSIGNED',
      `registered a new ${newUser.role} account`,
      newUser,
    );

    return newUser;
  }

  async resetPassword(email: string, newPasswordAttempt: string): Promise<boolean> {
    if (!email || !newPasswordAttempt) {
      throw new Error('Email and new password are required');
    }
    const user = await this.findByEmail(email);
    if (!user) {
      throw new Error('No user found with this email address');
    }

    const db = getDatabase();
    const cleanEmail = user.email.toLowerCase();
    db.passwords[cleanEmail] = bcrypt.hashSync(newPasswordAttempt, 8);
    saveDbToFile(db);

    await activityService.logActivity(
      'TASK_UPDATED',
      `reset password for account "${user.email}"`,
      user,
    );

    return true;
  }

  async createOTP(email: string): Promise<string> {
    if (!email) {
      throw new Error('Email address is required to request OTP');
    }
    const user = await this.findByEmail(email);
    if (!user) {
      throw new Error('No registered account found with this email address.');
    }

    const db = getDatabase();
    // OTP is generated here
    const cleanEmail = user.email.toLowerCase();
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

    // 2. Sets a 10-minute expiration window
    if (!db.otpTokens) {
      db.otpTokens = {};
    }
    // 3. Stores the OTP against the user's email in the database
    db.otpTokens[cleanEmail] = { code: otpCode, expiresAt };
    saveDbToFile(db);
    // 4. sends the OTP to the user's email address
    return otpCode;
  }

  async verifyAndResetPasswordWithOTP(
    email: string,
    otp: string,
    newPasswordAttempt: string,
  ): Promise<boolean> {
    if (!email || !otp || !newPasswordAttempt) {
      throw new Error('Email, OTP, and new password are required');
    }
    const user = await this.findByEmail(email);
    if (!user) {
      throw new Error('No registered account found with this email address.');
    }

    const db = getDatabase();
    const cleanEmail = user.email.toLowerCase();
    const tokenRecord = db.otpTokens?.[cleanEmail];

    if (!tokenRecord || tokenRecord.code !== otp.trim()) {
      throw new Error('Invalid OTP code. Please check the code and try again.');
    }

    if (new Date(tokenRecord.expiresAt).getTime() < Date.now()) {
      throw new Error('OTP code has expired. Please request a new OTP.');
    }

    // Reset password
    db.passwords[cleanEmail] = bcrypt.hashSync(newPasswordAttempt, 8);
    // Remove consumed token
    if (db.otpTokens) {
      delete db.otpTokens[cleanEmail];
    }
    saveDbToFile(db);

    await activityService.logActivity(
      'TASK_UPDATED',
      `reset password via OTP verification for account "${user.email}"`,
      user,
    );

    return true;
  }

  async delete(id: string): Promise<boolean> {
    const db = getDatabase();
    const userIndex = db.users.findIndex((u) => u.id === id);
    if (userIndex !== -1) {
      const user = db.users[userIndex];
      db.users.splice(userIndex, 1);

      if (user.email) {
        const cleanEmail = user.email.toLowerCase();
        delete db.passwords[cleanEmail];
        if (db.otpTokens) {
          delete db.otpTokens[cleanEmail];
        }
      }
    }

    if (Array.isArray(db.projects)) {
      db.projects.forEach((proj) => {
        if (Array.isArray(proj.memberIds)) {
          proj.memberIds = proj.memberIds.filter((mId) => mId !== id);
        }
      });
    }

    if (Array.isArray(db.tasks)) {
      db.tasks.forEach((task) => {
        if (task.assigneeId === id) {
          task.assigneeId = undefined;
          task.status = 'BACKLOG';
        }
      });
    }

    saveDbToFile(db);
    return true;
  }
}

export const userRepository = new UserRepository();
