export interface IUser {
  id: string
  name: string
  email?: string
  avatarUrl?: string
  isOnline?: boolean
  lastActiveAt?: Date
  metadata?: Record<string, any>
}
