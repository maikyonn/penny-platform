import type { User } from '@supabase/supabase-js';
import { sessionFixture } from './session';

export const userFixture = sessionFixture.user as User;
