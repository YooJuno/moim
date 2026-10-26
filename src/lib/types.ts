export type Role = 'leader' | 'treasurer' | 'member';
export type MemberStatus = 'active' | 'pending' | 'rejected';
export interface Member { id: string; name: string; email: string; photoURL?: string; isRoster?: boolean; position?: string; birthday?: string; role: Role; status: MemberStatus; canCreatePoll: boolean; joinedAt: string }
export interface UserPreferences { language: 'ko' | 'en'; theme: 'system' | 'light' | 'dark' }
export interface Profile { id: string; phone: string; area: string; birthday?: string; language?: UserPreferences['language']; theme?: UserPreferences['theme'] }
export interface Settings { name: string; description: string; photoURL?: string; smsEnabled?: boolean; smsAutoOnConfirm?: boolean }
export type Category = 'notice' | 'chat' | 'info' | 'gallery';
export interface PostAttachment { id: string; name: string; size: number; mimeType: string }
export interface Post { id: string; category: Category; title: string; body: string; authorId: string; createdAt: string; updatedAt: string; images: string[]; attachments?: PostAttachment[]; pinned: boolean; likedBy: string[] }
export interface Comment { id: string; postId: string; authorId: string; body: string; createdAt: string }
export interface PollSlot { id: string; date: string; start: string; end: string }
export interface Poll { id: string; title: string; description: string; slots: PollSlot[]; slotIds: string[]; deadline: string | null; slotMinutes?: 30 | 60; timeWindows?: PollSlot[]; status: 'open' | 'closed' | 'confirmed'; creatorId: string; createdAt: string; updatedAt: string; eventId?: string }
export interface Vote { id: string; pollId: string; memberId: string; slotIds: string[]; updatedAt: string }
export interface CalendarLink { ownerId: string; googleEventId: string; htmlLink: string; syncedAt: string; attendeeIds: string[]; signature: string }
export interface MoimEvent { id: string; title: string; description: string; date: string; start: string; end: string; location: string; creatorId: string; createdAt: string; pollId?: string; calendarLink?: CalendarLink }
export interface Rsvp { id: string; eventId: string; memberId: string; status: 'going' | 'notGoing'; updatedAt: string }
export interface Bylaws { content: string; updatedAt: string; editorId: string }
export interface SavedPlace { id: string; name: string; address: string; createdAt: string; updatedAt: string }
export interface Receipt { entryId: string; fileName: string; imageURL: string; uploadedBy: string; updatedAt: string }
export interface LedgerEntry { hasReceipt?: boolean; id: string; type: 'income' | 'expense'; category: string; amount: number; date: string; description: string; memo?: string; memberId?: string; creatorId: string; createdAt: string; updatedAt: string }
export interface BallotOption { id: string; label: string; detail?: string; menu?: string; memberId?: string }
export interface EventBallot { id: string; eventId: string; kind: 'venue' | 'mvp'; title: string; options: BallotOption[]; optionIds: string[]; status: 'open' | 'closed' | 'confirmed'; creatorId: string; createdAt: string; updatedAt: string; selectedOptionId?: string }
export interface BallotResponse { id: string; ballotId: string; eventId: string; memberId: string; optionId: string; updatedAt: string }
export interface MvpVote { id: string; eventId: string; memberId: string; candidateId: string; updatedAt: string }
export interface AppData { places: SavedPlace[]; mvpVotes: MvpVote[]; ballots: EventBallot[]; ballotResponses: BallotResponse[]; bylaws: Bylaws; ledger: LedgerEntry[]; settings: Settings; members: Member[]; profiles: Profile[]; posts: Post[]; comments: Comment[]; polls: Poll[]; votes: Vote[]; events: MoimEvent[]; rsvps: Rsvp[] }
export interface AppContextValue extends AppData {
  user: Member | null; loading: boolean; isDemo: boolean; isAdmin: boolean; canParticipate: boolean; canCreatePoll: boolean; error: string | null;
  login: (forceAccountPicker?: boolean) => Promise<void>; logout: () => Promise<void>;
  savePlace: (place: SavedPlace) => Promise<void>;
  deletePlace: (id: string) => Promise<void>;
  saveBylaws: (content: string) => Promise<void>;
  saveLedgerEntry: (entry: LedgerEntry) => Promise<void>; deleteLedgerEntry: (id: string) => Promise<void>;
  getReceipt: (entryId: string) => Promise<Receipt | null>;
  saveReceipt: (entryId: string, file: File | null) => Promise<void>;
  saveSettings: (settings: Settings) => Promise<void>;
  savePreferences: (preferences: UserPreferences) => Promise<void>;
  saveProfile: (id: string, data: { name: string; phone: string; area: string; birthday?: string }) => Promise<void>;
  updateMember: (id: string, patch: Partial<Pick<Member, 'role' | 'status' | 'canCreatePoll' | 'position'>>) => Promise<void>;
  addRosterMember: (data: { name: string; phone: string; area: string; birthday?: string; position?: string }) => Promise<void>;
  linkRosterMember: (rosterId: string, userId: string) => Promise<void>;
  savePost: (post: Post, newFiles?: File[], editing?: boolean) => Promise<void>; getPostAttachment: (postId: string, attachmentId: string) => Promise<Blob>; deletePost: (id: string) => Promise<void>; toggleLike: (id: string) => Promise<void>;
  addComment: (postId: string, body: string) => Promise<void>; deleteComment: (id: string) => Promise<void>;
  savePoll: (poll: Poll) => Promise<void>; deletePoll: (id: string) => Promise<void>; saveVote: (pollId: string, slotIds: string[]) => Promise<void>;
  confirmPoll: (pollId: string, slotId: string, location: string, endSlotId?: string) => Promise<void>;
  saveMvpVote: (eventId: string, candidateId: string) => Promise<void>;
  saveBallot: (ballot: EventBallot) => Promise<void>; deleteBallot: (id: string) => Promise<void>;
  saveBallotResponse: (ballotId: string, optionId: string) => Promise<void>; confirmVenue: (ballotId: string, optionId: string) => Promise<void>;
  saveCalendarLink: (eventId: string, link: CalendarLink) => Promise<void>;
  saveEvent: (event: MoimEvent) => Promise<void>; deleteEvent: (id: string) => Promise<void>; saveRsvp: (eventId: string, status: Rsvp['status']) => Promise<void>;
  uploadImages: (files: File[]) => Promise<string[]>; resetDemo: () => void;
}
