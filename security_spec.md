# Security Specification & Threat Model

## Data Invariants
1. A message cannot exist without a valid ID, channel ID, sender ID, and sender name.
2. User profile records must be owned and updated exclusively by the authenticated user (`request.auth.uid == userId`).
3. Message creation strictly validates string length boundaries (content <= 2048 chars, IDs <= 128 chars).

## The "Dirty Dozen" Payloads (Test Scenarios)
1. Creating a message with missing sender ID.
2. Creating a message exceeding 2048 characters in content.
3. Updating a user profile belonging to another user.
4. Injecting a malicious script or oversized string into document ID paths.
5. Setting arbitrary admin/role flags on user creation.
6. Creating a message with a spoofed sender name without matching auth uid.
7. Attempting unauthenticated read/write on restricted private documents.
8. Bypassing size restrictions on attachment URLs.
9. Modifying immutable creation timestamps (`created_at`).
10. Injecting ghost fields during document creation.
11. Accessing private DM channels without participant verification.
12. Performing unverified batch writes across mismatched user IDs.
