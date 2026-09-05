import type { User } from '@/types';
import { userRepository } from '../repositories/user.repository';

export class AuthService {
  async getUserByEmail(email: string): Promise<User | undefined> {
    return userRepository.findByEmail(email);
  }

  async getUserById(id: string): Promise<User | undefined> {
    return userRepository.findById(id);
  }

  async verifyPassword(email: string, passwordAttempt: string): Promise<boolean> {
    return userRepository.verifyPassword(email, passwordAttempt);
  }

  async registerUser(data: {
    name: string;
    email: string;
    designation?: string;
    passwordAttempt?: string;
    password?: string;
    role?: 'ADMIN' | 'MEMBER';
  }): Promise<User> {
    return userRepository.create(data);
  }

  async resetPassword(email: string, newPasswordAttempt: string): Promise<boolean> {
    return userRepository.resetPassword(email, newPasswordAttempt);
  }

  async createOTP(email: string): Promise<string> {
    return userRepository.createOTP(email);
  }

  async verifyAndResetPasswordWithOTP(
    email: string,
    otp: string,
    newPasswordAttempt: string,
  ): Promise<boolean> {
    return userRepository.verifyAndResetPasswordWithOTP(email, otp, newPasswordAttempt);
  }
}

export const authService = new AuthService();
