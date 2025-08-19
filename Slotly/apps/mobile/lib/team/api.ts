import type { TeamMember } from "./types"
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

let TEAM: TeamMember[] = [
  {
    id: "t1",
    firstName: "Alice",
    lastName: "Njoroge",
    email: "alice@slotly.com",
    phone: "+254711000111",
    role: "Stylist",
    status: "active",
  },
  {
    id: "t2",
    firstName: "Brian",
    lastName: "Otieno",
    email: "brian@slotly.com",
    phone: "+254722000222",
    role: "Therapist",
    status: "active",
  },
]

export const teamApi = {
  async list(): Promise<TeamMember[]> {
    await wait(120)
    return TEAM.map((x) => ({ ...x }))
  },
  async get(id: string): Promise<TeamMember | undefined> {
    await wait(100)
    return TEAM.find((x) => x.id === id)
  },
  async create(payload: Omit<TeamMember, "id" | "status">): Promise<TeamMember> {
    await wait(200)
    const item: TeamMember = { id: `t${Math.floor(Math.random() * 1e6)}`, status: "active", ...payload }
    TEAM = [item, ...TEAM]
    return item
  },
  async update(id: string, patch: Partial<TeamMember>): Promise<TeamMember | undefined> {
    await wait(150)
    TEAM = TEAM.map((t) => (t.id === id ? { ...t, ...patch } : t))
    return TEAM.find((t) => t.id === id)
  },
  async remove(id: string): Promise<void> {
    await wait(120)
    TEAM = TEAM.filter((t) => t.id !== id)
  },
}
