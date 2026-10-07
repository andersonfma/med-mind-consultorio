export type ProfileSocial = {
  id: string
  identity_mode: 'real' | 'alias'
  handle: string | null
  display_name: string | null
  avatar_url: string | null
  bio: string | null
  is_private: boolean
  leaderboard_alias: string | null
  full_name: string | null
}

export type PostKind = 'card' | 'text'
export type FollowStatus = 'pending' | 'accepted'
