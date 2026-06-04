import bcrypt from 'bcryptjs';
import { prisma } from '../../infrastructure/database/client';
import { AppError } from '../../errors/AppError';
import { signToken } from '../../api/middleware/auth';
import type { AuthUser } from '../../types';

const BCRYPT_ROUNDS = 12;

export const authService = {
  async register(input: { email: string; password: string; name: string }) {
    const email = input.email.toLowerCase().trim();

    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existing) {
      throw AppError.conflict('An account with this email already exists');
    }

    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

    const user = await prisma.user.create({
      data: { email, name: input.name.trim(), password: passwordHash },
    });

    const authUser = toAuthUser(user);
    return { token: signToken(authUser), user: authUser };
  },

  async login(input: { email: string; password: string }) {
    const email = input.email.toLowerCase().trim();

    const row = await prisma.user.findUnique({ where: { email } });

    // Use bcrypt.compare on a fake hash even if the user is missing — this
    // closes the timing channel that would otherwise leak which emails exist.
    const stored = row?.password ?? '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv';
    const ok = await bcrypt.compare(input.password, stored);

    if (!row || !ok) {
      throw AppError.unauthorized('Invalid email or password');
    }

    const user = toAuthUser(row);
    return { token: signToken(user), user };
  },

  async findById(id: string): Promise<AuthUser | null> {
    const row = await prisma.user.findUnique({ where: { id } });
    return row ? toAuthUser(row) : null;
  },
};

function toAuthUser(row: { id: string; email: string; name: string }): AuthUser {
  return { id: row.id, email: row.email, name: row.name };
}
