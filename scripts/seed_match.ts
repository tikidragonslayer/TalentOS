
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { config } from 'dotenv';
config();

// Simple Admin Init
if (!getApps().length) {
    initializeApp();
}
const db = getFirestore();

async function seed() {
    console.log("🌱 Seeding Simulation Data...");

    const candidateId = 'sim_candidate_001';
    const jobId = 'sim_job_001';
    const matchingId = `${candidateId}_${jobId}`;

    // 1. Create Valid Candidate (High Humanity)
    await db.collection('userProfiles').doc(candidateId).set({
        id: candidateId,
        role: 'candidate',
        name: 'Alice Simulator',
        email: 'alice@simulation.com',
        humanityScore: 98,
        verifiedSkills: [{ skill: 'React', score: 95 }, { skill: 'Node.js', score: 90 }],
        mbti: { personalityType: 'INTJ' },
        createdAt: new Date(),
        preferences: { notificationSettings: { email: true, push: true } }
    }, { merge: true });
    console.log("✅ Created Candidate: Alice (Humanity: 98)");

    // 2. Create Job Listing (With Anonymization)
    await db.collection('jobListings').doc(jobId).set({
        id: jobId,
        companyId: 'comp_001',
        title: 'Senior Full Stack Engineer',
        anonymizedTitle: 'Lead Builder at Stealth Protocol',
        description: 'We are Google Deepmind...',
        anonymizedDescription: 'A top-tier AI research lab is seeking...',
        status: 'open',
        location: 'Remote',
        hiringMode: 'remote',
        depositAmount: 5000,
        idealCandidateMbti: 'INTJ',
        createdAt: new Date()
    }, { merge: true });
    console.log("✅ Created Job: Senior Engineer (Anonymized: Lead Builder)");

    // 3. Create Match Score (Simulating AI Success)
    await db.collection('matchScores').doc(matchingId).set({
        id: matchingId,
        userProfileId: candidateId,
        jobListingId: jobId,
        score: 95,
        justification: "Candidate is a perfect INTJ match with verified React skills.",
        createdAt: new Date(),
        // Vital: Snapshotting the anonymized data
        jobPostingSnapshot: {
            title: 'Senior Full Stack Engineer',
            anonymizedTitle: 'Lead Builder at Stealth Protocol',
            companyId: 'comp_001',
            location: 'Remote',
            anonymizedDescription: 'A top-tier AI research lab is seeking...',
            idealCandidateMbti: 'INTJ',
            depositAmount: 5000
        }
    }, { merge: true });
    console.log("✅ Created Match Score: 95% Match");

    console.log("\nSimulation Data Ready. Login as 'alice@simulation.com' to verify.");
}

seed().catch(console.error);
