# Firestore Security Specifications

## 1. Data Invariants

- **Catalog Read Access**: Anyone (unauthenticated and authenticated users alike) can query and read products, category slugs, active banners, and global setting details.
- **Catalog Write Access**: Strictly prohibited for standard customers. Alterations to products, categories, banners, and settings are exclusively granted to verified administrators with verified emails `jrperfumaria04@gmail.com` and `joaoalexsanderro@gmail.com`.
- **User Cart & Profile Access**: A standard customer can only write and read their own user profile document matching their `userId` equal to `request.auth.uid`. No user can read or write other users' personal documents.

---

## 2. The "Dirty Dozen" Malicious Payloads

The following payloads attempt to compromise application security and must return `PERMISSION_DENIED`:

1.  **Identity Spoofing on User Docs**: An attacker authenticated as `user_A` tries to write high-score or cart info to `/users/user_B`. (Should be blocked by `request.auth.uid == userId`)
2.  **Unauthenticated Product Creation**: An unauthenticated user tries to add a custom discount perfume via `/products/fake_perfume`. (Should be blocked by auth requirement)
3.  **Self-Promotion to Admin**: A standard user attempts to upload a document to `/admins/attacker_uid` writing their email as admin. (Should be blocked by strict write restrictions)
4.  **Admin Spoofing without Email Verification**: A user registers an account with the email `jrperfumaria04@gmail.com` but does not verify their email (`email_verified == false`) and tries to delete a product. (Should be blocked by `email_verified == true` requirement)
5.  **Setting Manipulation**: An attacker attempts to change the store's WhatsApp configuration to redirect payments to their own number at `/settings/whatsappNumber`. (Blocked by isAdmin)
6.  **Immortal Field Bypass on Products**: An attacker attempts to write an invalid/empty category or an extreme negative price on a product. (Validated by `price is number && price >= 0`)
7.  **Resource Exhaustion / Large ID Injection**: An attacker tries to write to a document ID of size 5KB to overload the storage structure index. (Blocked by `id.size() <= 128` regex constraints)
8.  **Empty Banner Title Attack**: A bad actor tries to configure an empty banner or incorrect field types to corrupt rendering. (Schema validated)
9.  **Anonymized Admin Request**: An anonymous login attempts to update a catalog product. (Blocked by admin checks)
10. **Shadow Key Inject in setting document**: Attempting to upload unexpected fields in `/settings/logoUrl` such as `{ key: "logoUrl", value: "http://bad", hacked: true }`. (Blocked by rigid key controls)
11. **Reading Private Profiles Blanket Query**: A regular customer attempts to list all user documents in `/users` collection without specifying an individual target key. (Blocked by `allow list` restrictions)
12. **Malicious Catalog Category Hijack**: Attempting to delete a core product category without admin privileges. (Blocked by isAdmin)

---

## 3. Security Test Scenarios

Verified via static analysis and automated assertion rules in `firestore.rules`.
- Every collection is closed by default.
- Reads are universally public on catalogs but restricted on private users paths.
- Writes to catalog paths are exclusively authenticated, validated, and restricted to the two verified admin email addresses.
