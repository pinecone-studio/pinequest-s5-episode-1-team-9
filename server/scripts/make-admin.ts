import { connectDatabase, disconnectDatabase } from "../src/db/connect";
import { User } from "../src/models/User";

/**
 * Promotes (or demotes) an account to admin. There is no Clerk dashboard in this stack: the role
 * lives on the User document, so this is how the first admin is created.
 *
 *   npm run make-admin -w server -- you@example.com
 *   npm run make-admin -w server -- your_username --revoke
 */
async function main() {
  const identifier = process.argv[2];
  const revoke = process.argv.includes("--revoke");
  if (!identifier) {
    console.error("Usage: npm run make-admin -w server -- <email-or-username> [--revoke]");
    process.exitCode = 1;
    return;
  }

  await connectDatabase();
  const query = identifier.includes("@")
    ? { email: identifier.toLowerCase() }
    : { username: new RegExp(`^${identifier.replace(/[^a-zA-Z0-9_]/g, "")}$`, "i") };
  const user = await User.findOne(query);
  if (!user) {
    console.error(`No user matching "${identifier}".`);
    process.exitCode = 1;
  } else {
    user.role = revoke ? "user" : "admin";
    await user.save();
    console.log(`[admin] ${user.username} <${user.email}> is now role=${user.role}`);
  }
  await disconnectDatabase();
}

main().catch(async (err) => {
  console.error("[admin] Failed:", err);
  await disconnectDatabase().catch(() => undefined);
  process.exit(1);
});
