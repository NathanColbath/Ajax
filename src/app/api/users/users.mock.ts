import { LibraryUser } from './users.models';

export const MOCK_USERS: LibraryUser[] = [
  {
    id: 'u1',
    name: 'Nathan',
    email: 'nathan@local',
    role: 'super_admin',
    enabled: true,
    initials: 'NA',
  },
  {
    id: 'u2',
    name: 'Alex Rivera',
    email: 'alex@local',
    role: 'admin',
    enabled: true,
    initials: 'AR',
  },
  {
    id: 'u3',
    name: 'Sam Chen',
    email: 'sam@local',
    role: 'standard',
    enabled: true,
    initials: 'SC',
  },
  {
    id: 'u4',
    name: 'Jordan Lee',
    email: 'jordan@local',
    role: 'standard',
    enabled: false,
    initials: 'JL',
  },
];
