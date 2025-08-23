// apps/mobile/lib/team/types.ts

export type StaffStatus = "active" | "inactive";

/** Full record for a staff member (business-managed) */
export interface TeamMember {
  id: string;
  firstName: string;
  lastName: string;

  /** The ID the staff member sees on their Slotly profile */
  userId: string;

  /** Business-defined, free-form label */
  role: string;

  status: StaffStatus;

  /** Optional legacy fields kept for compatibility with any old UI */
  email?: string;
  phone?: string;
}

/** Payload when a manager registers a new staff member */
export type NewTeamMember = Pick<TeamMember, "firstName" | "lastName" | "userId" | "role">;

/** Patch for updates (everything but id is optional) */
export type TeamMemberPatch = Partial<Omit<TeamMember, "id">>;
