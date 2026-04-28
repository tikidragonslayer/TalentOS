

import type { BigFiveResult } from "@/services/big-five";
import type { MbtiResult } from "@/services/mbti";

export type LocationPreference = 'location' | 'remote' | 'relocation';

export interface UserProfile {
  id: string; // Corresponds to Firebase Auth UID
  email?: string | null;
  role: 'candidate';
  fullName?: string; // Revealed in later stages
  anonymizedName: string;
  location: string;
  locationPreference: LocationPreference;
  experienceSummary?: string; // Original, potentially PII
  anonymizedExperienceSummary: string;
  skills: string[]; // Tags
  verifiedSkills?: {
    skill: string;
    verificationDate: string;
    source: string;
    score: number;
    humanityScore?: number;
    justification: string;
  }[];
  challengeResults?: {
    challengeId: string;
    skill: string;
    difficulty: string;
    score: number;
    completedAt: string;
    timeSpentSeconds: number;
  }[];
  profileTags: string[];
  bigFive?: BigFiveResult;
  mbti?: MbtiResult;
  currentRevealLevel: number; // 1-5
  profileCompletionPercentage?: number; // 0-100
  isFoundingMember?: boolean; // For subscription benefits
  isPremium?: boolean; // Active Stripe subscription
  plan?: string; // starter | pro | enterprise
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  subscriptionStatus?: string;
  currentPeriodEnd?: string;
  osCredits: number;
  humanityScore?: number; // 0-100 (from Verification)
}

export interface EmployerProfile {
  id: string; // Corresponds to Firebase Auth UID
  email?: string | null;
  role: 'employer';
  companyId?: string; // Reference to the Company document
  isPremium?: boolean;
  plan?: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  subscriptionStatus?: string;
  currentPeriodEnd?: string;
}

export interface HiringManagerProfile {
  id: string;
  userId: string;
  fullName?: string;
  anonymizedName?: string;
  anonymizedExperienceSummary?: string;
  isVerified?: boolean;
  bigFive?: BigFiveResult;
  mbti?: MbtiResult;
}

export interface Company {
  id: string;
  ownerId: string; // UID of the user who owns this company
  companyName?: string; // Revealed in later stages
  anonymizedCompanyName: string;
  verificationStatus: 'unverified' | 'pending' | 'verified';
  hiringManager?: HiringManagerProfile;
  companyCulture?: string;
  companyValues?: string[];
  companyLogoDataUri?: string; // For rich media branding
  isEnterpriseMember?: boolean; // For subscription benefits
  osCredits: number;
}

export interface JobPosting {
  id: string;
  companyId: string; // The ID of the Company document
  title: string;
  anonymizedTitle?: string;
  anonymizedCompanyName?: string;
  hiringMode: 'location' | 'remote' | 'relocation';
  description?: string; // Original
  anonymizedDescription: string;
  location: string;
  requirements: string[];
  skills?: string[]; // Extracted skills
  idealCandidateMbti?: string; // e.g. "INFP"
  bonusAmount: number; // Sign-on bonus the employer commits to pay the candidate directly
  minSalary?: number;
  maxSalary?: number;
  // Platform fee (10% of bonusAmount, min $5) — paid to the platform operator
  platformFeePaid: boolean;
  platformFeePaymentIntentId?: string;
  platformFeePaidAt?: string; // ISO string
  // Commitment Agreement — employer signs when creating/activating listing
  commitmentAgreementId?: string;
  commitmentAgreementSignedAt?: string; // ISO string
  jobPostedDate: string; // ISO string
  activatedAt?: string; // ISO string — when platform fee paid & job went live
  expectedHireDate?: string; // ISO string
  candidateAcceptedAt?: string; // ISO string
  candidateConfirmedReceiptAt?: string; // ISO string
  disputeStatus?: 'none' | 'pending' | 'resolved';
  status: 'open' | 'closed' | 'pending_payment' | 'hired';
  postedAt?: string; // legacy support
}

/**
 * Bonus Commitment Agreement — binding document between employer and candidate.
 * TalentSync is NOT a party to the bonus payment; we only collect the platform fee.
 */
export interface CommitmentAgreement {
  id: string;
  jobId: string;
  employerId: string; // Firebase UID
  employerCompanyId: string;
  employerName: string; // Legal name / company name
  candidateId?: string; // Firebase UID — set when candidate accepts
  candidateName?: string; // Set when candidate accepts
  bonusAmount: number; // Dollar amount of the sign-on bonus
  terms: string; // The agreement text
  employerSignedAt: string; // ISO string
  employerSignatureHash: string; // SHA-256 of employer UID + timestamp + bonusAmount
  candidateAcceptedAt?: string; // ISO string
  candidateSignatureHash?: string;
  status: 'pending_candidate' | 'active' | 'fulfilled' | 'disputed' | 'expired';
  createdAt: string;
  updatedAt: string;
}

export type JobPostingSnapshot = Partial<JobPosting>;

export interface MatchScore {
  id: string;
  userProfileId: string;
  jobListingId: string;
  score: number; // 0-100
  breakdown?: {
    skills: number; // 0-100
    culture: number; // 0-100
    urgency: number; // 0-100
    logistics: number; // 0-100
  };
  justification: string;
  jobPostingSnapshot?: Partial<JobPosting>;
  feedback?: 'positive' | 'negative' | 'neutral' | null;
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string; // User ID
  receiverId: string; // User ID
  content: string;
  timestamp: any; // Firestore ServerTimestamp
  cost?: number; // Associated cost for this message
  revealLevelAtSend: number; // Track reveal level when message was sent
  sender?: 'ai' | 'user'; // For local state in interview chat
}

export interface Conversation {
  id: string;
  participantIds: string[]; // User IDs of candidate and employer
  jobId: string; // Associated job
  lastMessage?: {
    content: string;
    timestamp: any;
    senderId: string;
  };
  jobPostingSnapshot?: Partial<JobPosting>;
  candidateProfileSnapshot?: Partial<UserProfile>;
  currentMessagingTier: number; // Tier for reveal and cost
  totalCost: number;
}

export type RevealStatus = 'pending' | 'approved' | 'rejected';

export interface RevealRequest {
  id: string; // matches conversationId generally, or unique
  conversationId: string;
  requesterId: string; // Who asked for the reveal
  receiverId: string; // Who needs to approve it
  targetTier: number; // What tier to go to (curr + 1)
  status: RevealStatus;
  timestamp: any;
}

// Represents user type, could be part of a broader Auth context
export type UserRole = 'candidate' | 'employer' | null;

export interface AuthUser {
  id: string;
  email?: string | null;
  role: UserRole;
  // other generic user fields
  enablePushNotifications?: boolean;
}

export interface LocalResource {
  id: string;
  name: string;
  description: string;
  url: string;
  category: 'Training' | 'Counseling' | 'Community Event' | 'Networking';
  location?: string; // For physical resources or events
}

export interface ForumPost {
  id: string;
  title: string;
  content: string;
  authorId: string; // User ID
  authorAnonymizedName: string;
  timestamp: any; // Firestore ServerTimestamp
  repliesCount?: number;
  category: string; // e.g., "Job Search Strategies", "Industry Trends"
}

export interface ForumReply {
  id: string;
  postId: string;
  content: string;
  authorId: string;
  authorAnonymizedName: string;
  timestamp: any; // Firestore ServerTimestamp
}

export interface Offer {
  id: string;
  conversationId: string;
  jobId: string;
  employerId: string;
  candidateId: string;
  participantIds: string[]; // Denormalized from conversation for Firestore rules
  bonusAmount: number;
  proposedStartDate: string;
  message: string;
  status: 'pending' | 'accepted' | 'rejected' | 'withdrawn';
  createdAt: string;
  respondedAt?: string;
  commitmentAgreementId?: string;
}
