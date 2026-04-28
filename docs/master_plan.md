# Master Planning Prompt: Rebuilding "TalentOS"

## 1. Core Mission & Guiding Philosophy

**Project Name:** TalentOS (formerly Veiled Ventures)

**Mission:** To build a high-signal, anonymous hiring marketplace that replaces the inefficiencies and biases of traditional recruiting with a data-driven, strategic approach. We connect elite, often passive, talent with high-stakes roles by prioritizing verified skills, psychometric fit, and mutual commitment, all while maintaining strict confidentiality.

**Core Principles:**
*   **Signal over Noise:** Every feature must be designed to increase the signal-to-noise ratio in the hiring process. This means eliminating spam, valuing verified data over unverified claims, and ensuring every interaction is meaningful.
*   **Anonymity as Power:** Confidentiality is not just a privacy feature; it is a strategic tool. It empowers passive talent to explore the market without risk and enables companies to hire for strategic roles without alerting competitors.
*   **Incentive Alignment:** The platform's economic model must align the interests of the candidate, the employer, and the platform itself. Success is defined as a successful long-term placement, not just a transaction.
*   **Data-Driven, Not Data-Sourced:** We use data to make better decisions, but we are not in the business of selling user data. User privacy and trust are paramount.

---

## 2. Foundational Architecture & Technology Stack

### 2.1. Technology
*   **Framework:** Next.js (App Router) with React Server Components by default.
*   **Language:** TypeScript.
*   **Styling:** Tailwind CSS with a CSS-in-JS approach for theme variables (`globals.css`).
*   **UI Components:** ShadCN/UI.
*   **Generative AI:** Genkit, utilizing Google's Gemini family of models.
*   **Backend & Database:** Firebase (Authentication and Firestore).

### 2.2. UI/UX & Style Guidelines
*   **Layout:** Clean, modern, card-based layout. The UI must feel professional, trustworthy, and intuitive.
*   **Color Palette (Light Mode):**
    *   `--background`: Neutral gray (`#F5F5F5` / `0 0% 96.1%`)
    *   `--secondary`: Light blue (`#E0F7FA` / `190 78% 93%`)
    *   `--primary` & `--accent`: Teal (`#008080` / `180 100% 25%`)
*   **Responsiveness:** The application must be fully responsive across all standard device sizes.

### 2.3. Firebase & Backend Principles
*   **Client-Side First:** All Firebase interactions (reads, writes) must occur on the client-side (`'use client'`). Do not use the Firebase Admin SDK in the Next.js application code.
*   **Security First:** All data access must be governed by strict Firestore Security Rules. The frontend should assume a hostile environment; the backend rules are the ultimate source of truth for enforcement.
*   **Real-Time Data:** Utilize `onSnapshot` for features that require real-time updates (messaging, notifications).
*   **Non-Blocking UI:** For all data mutations (`setDoc`, `addDoc`, `updateDoc`, `deleteDoc`), use a non-blocking approach. Chain `.catch()` blocks to handle permission errors gracefully using the provided `FirestorePermissionError` architecture. This ensures an optimistic and responsive UI.

---

## 3. Phased Implementation Plan

### **Phase 1: Backend Foundation & Data Modeling**

This is the most critical phase. A robust and secure backend is non-negotiable.

1.  **Provision Firebase:** Use the `RequestFirebaseBackendTool` to set up the Firebase project, Firestore database, and initial boilerplate code.
2.  **Define Data Models (`docs/backend.json`):** Meticulously define the JSON schema for every entity. This is our contract.
    *   **`UserProfile`:** For "Talent." Must include fields for `role`, `anonymizedName`, `location`, `locationPreference`, `anonymizedExperienceSummary`, `skills` (array), `verifiedSkills` (array of objects), `profileTags` (array), `mbti`, `bigFive`, and `osCredits`.
    *   **`Company`:** For "Builders." Must include `ownerId`, `anonymizedCompanyName`, `verificationStatus`, `hiringManager` (nested object with personality scores), `companyCulture`, and `osCredits`.
    *   **`EmployerProfile`:** A slim user record for employers, linking their `userId` to a `companyId`.
    *   **`JobPosting`:** The core job entity. Includes `companyId`, `anonymizedDescription`, `requirements` (array), `status` (`pending_deposit`, `open`, `closed`), `depositAmount`, `bonusAmount`.
    *   **`MatchScore`:** To store the AI-generated match between a `userProfileId` and `jobListingId`. Must include `score` and `justification`.
    *   **`Conversation`:** A top-level collection containing `participantIds`, `jobId`, and a snapshot of the `lastMessage` for list views.
    *   **`Message`:** A sub-collection under `conversations`. Contains `senderId`, `content`, and `timestamp`.
    *   **`ForumPost`** & **`ForumReply`**: For the community forum.
    *   **`LocalResource`**: For the resources page.
3.  **Implement Security Rules (`firestore.rules`):**
    *   Users can only read/write their own profile (`/users/{userId}`).
    *   Employers (as owners) can only manage their own company profile and job postings.
    *   Messages in a conversation can only be read by participants.
    *   Match scores and job listings should be publicly readable (`list`) but have restricted write access.
    *   Forum posts and resources should be publicly readable but write-restricted to authenticated users.

### **Phase 2: Authentication & Application Shell**

1.  **Implement Authentication:** Create a login page using FirebaseUI for Google and Email/Password auth. The flow must prompt the user to select their role ("Talent" or "Builder") upon first sign-up.
2.  **Create Global User Context:** Implement `UserProvider` (`src/contexts/user-context.tsx`) that listens to `onAuthStateChanged` and fetches the user's corresponding Firestore profile (`UserProfile` or `EmployerProfile`). This context will provide `authUser`, `profile`, `role`, and `isLoading` to the entire application.
3.  **Build the App Shell:** Create the main layout (`src/components/layout/app-shell.tsx`) with a persistent sidebar. The sidebar navigation items must be dynamically rendered based on the user's `role` from the `useUser` hook.

### **Phase 3: Core Feature Implementation**

With the backend and auth in place, connect every UI element to live Firestore data.

1.  **Candidate & Employer Flows:**
    *   **Profile Pages:** Connect the profile pages to `useDoc` to fetch and display user/company profiles in real-time. Implement the "Create Profile" flows for new users. Ensure all form inputs use non-blocking write operations to save changes live.
    *   **AI Skill Verification:** Connect the interview page. On completion, the AI flow's results (`knowledgeScore`, `justification`) must be saved to the `verifiedSkills` array in the user's Firestore document, and their `osCredits` must be decremented.
2.  **Job Posting & Matching Flow:**
    *   The "New Job" form saves a new document to `/jobListings` with `status: 'pending_deposit'`.
    *   The "Pay Deposit" dialog updates the document's `status` to `open`.
    *   **CRITICAL:** Upon a job's status changing to `open`, trigger the `matchCandidateToJob` AI flow. This flow should query all `UserProfile` documents and the target `JobPosting` document to generate `MatchScore` documents and save them to Firestore.
    *   The "Job Matches" page must query the `/matchScores` collection for the current user's ID, sorted by score, and display the results.

### **Phase 4: Communication & Community**

1.  **Live Messaging:**
    *   When a user "Expresses Interest," create a new document in the `/conversations` collection.
    *   The message list pages must query the `/conversations` collection where `participantIds` contains the current user's ID.
    *   The `[chatId]` page must use `useCollection` with `onSnapshot` on the `/conversations/{chatId}/messages` sub-collection to create a real-time chat experience.
2.  **Community Forum & Resources:**
    *   Connect all forum pages (list, detail, new post) and the resources page to their respective live Firestore collections for full CRUD functionality.

### **Phase 5: Final Polish & Legal**

1.  **Homepage Legal Dialog:** Implement the non-dismissible modal on the homepage that forces agreement to the Terms of Service, including the binding arbitration clause. Use `sessionStorage` to prevent it from showing on every page load within a session.
2.  **Error Handling & Loading States:** Ensure all pages that fetch data have proper loading spinners and gracefully handle potential errors or empty states.

By following this master plan, we will construct a robust, scalable, and feature-complete application that fully realizes the vision of TalentOS.
